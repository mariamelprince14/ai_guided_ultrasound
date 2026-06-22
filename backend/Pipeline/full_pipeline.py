#!/usr/bin/env python3
"""
full_pipeline.py — AI-Guided Ultrasound Training System
========================================================
Complete single-file inference pipeline integrating all four modules:
  Module 1: Organ Segmentation         (UNet++ / EfficientNet-B3)
  Module 2: Feature Extraction          (Geometric + shape from masks)
  Module 3: Presence & Quality          (TabularTransformer, multi-task)
  Module 4: PPO Guidance Agent          (Stable-Baselines3 PPO)

Run:
    python full_pipeline.py                          # FastAPI server on port 8000
    python full_pipeline.py --image sample_ct.png    # CLI single-image inference
"""
from __future__ import annotations

import json
import logging
import os
import re
import sys
import tempfile
import zipfile
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple, Union

import cv2
import joblib
import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F

# ---------------------------------------------------------------------------
#  Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("UltrasoundPipeline")

# ---------------------------------------------------------------------------
#  Device
# ---------------------------------------------------------------------------
DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
logger.info("Using device: %s", DEVICE)

# ╔═════════════════════════════════════════════════════════════════════════╗
# ║                     PLACEHOLDER MODEL PATHS                            ║
# ║  Replace every placeholder below with the actual path to the file.     ║
# ╚═════════════════════════════════════════════════════════════════════════╝

# --- Module 1: Segmentation ---
SEGMENTATION_MODEL_PATH: str = str(Path(__file__).parent / "module 1" / "best_model_fold_3.pth")

# --- Module 3: Presence & Quality (TabularTransformer Fold 5 Bundle) ---
MODULE3_BUNDLE_DIR: str = str(Path(__file__).parent / "module 3")

# --- Module 4: PPO Guidance Agent ---
LIVER_PPO_PATH: str = str(Path(__file__).parent / "module 4" / "ppo_liver_final.zip")
KIDNEY_PPO_PATH: str = str(Path(__file__).parent / "module 4" / "ppo_kidney_final.zip")
GALLBLADDER_PPO_PATH: str = str(Path(__file__).parent / "module 4" / "ppo_gallbladder_final.zip")

# Scaler for the 34 Module-2/3 features used inside PPO state builder
PPO_SCALER_PATH: str = str(Path(__file__).parent / "module 3" / "scaler_fold5.pkl")

# ═══════════════════════════════════════════════════════════════════════════
#                         GLOBAL CONSTANTS
# ═══════════════════════════════════════════════════════════════════════════

IMAGE_SIZE: int = 384
NUM_CLASSES: int = 4

ORGANS: List[str] = ["liver", "kidney", "gallbladder"]
ORGAN2IDX: Dict[str, int] = {o: i for i, o in enumerate(ORGANS)}
ORGAN_CLASS_MAP: Dict[str, int] = {"liver": 1, "kidney": 2, "gallbladder": 3}
CLASS_ORGAN_MAP: Dict[int, str] = {v: k for k, v in ORGAN_CLASS_MAP.items()}

ORGAN_COLORS: Dict[str, np.ndarray] = {
    "liver":       np.array([221, 130, 101]),
    "kidney":      np.array([185, 102,  83]),
    "gallbladder": np.array([139, 150,  98]),
}
COLOR_TOLERANCE: int = 5
MIN_ORGAN_AREA: int = 150

PRESENCE_CLASSES: List[str] = ["absent", "partial", "full"]

# Module 2 / 3 shared feature schema (11 per organ × 3 organs + 1 = 34)
ORGAN_FEATURES: List[str] = [
    "present", "n_components", "area_ratio",
    "bbox_width_norm", "bbox_height_norm",
    "centroid_x_norm", "centroid_y_norm",
    "solidity", "extent", "eccentricity", "compactness",
]
ALL_FEATURE_COLS: List[str] = [f"{o}_{f}" for o in ORGANS for f in ORGAN_FEATURES]
NUMERICAL_FEATURE_COLS: List[str] = ALL_FEATURE_COLS + ["slice_position_norm"]
N_NUM: int = len(NUMERICAL_FEATURE_COLS)  # 34

# Shape features that should be filled with 0.0 when organ is absent
SHAPE_FEATS_FILLNA: List[str] = [
    "centroid_x_norm", "centroid_y_norm", "solidity", "extent",
    "eccentricity", "compactness", "bbox_width_norm", "bbox_height_norm",
]

# Module 4 — PPO constants
STEP_SIZE: float = 0.01
MAX_STEPS: int = 150
N_ACTIONS: int = 7

ACTION_MAP: Dict[int, Tuple[str, str]] = {
    0: ("+X", "Move RIGHT"),
    1: ("-X", "Move LEFT"),
    2: ("+Y", "Move POSTERIOR"),
    3: ("-Y", "Move ANTERIOR"),
    4: ("+Z", "Move SUPERIOR"),
    5: ("-Z", "Move INFERIOR"),
    6: ("STOP", "ACQUIRE"),
}

GUIDANCE_TEXT: Dict[int, str] = {
    0: "Move RIGHT      (+X)",
    1: "Move LEFT       (-X)",
    2: "Move POSTERIOR  (+Y)",
    3: "Move ANTERIOR   (-Y)",
    4: "Move SUPERIOR   (+Z)",
    5: "Move INFERIOR   (-Z)",
    6: "ACQUIRE",
}

# State vector layout  (total = 125)
#   [0:3]     probe_x, probe_y, probe_z                         3
#   [3:37]    34 numerical features (StandardScaler'd)          34
#   [37:40]   organ one-hot                                      3
#   [40:124]  local perception placeholder (84)                 84
#   [124]     remaining step budget (normalised)                 1
STATE_DIM: int = 125

# Quality blending weights across planes
Q_WEIGHT: Dict[str, float] = {"Z": 0.50, "X": 0.25, "Y": 0.25}

# StopGate defaults
STOP_Q_THRESH: float = 0.27
STOP_STABLE_N: int = 3


# ╔═════════════════════════════════════════════════════════════════════════╗
# ║                  MODULE 1 — ORGAN SEGMENTATION                         ║
# ╚═════════════════════════════════════════════════════════════════════════╝

class SegmentationModel:
    """
    Module 1 — UNet++ organ segmentation with EfficientNet-B3 encoder.

    Pipeline:
        CT image (grayscale) → CLAHE → min-max normalise [0,1]
        → resize 384×384 → model → argmax → organ masks

    Organs: 0=background, 1=liver, 2=kidney, 3=gallbladder
    """

    def __init__(
        self,
        model_path: str = SEGMENTATION_MODEL_PATH,
        device: torch.device = DEVICE,
        image_size: int = IMAGE_SIZE,
    ) -> None:
        self.device = device
        self.image_size = image_size
        self._clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))

        try:
            import segmentation_models_pytorch as smp
        except ImportError:
            raise ImportError(
                "segmentation_models_pytorch is required. "
                "Install with: pip install segmentation-models-pytorch"
            )

        logger.info("Building UNet++ (efficientnet-b3) segmentation model …")
        self.model = smp.UnetPlusPlus(
            encoder_name="efficientnet-b3",
            encoder_weights=None,        # weights loaded from checkpoint
            in_channels=1,
            classes=NUM_CLASSES,          # 4
            decoder_attention_type="scse",
            decoder_use_batchnorm=True,
        )

        if os.path.isfile(model_path):
            state = torch.load(model_path, map_location=device, weights_only=True)
            self.model.load_state_dict(state)
            logger.info("Loaded segmentation weights from %s", model_path)
        else:
            logger.warning(
                "Segmentation weight file NOT found: %s — "
                "model will run with random weights (replace placeholder!).",
                model_path,
            )

        self.model.to(device).eval()

    # ── preprocessing (NumPy array) ───────────────────────────────────────
    def preprocess_array(self, img: np.ndarray) -> Tuple[np.ndarray, Tuple[int, int]]:
        """CLAHE, normalise, resize from in-memory numpy array → float32 (H, W) in [0,1]."""
        original_size: Tuple[int, int] = (img.shape[0], img.shape[1])  # (H, W)

        # CLAHE contrast enhancement
        img = self._clahe.apply(img)

        # Min-max normalisation
        img = img.astype(np.float32)
        lo, hi = img.min(), img.max()
        if hi > lo:
            img = (img - lo) / (hi - lo)
        else:
            img = np.zeros_like(img)

        # Resize to model input size
        img = cv2.resize(
            img, (self.image_size, self.image_size), interpolation=cv2.INTER_LINEAR
        )
        return img, original_size

    def predict_array(
        self, img_array: np.ndarray
    ) -> Tuple[np.ndarray, np.ndarray, Dict[str, Any], np.ndarray]:
        """
        In-memory array segmentation inference.
        """
        img, original_size = self.preprocess_array(img_array)

        tensor = torch.from_numpy(img).unsqueeze(0).unsqueeze(0).to(self.device)
        # shape: (1, 1, 384, 384)

        with torch.no_grad():
            output = self.model(tensor)  # (1, 4, 384, 384)

        mask, probs, organ_info = self.postprocess(output, original_size)
        return mask, probs, organ_info, img

    # ── preprocessing ─────────────────────────────────────────────────────
    def preprocess(self, image_path: str) -> Tuple[np.ndarray, Tuple[int, int]]:
        """Load, CLAHE, normalise, resize → float32 (H, W) in [0,1]."""
        img = cv2.imread(image_path, cv2.IMREAD_GRAYSCALE)
        if img is None:
            raise FileNotFoundError(f"Cannot read image: {image_path}")

        original_size: Tuple[int, int] = (img.shape[0], img.shape[1])  # (H, W)

        # CLAHE contrast enhancement
        img = self._clahe.apply(img)

        # Min-max normalisation
        img = img.astype(np.float32)
        lo, hi = img.min(), img.max()
        if hi > lo:
            img = (img - lo) / (hi - lo)
        else:
            img = np.zeros_like(img)

        # Resize to model input size
        img = cv2.resize(
            img, (self.image_size, self.image_size), interpolation=cv2.INTER_LINEAR
        )
        return img, original_size

    # ── postprocessing ────────────────────────────────────────────────────
    @staticmethod
    def postprocess(
        output: torch.Tensor,
        original_size: Optional[Tuple[int, int]] = None,
    ) -> Tuple[np.ndarray, np.ndarray, Dict[str, Any]]:
        """
        Convert raw model logits to mask + probabilities + organ info dict.

        Returns:
            mask:       (H, W) int32  — class indices 0-3
            probs:      (4, H, W) float32 — per-class softmax probabilities
            organ_info: dict[str, dict] — per-organ presence statistics
        """
        probs = torch.softmax(output, dim=1).squeeze(0).cpu().numpy()  # (4, H, W)
        mask = np.argmax(probs, axis=0)  # (H, W)

        if original_size is not None:
            h, w = original_size
            mask = cv2.resize(
                mask.astype(np.float32), (w, h), interpolation=cv2.INTER_NEAREST
            ).astype(np.int32)
            resized = np.zeros((probs.shape[0], h, w), dtype=np.float32)
            for c in range(probs.shape[0]):
                resized[c] = cv2.resize(probs[c], (w, h), interpolation=cv2.INTER_LINEAR)
            probs = resized

        total_px = mask.shape[0] * mask.shape[1]
        organ_info: Dict[str, Any] = {}
        for cls_idx, organ_name in CLASS_ORGAN_MAP.items():
            omask = mask == cls_idx
            n_px = int(np.sum(omask))
            organ_info[organ_name] = {
                "present": n_px > 0,
                "pixel_count": n_px,
                "area_ratio": float(n_px / total_px),
                "mean_probability": float(np.mean(probs[cls_idx][omask])) if n_px > 0 else 0.0,
                "max_probability": float(np.max(probs[cls_idx])) if n_px > 0 else 0.0,
            }
        return mask, probs, organ_info

    # ── public inference ──────────────────────────────────────────────────
    def predict(
        self, image_path: str
    ) -> Tuple[np.ndarray, np.ndarray, Dict[str, Any], np.ndarray]:
        """
        End-to-end segmentation inference.

        Returns:
            mask         – (H, W) segmentation mask (original resolution)
            probs        – (4, H, W) class probabilities (original resolution)
            organ_info   – dict with per-organ presence statistics
            preprocessed – (384, 384) preprocessed image for downstream modules
        """
        img, original_size = self.preprocess(image_path)

        tensor = torch.from_numpy(img).unsqueeze(0).unsqueeze(0).to(self.device)
        # shape: (1, 1, 384, 384)

        with torch.no_grad():
            output = self.model(tensor)  # (1, 4, 384, 384)

        mask, probs, organ_info = self.postprocess(output, original_size)
        logger.info("Segmentation complete — organs detected: %s",
                     [o for o, v in organ_info.items() if v["present"]])
        return mask, probs, organ_info, img


# ╔═════════════════════════════════════════════════════════════════════════╗
# ║              MODULE 2 — FEATURE EXTRACTION                             ║
# ╚═════════════════════════════════════════════════════════════════════════╝

class FeatureExtractor:
    """
    Module 2 — Extracts geometric / shape features from the segmentation mask.

    Features are computed per organ from the label mask only (the CT pixel
    intensities are NOT used).  Each organ produces 21 raw features; only the
    11 features required by Module 3 are assembled into the final vector.

    Output: 34-dim numerical feature vector  (11 per organ × 3 + slice_position_norm).
    """

    def __init__(self, image_size: int = IMAGE_SIZE) -> None:
        self.H: int = image_size
        self.W: int = image_size
        self.total_pixels: int = self.H * self.W

    # ── helpers ───────────────────────────────────────────────────────────
    @staticmethod
    def _safe(val: Any) -> float:
        try:
            v = float(val)
            return v if np.isfinite(v) else np.nan
        except Exception:
            return np.nan

    @staticmethod
    def _r(v: float, decimals: int = 6) -> float:
        return round(v, decimals) if (v is not None and not np.isnan(v)) else np.nan

    # ── absent features ──────────────────────────────────────────────────
    @staticmethod
    def _absent_features() -> Dict[str, Any]:
        nan = np.nan
        return {
            "present": False, "n_components": 0,
            "area": 0, "area_ratio": 0.0,
            "bbox_xmin": nan, "bbox_ymin": nan, "bbox_xmax": nan, "bbox_ymax": nan,
            "bbox_width": nan, "bbox_height": nan,
            "bbox_xmin_norm": nan, "bbox_ymin_norm": nan,
            "bbox_xmax_norm": nan, "bbox_ymax_norm": nan,
            "bbox_width_norm": nan, "bbox_height_norm": nan,
            "centroid_x": nan, "centroid_y": nan,
            "centroid_x_norm": nan, "centroid_y_norm": nan,
            "coverage": 0.0,
            "solidity": nan, "extent": nan,
            "eccentricity": nan, "perimeter": nan, "compactness": nan,
        }

    # ── single organ extraction ──────────────────────────────────────────
    def _extract_organ(self, label_mask: np.ndarray, class_id: int, organ: str) -> Dict[str, Any]:
        """Extract all 23 features for a single organ from the label mask."""
        from skimage.measure import label as sk_label, regionprops

        binary = (label_mask == class_id).astype(np.uint8)
        n_pixels = int(binary.sum())

        if n_pixels < MIN_ORGAN_AREA:
            return self._absent_features()

        labeled = sk_label(binary, connectivity=2)
        all_props = sorted(regionprops(labeled), key=lambda p: p.area, reverse=True)
        n_comps = len(all_props)
        region = all_props[0]

        if region.area < MIN_ORGAN_AREA:
            return self._absent_features()

        area_ratio = n_pixels / self.total_pixels

        ys, xs = np.where(binary == 1)
        cx, cy = float(np.mean(xs)), float(np.mean(ys))
        xmin, xmax = int(xs.min()), int(xs.max())
        ymin, ymax = int(ys.min()), int(ys.max())

        solidity     = self._safe(region.solidity)
        extent       = self._safe(region.extent)
        eccentricity = self._safe(region.eccentricity)
        perimeter    = self._safe(region.perimeter)
        compactness  = (
            (4.0 * np.pi * region.area / perimeter ** 2)
            if (perimeter and perimeter > 0 and np.isfinite(perimeter))
            else np.nan
        )

        # Organ-specific divisors derived from training max values
        DIVISORS = {
            "liver_width": 215.235,
            "liver_height": 269.413,
            "kidney_width": 151.831,
            "kidney_height": 149.619,
            "gallbladder_width": 40.516,
            "gallbladder_height": 71.465,
        }

        w_div = DIVISORS.get(f"{organ}_width", self.W)
        h_div = DIVISORS.get(f"{organ}_height", self.H)

        return {
            "present":         True,
            "n_components":    n_comps,
            "area":            n_pixels,
            "area_ratio":      round(area_ratio, 6),
            "bbox_xmin":       xmin,
            "bbox_ymin":       ymin,
            "bbox_xmax":       xmax,
            "bbox_ymax":       ymax,
            "bbox_width":      xmax - xmin,
            "bbox_height":     ymax - ymin,
            "bbox_xmin_norm":  round(xmin / self.W, 6),
            "bbox_ymin_norm":  round(ymin / self.H, 6),
            "bbox_xmax_norm":  round(xmax / self.W, 6),
            "bbox_ymax_norm":  round(ymax / self.H, 6),
            "bbox_width_norm":  round((xmax - xmin) / w_div, 6),
            "bbox_height_norm": round((ymax - ymin) / h_div, 6),
            "centroid_x":      round(cx, 3),
            "centroid_y":      round(cy, 3),
            "centroid_x_norm": round(cx / self.W, 6),
            "centroid_y_norm": round(cy / self.H, 6),
            "coverage":        round(area_ratio, 6),
            "solidity":        self._r(solidity),
            "extent":          self._r(extent),
            "eccentricity":    self._r(eccentricity),
            "perimeter":       round(perimeter, 3) if not np.isnan(perimeter) else np.nan,
            "compactness":     self._r(compactness),
        }

    # ── public API ────────────────────────────────────────────────────────
    def extract(self, label_mask: np.ndarray) -> Dict[str, Any]:
        """
        Extract features for ALL organs from the label mask.

        Args:
            label_mask: (H, W) uint8/int with values 0-3

        Returns:
            flat dict with keys like "liver_present", "liver_area_ratio", …
        """
        out: Dict[str, Any] = {}
        for organ, class_id in ORGAN_CLASS_MAP.items():
            organ_feats = self._extract_organ(label_mask, class_id, organ)
            for key, val in organ_feats.items():
                out[f"{organ}_{key}"] = val
        return out

    def build_numerical_vector(
        self,
        raw_features: Dict[str, Any],
        slice_position_norm: float = 0.5,
    ) -> np.ndarray:
        """
        Build the 34-dim numerical vector consumed by Module 3.

        Maps the 21 raw features per organ down to the 11 features
        expected by the TabularTransformer, fills NaN shape features
        with 0.0, and appends ``slice_position_norm``.

        Returns:
            np.ndarray of shape (34,) dtype float32
        """
        vec: List[float] = []
        for col in ALL_FEATURE_COLS:  # 33 columns
            val = raw_features.get(col, 0.0)
            # Convert bool to int
            if isinstance(val, bool):
                val = int(val)
            # Fill NaN shape features with 0.0
            feat_name = col.split("_", 1)[1] if "_" in col else col
            if feat_name in SHAPE_FEATS_FILLNA and (val is None or (isinstance(val, float) and np.isnan(val))):
                val = 0.0
            if val is None or (isinstance(val, float) and np.isnan(val)):
                val = 0.0
            vec.append(float(val))
        vec.append(float(slice_position_norm))
        return np.array(vec, dtype=np.float32)

    def get_organ_feature_dict(self, raw_features: Dict[str, Any]) -> Dict[str, Dict[str, Any]]:
        """Restructure flat feature dict into per-organ dicts."""
        result: Dict[str, Dict[str, Any]] = {}
        for organ in ORGANS:
            organ_feats: Dict[str, Any] = {}
            for key, val in raw_features.items():
                if key.startswith(f"{organ}_"):
                    short = key[len(organ) + 1:]
                    organ_feats[short] = val
            result[organ] = organ_feats
        return result


# ╔═════════════════════════════════════════════════════════════════════════╗
# ║         MODULE 3 — PRESENCE & QUALITY (TabularTransformer)             ║
# ╚═════════════════════════════════════════════════════════════════════════╝

# ── Transformer sub-modules ──────────────────────────────────────────────

class FeatureTokenizer(nn.Module):
    """Convert tabular row into a sequence of tokens for the Transformer."""

    def __init__(self, n_num: int, n_plane: int, n_organs: int, dim: int) -> None:
        super().__init__()
        self.w = nn.Parameter(torch.randn(n_num, dim) * 0.01)
        self.b = nn.Parameter(torch.zeros(n_num, dim))
        self.organ_emb = nn.Embedding(n_organs, dim)
        self.plane_proj = nn.Linear(n_plane, dim)
        self.cls = nn.Parameter(torch.randn(1, 1, dim) * 0.01)

    def forward(
        self, xn: torch.Tensor, xp: torch.Tensor, xo: torch.Tensor
    ) -> torch.Tensor:
        B = xn.size(0)
        num_tok = xn.unsqueeze(-1) * self.w + self.b       # (B, n_num, dim)
        org_tok = self.organ_emb(xo).unsqueeze(1)           # (B, 1, dim)
        pln_tok = self.plane_proj(xp).unsqueeze(1)           # (B, 1, dim)
        cls_tok = self.cls.expand(B, -1, -1)                 # (B, 1, dim)
        return torch.cat([cls_tok, num_tok, org_tok, pln_tok], dim=1)


class EncoderLayer(nn.Module):
    """Pre-LN Transformer encoder layer."""

    def __init__(self, dim: int, heads: int, ffn: int, drop: float) -> None:
        super().__init__()
        self.n1 = nn.LayerNorm(dim)
        self.attn = nn.MultiheadAttention(dim, heads, dropout=drop, batch_first=True)
        self.n2 = nn.LayerNorm(dim)
        self.ffn = nn.Sequential(
            nn.Linear(dim, ffn), nn.GELU(),
            nn.Dropout(drop), nn.Linear(ffn, dim), nn.Dropout(drop),
        )

    def forward(
        self, x: torch.Tensor
    ) -> Tuple[torch.Tensor, torch.Tensor]:
        h = self.n1(x)
        a, w = self.attn(h, h, h, need_weights=True, average_attn_weights=True)
        x = x + a
        x = x + self.ffn(self.n2(x))
        return x, w


class TabularTransformer(nn.Module):
    """
    Multi-task tabular Transformer for organ presence classification
    and quality score regression.

    Inputs:
        xn  – (B, n_num)     scaled numerical features
        xp  – (B, n_plane)   plane one-hot encoding
        xo  – (B,)           target organ index (int64)

    Outputs:
        logits  – (B, 3)     presence class logits (absent/partial/full)
        quality – (B, 1)     quality score in [0, 1]
    """

    def __init__(
        self,
        n_num: int = 34,
        n_plane: int = 3,
        n_organs: int = 3,
        dim: int = 64,
        heads: int = 8,
        layers: int = 4,
        ffn: int = 256,
        drop: float = 0.1,
    ) -> None:
        super().__init__()
        self.tok = FeatureTokenizer(n_num, n_plane, n_organs, dim)
        self.seq_len = 1 + n_num + 1 + 1  # CLS + num + organ + plane = 37
        self.pos = nn.Parameter(torch.randn(1, self.seq_len, dim) * 0.01)
        self.layers = nn.ModuleList(
            [EncoderLayer(dim, heads, ffn, drop) for _ in range(layers)]
        )
        self.norm = nn.LayerNorm(dim)
        self.head_cls = nn.Sequential(
            nn.Linear(dim, dim), nn.GELU(), nn.Dropout(drop), nn.Linear(dim, 3)
        )
        self.head_reg = nn.Sequential(
            nn.Linear(dim, dim), nn.GELU(), nn.Dropout(drop), nn.Linear(dim, 1)
        )

    def forward(
        self,
        xn: torch.Tensor,
        xp: torch.Tensor,
        xo: torch.Tensor,
        return_attn: bool = False,
    ) -> Union[Tuple[torch.Tensor, torch.Tensor], Tuple[torch.Tensor, torch.Tensor, torch.Tensor]]:
        x = self.tok(xn, xp, xo) + self.pos
        attn = None
        for layer in self.layers:
            x, attn = layer(x)
        cls = self.norm(x)[:, 0]
        logits = self.head_cls(cls)
        quality = torch.sigmoid(self.head_reg(cls))
        if return_attn:
            return logits, quality, attn
        return logits, quality


class PresenceQualityModel:
    """
    Module 3 wrapper — loads the TabularTransformer checkpoint + scaler
    using fold5 bundle configuration and metadata.
    """

    def __init__(
        self,
        bundle_dir: str = MODULE3_BUNDLE_DIR,
        device: torch.device = DEVICE,
    ) -> None:
        self.device = device
        self.model: Optional[TabularTransformer] = None
        self.scaler = None
        self.plane_cats: List[str] = []
        self.metadata: Dict[str, Any] = {}

        bundle_path = Path(bundle_dir)
        metadata_path = bundle_path / "fold5_metadata.json"

        if metadata_path.exists():
            try:
                with open(metadata_path, "r", encoding="utf-8") as f:
                    self.metadata = json.load(f)
                
                self.plane_cats = self.metadata.get("plane_cats", ["axial", "coronal", "sagittal"])
                
                # Checkpoint file path from metadata
                ckpt_filename = self.metadata.get("checkpoint_file", "best_fold5.pt")
                ckpt_path = bundle_path / ckpt_filename
                
                # Scaler file path from metadata
                scaler_filename = self.metadata.get("scaler_file", "scaler_fold5.pkl")
                scaler_path = bundle_path / scaler_filename

                if ckpt_path.exists():
                    ckpt = torch.load(ckpt_path, map_location=device, weights_only=False)
                    cfg = ckpt.get("cfg", {})
                    n_plane = len(self.plane_cats)

                    self.model = TabularTransformer(
                        n_num=len(self.metadata.get("numerical_feature_cols", [])),
                        n_plane=n_plane,
                        n_organs=cfg.get("n_organs", 3),
                        dim=cfg.get("embed_dim", 64),
                        heads=cfg.get("n_heads", 8),
                        layers=cfg.get("n_layers", 4),
                        ffn=cfg.get("ffn_dim", 256),
                        drop=cfg.get("dropout", 0.1),
                    )
                    self.model.load_state_dict(ckpt["state_dict"])
                    self.model.to(device).eval()
                    logger.info("Loaded Module 3 model from %s (planes=%s)", ckpt_path, self.plane_cats)
                else:
                    logger.warning("Module 3 checkpoint not found: %s", ckpt_path)

                if scaler_path.exists():
                    self.scaler = joblib.load(scaler_path)
                    logger.info("Loaded Module 3 scaler from %s", scaler_path)
                else:
                    logger.warning("Module 3 scaler not found: %s", scaler_path)

            except Exception as e:
                logger.error("Failed to load Module 3 bundle: %s", e)
        else:
            logger.warning(
                "Module 3 metadata NOT found at %s. Falling back to default initialization.",
                metadata_path
            )
            # Default fallback initialization:
            self.plane_cats = ["axial", "coronal", "sagittal"]
            self.model = TabularTransformer(
                n_num=N_NUM, n_plane=len(self.plane_cats),
            ).to(device).eval()

    # ── helpers ───────────────────────────────────────────────────────────
    def _plane_ohe(self, plane: str) -> np.ndarray:
        """One-hot encode the scan plane."""
        ohe = np.zeros(len(self.plane_cats), dtype=np.float32)
        if plane in self.plane_cats:
            ohe[self.plane_cats.index(plane)] = 1.0
        return ohe

    # ── per-organ prediction ─────────────────────────────────────────────
    def predict_organ(
        self,
        numerical_features: np.ndarray,
        organ: str,
        plane: str = "axial",
    ) -> Dict[str, Any]:
        """
        Predict presence & quality for one target organ.

        Args:
            numerical_features: (34,) float32 array (scaled or raw)
            organ:              one of "liver", "kidney", "gallbladder"
            plane:              scan plane string

        Returns:
            dict with organ, presence, presence_score, quality_score
        """
        assert self.model is not None

        # Scale if scaler available
        feat = numerical_features.reshape(1, -1).astype(np.float32)
        if self.scaler is not None:
            feat = self.scaler.transform(feat).astype(np.float32)

        xn = torch.from_numpy(feat).to(self.device)                              # (1, 34)
        xp = torch.from_numpy(self._plane_ohe(plane).reshape(1, -1)).to(self.device)  # (1, n_plane)
        xo = torch.tensor([ORGAN2IDX[organ]], dtype=torch.long, device=self.device)    # (1,)

        with torch.no_grad():
            logits, quality = self.model(xn, xp, xo)

        probs = torch.softmax(logits, dim=1).cpu().numpy()[0]
        pred_class = int(np.argmax(probs))

        return {
            "organ": organ,
            "presence": PRESENCE_CLASSES[pred_class],
            "presence_score": float(probs[pred_class]),
            "quality_score": float(quality.item()),
            "presence_probs": {
                "absent":  float(probs[0]),
                "partial": float(probs[1]),
                "full":    float(probs[2]),
            },
        }

    # ── batch (all organs) ───────────────────────────────────────────────
    def predict_all(
        self,
        numerical_features: np.ndarray,
        plane: str = "axial",
    ) -> Dict[str, Dict[str, Any]]:
        """
        Predict presence & quality for every organ.

        Returns:
            dict keyed by organ name with prediction dicts.
        """
        results: Dict[str, Dict[str, Any]] = {}
        for organ in ORGANS:
            results[organ] = self.predict_organ(numerical_features, organ, plane)
        logger.info(
            "Module 3 predictions: %s",
            {o: (r["presence"], f'{r["quality_score"]:.3f}') for o, r in results.items()},
        )
        return results


# ╔═════════════════════════════════════════════════════════════════════════╗
# ║                    STATE BUILDER  (Modules 2+3 → PPO)                  ║
# ╚═════════════════════════════════════════════════════════════════════════╝

class StateBuilder:
    """
    Convert Module 2 and Module 3 outputs into the 125-dim PPO
    observation vector.

    State layout:
      [0:3]     probe_x, probe_y, probe_z                        (3)
      [3:37]    34 numerical features (StandardScaler'd)          (34)
      [37:40]   organ one-hot                                     (3)
      [40:124]  local perception (filled with 0 for single-slice) (84)
      [124]     remaining step budget (normalised)                (1)
    """

    def __init__(self, scaler=None, max_steps: int = MAX_STEPS) -> None:
        self.scaler = scaler
        self.max_steps = max_steps
        self.state_dim = STATE_DIM

    def build(
        self,
        numerical_features: np.ndarray,
        organ: str,
        probe_x: float = 0.5,
        probe_y: float = 0.5,
        probe_z: float = 0.5,
        step_count: int = 0,
        local_obs: Optional[np.ndarray] = None,
    ) -> np.ndarray:
        """
        Assemble the full 125-dim state vector.

        Args:
            numerical_features: (34,) raw numerical feature vector
            organ:              target organ name
            probe_x/y/z:       current normalised probe coordinates
            step_count:         steps taken so far
            local_obs:          (84,) local perception; zeros if unavailable

        Returns:
            state: (125,) float32 numpy array
        """
        # Scale features
        feat = numerical_features.reshape(1, -1).astype(np.float32)
        if self.scaler is not None:
            feat = self.scaler.transform(feat).astype(np.float32)
        feat = feat.flatten()  # (34,)

        # Organ one-hot
        organ_oh = np.zeros(len(ORGANS), dtype=np.float32)
        organ_oh[ORGAN2IDX[organ]] = 1.0

        # Local observation (84-dim placeholder)
        if local_obs is None:
            local_obs = np.zeros(84, dtype=np.float32)

        # Step budget
        budget = np.array(
            [max(0, self.max_steps - step_count) / self.max_steps],
            dtype=np.float32,
        )

        state = np.concatenate([
            np.array([probe_x, probe_y, probe_z], dtype=np.float32),  # 3
            feat,                                                       # 34
            organ_oh,                                                   # 3
            local_obs,                                                  # 84
            budget,                                                     # 1
        ])  # = 125

        assert state.shape == (STATE_DIM,), f"State dim mismatch: {state.shape}"
        return state


# ╔═════════════════════════════════════════════════════════════════════════╗
# ║              MODULE 4 — PPO GUIDANCE AGENT                             ║
# ╚═════════════════════════════════════════════════════════════════════════╝

class GuidanceAgent:
    """
    Module 4 — PPO guidance agent using Stable-Baselines3.

    One PPO model per organ.  Selects movement actions
    (or ACQUIRE) in normalised 3-D probe space.
    """

    def __init__(
        self,
        model_paths: Optional[Dict[str, str]] = None,
        scaler_path: str = PPO_SCALER_PATH,
        device: torch.device = DEVICE,
    ) -> None:
        self.device = device
        self.models: Dict[str, Any] = {}  # organ -> SB3 PPO model
        self.state_builder: Optional[StateBuilder] = None

        # ── load scaler ──
        scaler = None
        if os.path.isfile(scaler_path):
            scaler = joblib.load(scaler_path)
            logger.info("Loaded PPO scaler from %s", scaler_path)
        else:
            logger.warning(
                "PPO scaler NOT found: %s — "
                "state features will NOT be scaled (replace placeholder!).",
                scaler_path,
            )
        self.state_builder = StateBuilder(scaler=scaler)

        # ── load per-organ PPO models ──
        if model_paths is None:
            model_paths = {
                "liver": LIVER_PPO_PATH,
                "kidney": KIDNEY_PPO_PATH,
                "gallbladder": GALLBLADDER_PPO_PATH,
            }

        try:
            from stable_baselines3 import PPO as SB3_PPO
            self._sb3_available = True
        except ImportError:
            logger.warning(
                "stable-baselines3 not installed. PPO models cannot be loaded. "
                "Install with: pip install stable-baselines3"
            )
            self._sb3_available = False
            return

        for organ, path in model_paths.items():
            path_obj = Path(path)
            if path_obj.exists():
                try:
                    if path_obj.is_dir():
                        logger.info("Found directory for '%s' PPO model: %s. Packing to load...", organ, path)
                        # Compress directory contents to a temporary zip file
                        with tempfile.NamedTemporaryFile(suffix=".zip", delete=False) as temp_zip:
                            temp_zip_path = temp_zip.name
                        
                        try:
                            with zipfile.ZipFile(temp_zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
                                for item in path_obj.iterdir():
                                    if item.is_file():
                                        zf.write(item, item.name)
                            
                            model = SB3_PPO.load(temp_zip_path, device=str(device))
                            self.models[organ] = model
                            logger.info("Loaded PPO model for '%s' from directory %s", organ, path)
                        finally:
                            if os.path.exists(temp_zip_path):
                                os.remove(temp_zip_path)
                    else:
                        model = SB3_PPO.load(str(path_obj), device=str(device))
                        self.models[organ] = model
                        logger.info("Loaded PPO model for '%s' from file %s", organ, path)
                except Exception as e:
                    logger.error("Failed to load PPO model for '%s' from %s: %s", organ, path, e)
            else:
                logger.warning(
                    "PPO model for '%s' NOT found: %s — "
                    "placeholder path, replace before running inference!",
                    organ, path,
                )

    # ── probe tracker ────────────────────────────────────────────────────
    class ProbeTracker:
        """Internal mutable probe state for a guidance session."""
        def __init__(self, x: float = 0.5, y: float = 0.5, z: float = 0.5) -> None:
            self.x = x
            self.y = y
            self.z = z
            self.step = 0

        def apply_action(self, action: int) -> None:
            if action == 0:
                self.x = float(np.clip(self.x + STEP_SIZE, 0.0, 1.0))
            elif action == 1:
                self.x = float(np.clip(self.x - STEP_SIZE, 0.0, 1.0))
            elif action == 2:
                self.y = float(np.clip(self.y + STEP_SIZE, 0.0, 1.0))
            elif action == 3:
                self.y = float(np.clip(self.y - STEP_SIZE, 0.0, 1.0))
            elif action == 4:
                self.z = float(np.clip(self.z + STEP_SIZE, 0.0, 1.0))
            elif action == 5:
                self.z = float(np.clip(self.z - STEP_SIZE, 0.0, 1.0))
            # action 6 = ACQUIRE: no movement
            self.step += 1

    # ── single-step guidance ─────────────────────────────────────────────
    def get_guidance(
        self,
        numerical_features: np.ndarray,
        organ: str,
        probe: Optional["GuidanceAgent.ProbeTracker"] = None,
    ) -> Dict[str, Any]:
        """
        Get a single guidance recommendation.

        Args:
            numerical_features: (34,) raw feature vector
            organ:              target organ
            probe:              ProbeTracker (created internally if None)

        Returns:
            dict with action, action_text, confidence, probe_position, step
        """
        if probe is None:
            probe = self.ProbeTracker()

        if organ not in self.models:
            logger.warning("No PPO model loaded for '%s' — returning ACQUIRE.", organ)
            return {
                "action": "ACQUIRE",
                "action_id": 6,
                "action_text": GUIDANCE_TEXT[6],
                "confidence": 0.0,
                "probe_position": [probe.x, probe.y, probe.z],
                "step": probe.step,
            }

        assert self.state_builder is not None
        state = self.state_builder.build(
            numerical_features, organ,
            probe.x, probe.y, probe.z, probe.step,
        )

        model = self.models[organ]
        action, _states = model.predict(state, deterministic=True)
        action = int(action)

        # Compute confidence from action probabilities
        obs_tensor = torch.as_tensor(state, dtype=torch.float32).unsqueeze(0).to(self.device)
        try:
            dist = model.policy.get_distribution(obs_tensor)
            action_probs = dist.distribution.probs.detach().cpu().numpy()[0]
            confidence = float(action_probs[action])
        except Exception:
            confidence = 1.0 / N_ACTIONS  # uniform fallback

        probe.apply_action(action)
        action_short, action_desc = ACTION_MAP[action]

        return {
            "action": action_short,
            "action_id": action,
            "action_text": GUIDANCE_TEXT[action],
            "confidence": round(confidence, 4),
            "probe_position": [probe.x, probe.y, probe.z],
            "step": probe.step,
        }


# ╔═════════════════════════════════════════════════════════════════════════╗
# ║                   MAIN PIPELINE ORCHESTRATOR                           ║
# ╚═════════════════════════════════════════════════════════════════════════╝

class UltrasoundPipeline:
    """
    End-to-end inference pipeline.

    Usage:
        pipeline = UltrasoundPipeline()
        result = pipeline.run("sample_ct.png")
        print(result)
    """

    def __init__(
        self,
        seg_model_path:  str = SEGMENTATION_MODEL_PATH,
        m3_bundle_dir:   str = MODULE3_BUNDLE_DIR,
        ppo_model_paths: Optional[Dict[str, str]] = None,
        ppo_scaler_path: str = PPO_SCALER_PATH,
        device: torch.device = DEVICE,
    ) -> None:
        logger.info("=" * 60)
        logger.info("  Initialising AI-Guided Ultrasound Pipeline")
        logger.info("=" * 60)

        self.device = device

        # Module 1
        self.segmenter = SegmentationModel(seg_model_path, device)

        # Module 2
        self.feature_extractor = FeatureExtractor()

        # Module 3
        self.pq_model = PresenceQualityModel(m3_bundle_dir, device)

        # Module 4
        self.guidance = GuidanceAgent(ppo_model_paths, ppo_scaler_path, device)

        logger.info("Pipeline initialisation complete.\n")

    # ── helpers ───────────────────────────────────────────────────────────
    @staticmethod
    def _select_best_organ(m3_results: Dict[str, Dict[str, Any]]) -> str:
        """Pick the organ with the highest quality score among those present."""
        best_organ = ORGANS[0]
        best_q = -1.0
        for organ, res in m3_results.items():
            if res["presence"] != "absent" and res["quality_score"] > best_q:
                best_q = res["quality_score"]
                best_organ = organ
        return best_organ

    # ── main run array ────────────────────────────────────────────────────
    def run_array(
        self,
        ct_image_array: np.ndarray,
        target_organ: Optional[str] = None,
        plane: str = "axial",
        slice_position_norm: float = 0.5,
    ) -> Dict[str, Any]:
        """
        Run the full inference pipeline on an in-memory CT slice array.
        """
        logger.info("Running pipeline on in-memory array")

        # ── Module 1: Segmentation ───────────────────────────────────────
        try:
            mask, probs, organ_info, preprocessed = self.segmenter.predict_array(ct_image_array)
        except Exception as e:
            logger.error("Module 1 (Segmentation) failed: %s", e)
            return {"error": f"Segmentation failed: {e}"}

        # Resize mask to model resolution for feature extraction
        mask_384 = cv2.resize(
            mask.astype(np.float32),
            (IMAGE_SIZE, IMAGE_SIZE),
            interpolation=cv2.INTER_NEAREST,
        ).astype(np.int32)

        # ── Module 2: Feature Extraction ─────────────────────────────────
        try:
            raw_features = self.feature_extractor.extract(mask_384)
            numerical_vec = self.feature_extractor.build_numerical_vector(
                raw_features, slice_position_norm=slice_position_norm
            )
            organ_features = self.feature_extractor.get_organ_feature_dict(raw_features)
        except Exception as e:
            logger.error("Module 2 (Feature Extraction) failed: %s", e)
            return {"error": f"Feature extraction failed: {e}"}

        # ── Module 3: Presence & Quality ─────────────────────────────────
        try:
            m3_results = self.pq_model.predict_all(numerical_vec, plane=plane)
        except Exception as e:
            logger.error("Module 3 (Presence & Quality) failed: %s", e)
            return {"error": f"Presence/Quality model failed: {e}"}

        # ── select target organ ──────────────────────────────────────────
        if target_organ is None:
            target_organ = self._select_best_organ(m3_results)
        elif target_organ not in ORGANS:
            logger.warning("Unknown organ '%s', defaulting to '%s'", target_organ, ORGANS[0])
            target_organ = ORGANS[0]

        # ── Module 4: PPO Guidance ───────────────────────────────────────
        try:
            guidance_result = self.guidance.get_guidance(
                numerical_vec, target_organ
            )
        except Exception as e:
            logger.error("Module 4 (Guidance) failed: %s", e)
            guidance_result = {
                "action": "ACQUIRE",
                "action_id": 6,
                "action_text": GUIDANCE_TEXT[6],
                "confidence": 0.0,
                "probe_position": [0.5, 0.5, 0.5],
                "step": 0,
            }

        # ── Assemble final result ────────────────────────────────────────
        organ_m3 = m3_results.get(target_organ, {})

        result: Dict[str, Any] = {
            # top-level summary
            "organ":      target_organ,
            "presence":   organ_m3.get("presence", "unknown"),
            "quality":    round(organ_m3.get("quality_score", 0.0), 4),
            "action":     guidance_result.get("action_text", "ACQUIRE"),
            "confidence": guidance_result.get("confidence", 0.0),
            # detailed sub-results
            "details": {
                "segmentation": organ_info,
                "features": {
                    "numerical_vector_dim": len(numerical_vec),
                    "organ_features": {
                        organ: {
                            "present": feats.get("present", False),
                            "area_ratio": feats.get("area_ratio", 0.0),
                        }
                        for organ, feats in organ_features.items()
                    },
                },
                "presence_quality": m3_results,
                "guidance": guidance_result,
            },
        }

        logger.info(
            "Pipeline array result → organ=%s  presence=%s  quality=%.3f  action=%s  conf=%.3f",
            result["organ"], result["presence"], result["quality"],
            result["action"], result["confidence"],
        )
        return result

    # ── main run ──────────────────────────────────────────────────────────
    def run(
        self,
        ct_image_path: str,
        target_organ: Optional[str] = None,
        plane: str = "axial",
        slice_position_norm: float = 0.5,
    ) -> Dict[str, Any]:
        """
        Run the full inference pipeline on a single CT image.

        Args:
            ct_image_path:       path to CT slice (grayscale PNG / JPG)
            target_organ:        organ to guide to (auto-selected if None)
            plane:               scan plane ("axial", "coronal", "sagittal")
            slice_position_norm: normalised position of this slice [0,1]

        Returns:
            dict with keys: organ, presence, quality, action, confidence,
            plus detailed sub-results from each module.
        """
        logger.info("Running pipeline on: %s", ct_image_path)

        # ── Module 1: Segmentation ───────────────────────────────────────
        try:
            mask, probs, organ_info, preprocessed = self.segmenter.predict(ct_image_path)
        except Exception as e:
            logger.error("Module 1 (Segmentation) failed: %s", e)
            return {"error": f"Segmentation failed: {e}"}

        # Resize mask to model resolution for feature extraction
        mask_384 = cv2.resize(
            mask.astype(np.float32),
            (IMAGE_SIZE, IMAGE_SIZE),
            interpolation=cv2.INTER_NEAREST,
        ).astype(np.int32)

        # ── Module 2: Feature Extraction ─────────────────────────────────
        try:
            raw_features = self.feature_extractor.extract(mask_384)
            numerical_vec = self.feature_extractor.build_numerical_vector(
                raw_features, slice_position_norm=slice_position_norm
            )
            organ_features = self.feature_extractor.get_organ_feature_dict(raw_features)
        except Exception as e:
            logger.error("Module 2 (Feature Extraction) failed: %s", e)
            return {"error": f"Feature extraction failed: {e}"}

        # ── Module 3: Presence & Quality ─────────────────────────────────
        try:
            m3_results = self.pq_model.predict_all(numerical_vec, plane=plane)
        except Exception as e:
            logger.error("Module 3 (Presence & Quality) failed: %s", e)
            return {"error": f"Presence/Quality model failed: {e}"}

        # ── select target organ ──────────────────────────────────────────
        if target_organ is None:
            target_organ = self._select_best_organ(m3_results)
        elif target_organ not in ORGANS:
            logger.warning("Unknown organ '%s', defaulting to '%s'", target_organ, ORGANS[0])
            target_organ = ORGANS[0]

        # ── Module 4: PPO Guidance ───────────────────────────────────────
        try:
            guidance_result = self.guidance.get_guidance(
                numerical_vec, target_organ
            )
        except Exception as e:
            logger.error("Module 4 (Guidance) failed: %s", e)
            guidance_result = {
                "action": "ACQUIRE",
                "action_id": 6,
                "action_text": GUIDANCE_TEXT[6],
                "confidence": 0.0,
                "probe_position": [0.5, 0.5, 0.5],
                "step": 0,
            }

        # ── Assemble final result ────────────────────────────────────────
        organ_m3 = m3_results.get(target_organ, {})

        result: Dict[str, Any] = {
            # top-level summary
            "organ":      target_organ,
            "presence":   organ_m3.get("presence", "unknown"),
            "quality":    round(organ_m3.get("quality_score", 0.0), 4),
            "action":     guidance_result.get("action_text", "ACQUIRE"),
            "confidence": guidance_result.get("confidence", 0.0),
            # detailed sub-results
            "details": {
                "segmentation": organ_info,
                "features": {
                    "numerical_vector_dim": len(numerical_vec),
                    "organ_features": {
                        organ: {
                            "present": feats.get("present", False),
                            "area_ratio": feats.get("area_ratio", 0.0),
                        }
                        for organ, feats in organ_features.items()
                    },
                },
                "presence_quality": m3_results,
                "guidance": guidance_result,
            },
        }

        logger.info(
            "Pipeline result → organ=%s  presence=%s  quality=%.3f  action=%s  conf=%.3f",
            result["organ"], result["presence"], result["quality"],
            result["action"], result["confidence"],
        )
        return result


from pydantic import BaseModel, Field

# ── request / response models ──
class GuidanceRequest(BaseModel):
    image_path: str = Field(..., description="Path to CT slice image")
    target_organ: Optional[str] = Field(None, description="Target organ (auto if null)")
    plane: str = Field("axial", description="Scan plane: axial, coronal, sagittal")
    slice_position_norm: float = Field(0.5, ge=0.0, le=1.0, description="Normalised slice position")

class GuidanceResponse(BaseModel):
    organ: str
    presence: str
    quality: float
    action: str
    confidence: float
    details: Optional[Dict[str, Any]] = None

class HealthResponse(BaseModel):
    status: str
    device: str
    modules_loaded: Dict[str, bool]


# ╔═════════════════════════════════════════════════════════════════════════╗
# ║                       FASTAPI INTEGRATION                              ║
# ╚═════════════════════════════════════════════════════════════════════════╝

def create_app() -> "FastAPI":
    """Create and return the FastAPI application."""
    from fastapi import FastAPI, HTTPException
    from fastapi.middleware.cors import CORSMiddleware

    app = FastAPI(
        title="AI-Guided Ultrasound Training System",
        description="Real-time inference API for CT-based ultrasound guidance.",
        version="1.0.0",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # ── lazy-load pipeline on first request ──
    _pipeline_cache: Dict[str, Optional[UltrasoundPipeline]] = {"instance": None}

    def get_pipeline() -> UltrasoundPipeline:
        if _pipeline_cache["instance"] is None:
            _pipeline_cache["instance"] = UltrasoundPipeline()
        return _pipeline_cache["instance"]

    # ── endpoints ──
    @app.get("/", tags=["Info"])
    async def root() -> Dict[str, str]:
        return {
            "service": "AI-Guided Ultrasound Training System",
            "version": "1.0.0",
            "docs": "/docs",
        }

    @app.get("/health", response_model=HealthResponse, tags=["Info"])
    async def health() -> HealthResponse:
        pipe = get_pipeline()
        return HealthResponse(
            status="healthy",
            device=str(pipe.device),
            modules_loaded={
                "segmentation": pipe.segmenter.model is not None,
                "presence_quality": pipe.pq_model.model is not None,
                "ppo_liver": "liver" in pipe.guidance.models,
                "ppo_kidney": "kidney" in pipe.guidance.models,
                "ppo_gallbladder": "gallbladder" in pipe.guidance.models,
            },
        )

    @app.post("/guidance", response_model=GuidanceResponse, tags=["Inference"])
    async def guidance(req: GuidanceRequest) -> GuidanceResponse:
        """
        Run full pipeline inference on a single CT slice.

        Input:
            image_path:       path to CT PNG/JPG
            target_organ:     (optional) organ to guide to
            plane:            scan plane
            slice_position_norm: normalised z-position

        Output:
            organ, presence, quality, action, confidence, details
        """
        if not os.path.isfile(req.image_path):
            raise HTTPException(status_code=404, detail=f"Image not found: {req.image_path}")

        pipe = get_pipeline()
        result = pipe.run(
            ct_image_path=req.image_path,
            target_organ=req.target_organ,
            plane=req.plane,
            slice_position_norm=req.slice_position_norm,
        )

        if "error" in result:
            raise HTTPException(status_code=500, detail=result["error"])

        return GuidanceResponse(**result)

    return app


# ╔═════════════════════════════════════════════════════════════════════════╗
# ║                           CLI ENTRY POINT                              ║
# ╚═════════════════════════════════════════════════════════════════════════╝

def main() -> None:
    import argparse

    parser = argparse.ArgumentParser(
        description="AI-Guided Ultrasound Training System — Inference Pipeline"
    )
    parser.add_argument(
        "--image", type=str, default=None,
        help="Path to a CT slice image for single-image inference.",
    )
    parser.add_argument(
        "--organ", type=str, default=None,
        help="Target organ (liver, kidney, gallbladder). Auto-selected if omitted.",
    )
    parser.add_argument(
        "--plane", type=str, default="axial",
        help="Scan plane (axial, coronal, sagittal). Default: axial.",
    )
    parser.add_argument(
        "--host", type=str, default="0.0.0.0",
        help="FastAPI host. Default: 0.0.0.0",
    )
    parser.add_argument(
        "--port", type=int, default=8000,
        help="FastAPI port. Default: 8000",
    )
    args = parser.parse_args()

    if args.image:
        # ── CLI mode: single-image inference ──
        pipeline = UltrasoundPipeline()
        result = pipeline.run(
            ct_image_path=args.image,
            target_organ=args.organ,
            plane=args.plane,
        )
        print(json.dumps(result, indent=2, default=str))
    else:
        # ── Server mode: FastAPI ──
        try:
            import uvicorn
        except ImportError:
            print("uvicorn is required for server mode: pip install uvicorn")
            sys.exit(1)

        app = create_app()
        logger.info("Starting FastAPI server on %s:%d", args.host, args.port)
        uvicorn.run(app, host=args.host, port=args.port)


if __name__ == "__main__":
    main()
