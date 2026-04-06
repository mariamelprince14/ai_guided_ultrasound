"""
renderer.py
───────────
Converts a raw CT slice (HU float32 array) into a visually realistic
ultrasound-like PNG image, with optional segmentation overlay.

Steps:
  1. Window/Level the CT values (HU → 0-255)
  2. Apply ultrasound-like appearance:
     - Speckle noise
     - Slight blurring + edge sharpening
     - Depth attenuation gradient
  3. Overlay segmentation mask with semi-transparent color coding
  4. Encode to PNG bytes (returned as bytes for HTTP or base64 for WebSocket)
"""
from __future__ import annotations

import base64
import io
import logging
from typing import Optional

import numpy as np
from PIL import Image, ImageFilter, ImageEnhance

logger = logging.getLogger(__name__)

# Color palette for segmentation labels (RGBA)
SEG_COLORS: dict[int, tuple[int, int, int, int]] = {
    1: (255,  80,  80, 160),   # Red   — Structure 1
    2: ( 80, 200, 255, 160),   # Cyan  — Structure 2
    3: ( 80, 255, 120, 160),   # Green — Structure 3
    4: (255, 200,  60, 160),   # Gold  — Structure 4
    5: (200,  80, 255, 160),   # Violet
    6: (255, 150,  50, 160),   # Orange
    7: ( 50, 150, 255, 160),   # Blue
    8: (255, 255,  80, 160),   # Yellow
}
DEFAULT_SEG_COLOR = (200, 200, 200, 130)


def window_level(
    arr: np.ndarray,
    wl: float = 60.0,      # window level (center) in HU
    ww: float = 360.0,     # window width in HU
) -> np.ndarray:
    """
    Apply window/level clipping and rescale to [0, 255] uint8.
    Defaults are suitable for soft-tissue / abdominal view.
    """
    lo = wl - ww / 2.0
    hi = wl + ww / 2.0
    clipped = np.clip(arr, lo, hi)
    scaled = ((clipped - lo) / (hi - lo) * 255.0).astype(np.uint8)
    return scaled


def apply_ultrasound_appearance(img_arr: np.ndarray) -> np.ndarray:
    """
    Apply lightweight ultrasound-like post-processing to a uint8 grayscale array.
    Returns uint8 array of same shape.
    """
    H, W = img_arr.shape

    # --- Speckle noise (multiplicative) ---
    rng = np.random.default_rng(seed=42)   # fixed seed for reproducibility
    noise = rng.normal(loc=1.0, scale=0.045, size=(H, W))
    noisy = np.clip(img_arr.astype(np.float32) * noise, 0, 255).astype(np.uint8)

    # --- Depth attenuation gradient (darker at bottom = deeper tissue) ---
    gradient = np.linspace(1.0, 0.65, H, dtype=np.float32)[:, np.newaxis]
    attenuated = np.clip(noisy.astype(np.float32) * gradient, 0, 255).astype(np.uint8)

    # --- PIL for blur/sharpen ---
    pil_img = Image.fromarray(attenuated, mode='L')
    pil_img = pil_img.filter(ImageFilter.GaussianBlur(radius=0.6))
    pil_img = pil_img.filter(ImageFilter.UnsharpMask(radius=1, percent=60, threshold=2))
    enhancer = ImageEnhance.Contrast(pil_img)
    pil_img = enhancer.enhance(1.25)

    return np.array(pil_img, dtype=np.uint8)


def render_slice(
    ct_slice: np.ndarray,
    seg_slice: Optional[np.ndarray] = None,
    show_segmentation: bool = False,
    window_level_params: tuple[float, float] = (60.0, 360.0),
    apply_us_appearance: bool = True,
    output_size: tuple[int, int] = (512, 512),   # (W, H)
) -> bytes:
    """
    Full render pipeline. Returns raw PNG bytes.
    """
    wl, ww = window_level_params

    # 1. Window/level
    gray = window_level(ct_slice, wl=wl, ww=ww)

    # 2. Ultrasound appearance
    if apply_us_appearance:
        gray = apply_ultrasound_appearance(gray)

    # 3. Resize if needed
    if gray.shape[::-1] != output_size:
        pil_gray = Image.fromarray(gray, mode='L').resize(output_size, Image.BILINEAR)
        gray = np.array(pil_gray)

    # 4. Convert to RGBA for overlay
    rgba = Image.fromarray(gray, mode='L').convert('RGBA')
    rgb_arr = np.array(rgba, dtype=np.uint8)  # (H, W, 4)

    # 5. Segmentation overlay
    if show_segmentation and seg_slice is not None:
        if seg_slice.shape[::-1] != output_size:
            seg_pil = Image.fromarray(seg_slice.astype(np.uint8), mode='L').resize(
                output_size, Image.NEAREST)
            seg_arr = np.array(seg_pil, dtype=np.int16)
        else:
            seg_arr = seg_slice.astype(np.int16)

        overlay = np.zeros((*seg_arr.shape, 4), dtype=np.uint8)
        for label_id, color in SEG_COLORS.items():
            mask = seg_arr == label_id
            if mask.any():
                overlay[mask] = color
        # Alpha blend
        alpha = overlay[:, :, 3:4].astype(np.float32) / 255.0
        rgb_arr[:, :, :3] = np.clip(
            rgb_arr[:, :, :3].astype(np.float32) * (1 - alpha)
            + overlay[:, :, :3].astype(np.float32) * alpha,
            0, 255
        ).astype(np.uint8)

    # 6. Encode to PNG bytes
    result_img = Image.fromarray(rgb_arr, mode='RGBA')
    buf = io.BytesIO()
    result_img.save(buf, format='PNG', optimize=False)
    return buf.getvalue()


def render_to_base64(
    ct_slice: np.ndarray,
    seg_slice: Optional[np.ndarray] = None,
    show_segmentation: bool = False,
    window_level_params: tuple[float, float] = (60.0, 360.0),
    apply_us_appearance: bool = True,
    output_size: tuple[int, int] = (512, 512),
) -> str:
    """Render and return base64-encoded PNG string (no data: prefix)."""
    png_bytes = render_slice(
        ct_slice,
        seg_slice=seg_slice,
        show_segmentation=show_segmentation,
        window_level_params=window_level_params,
        apply_us_appearance=apply_us_appearance,
        output_size=output_size,
    )
    return base64.b64encode(png_bytes).decode('ascii')
