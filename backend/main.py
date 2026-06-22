"""
main.py
───────
FastAPI backend for the AI-Guided Ultrasound Training System.
Integrated with a Deep Learning Pure Axial Translation Engine (Pix2Pix).

Endpoints:
  GET  /api/cases                  → list all discovered CT cases
  POST /api/session/create         → load a case, return session info
  GET  /api/session/{id}           → get session status
  POST /api/session/{id}/stop      → end session
  POST /api/slice                  → on-demand slice (polling fallback)
  POST /api/capture                → save current frame + pose
  GET  /api/captures/{session_id}  → list captures
  WS   /ws/{session_id}            --> real-time probe-->frame streaming
"""

from __future__ import annotations

import logging
import time
import uuid
import os
import cv2
import base64
import asyncio
from pathlib import Path
from contextlib import asynccontextmanager
from typing import Optional, Any

import numpy as np
import torch
import torch.nn as nn
import torchvision.transforms.functional as TF
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from fastapi import Response

import case_manager
import capture as capture_mod
from probe_controller import ProbePose, pose_to_matrix, default_axial_matrix
from reslicer import get_downsampled_volume, build_affine_inverse, compute_volume_bounds_world
from Pipeline.full_pipeline import UltrasoundPipeline

# ── Logging ───────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
)
logger = logging.getLogger(__name__)

# ── 1. Pure Axial Generator Neural Network Architecture ───────────────────────
class DownBlock(nn.Module):
    def __init__(self, in_ch, out_ch, norm=True):
        super().__init__()
        layers: list[nn.Module] = [nn.Conv2d(in_ch, out_ch, 4, 2, 1, bias=False)]
        if norm: layers.append(nn.BatchNorm2d(out_ch))
        layers.append(nn.LeakyReLU(0.2, inplace=True))
        self.net = nn.Sequential(*layers)
    def forward(self, x): return self.net(x)

class UpBlock(nn.Module):
    def __init__(self, in_ch, out_ch, dropout=False):
        super().__init__()
        layers: list[nn.Module] = [
            nn.ConvTranspose2d(in_ch, out_ch, 4, 2, 1, bias=False),
            nn.BatchNorm2d(out_ch),
            nn.ReLU(inplace=True),
        ]
        if dropout: layers.append(nn.Dropout(0.5))
        self.net = nn.Sequential(*layers)
    def forward(self, x, skip): return torch.cat([self.net(x), skip], dim=1)

class UNetGenerator(nn.Module):
    def __init__(self):
        super().__init__()
        self.d1, self.d2, self.d3, self.d4 = DownBlock(5, 64, norm=False), DownBlock(64, 128), DownBlock(128, 256), DownBlock(256, 512)
        self.d5, self.d6, self.d7, self.d8 = DownBlock(512, 512), DownBlock(512, 512), DownBlock(512, 512), DownBlock(512, 512, norm=False)
        self.u1, self.u2, self.u3, self.u4 = UpBlock(512, 512, dropout=True), UpBlock(1024, 512, dropout=True), UpBlock(1024, 512, dropout=True), UpBlock(1024, 512)
        self.u5, self.u6, self.u7 = UpBlock(1024, 256), UpBlock(512, 128), UpBlock(256, 64)
        self.final = nn.Sequential(nn.ConvTranspose2d(128, 1, 4, 2, 1), nn.Tanh())

    def forward(self, x):
        d1 = self.d1(x); d2 = self.d2(d1); d3 = self.d3(d2); d4 = self.d4(d3)
        d5 = self.d5(d4); d6 = self.d6(d5); d7 = self.d7(d6); d8 = self.d8(d7)
        u1 = self.u1(d8, d7); u2 = self.u2(u1, d6); u3 = self.u3(u2, d5); u4 = self.u4(u3, d4)
        u5 = self.u5(u4, d3); u6 = self.u6(u5, d2); u7 = self.u7(u6, d1)
        return self.final(u7)

# ── 2. Global Neural Engine Initialization ────────────────────────────────────
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
WEIGHTS_PATH = os.path.join(os.path.dirname(__file__), "weights/generator_final.pth")

G_axial = UNetGenerator().to(DEVICE)

# --- Lazy loaded AI guidance pipeline ---
_pipeline_instance: Optional[UltrasoundPipeline] = None

def get_pipeline() -> UltrasoundPipeline:
    global _pipeline_instance
    if _pipeline_instance is None:
        logger.info("⚡ Lazy-loading AI Guidance Pipeline weights (CPU/GPU)...")
        _pipeline_instance = UltrasoundPipeline()
        logger.info("🎯 AI Guidance Pipeline fully initialized.")
    return _pipeline_instance

async def run_ai_pipeline_async(
    session_id: str,
    volume: Any,
    probe_matrix: np.ndarray,
    ct_slice_u8: np.ndarray,
    z_idx: int,
    max_z: int,
    websocket: WebSocket,
):
    s = sessions.get(session_id)
    if not s or s.get("ai_in_progress"):
        return

    now = time.time()
    if now - s.get("last_ai_time", 0.0) < 0.4:
        return

    s["ai_in_progress"] = True
    s["last_ai_time"] = now

    cfg = s.get("config", {})
    target_organ = None
    target_organs = cfg.get("targetOrgans", [])
    if target_organs and len(target_organs) > 0:
        organ_candidate = target_organs[0].lower()
        if organ_candidate in ["liver", "kidney", "gallbladder"]:
            target_organ = organ_candidate

    slice_position_norm = float(z_idx) / float(max_z) if max_z > 0 else 0.5

    loop = asyncio.get_running_loop()
    try:
        pipeline = get_pipeline()
        def run_sync():
            return pipeline.run_array(
                ct_image_array=ct_slice_u8,
                target_organ=target_organ,
                plane="axial",
                slice_position_norm=slice_position_norm,
            )

        result = await loop.run_in_executor(None, run_sync)
        if "error" in result:
            logger.error(f"AI Pipeline error: {result['error']}")
            return

        quality_score = float(result.get("quality", 0.0)) * 100.0
        presence = result.get("presence", "unknown")
        organ = result.get("organ", "kidney")
        view_label = f"Axial {organ.capitalize()} ({presence.capitalize()})"
        action = result.get("action", "ACQUIRE")
        guidance_steps = [action]

        pq_details = result.get("details", {}).get("presence_quality", {})
        progress_checklist = {
            "targetCentered": presence == "full",
            "depthAppropriate": quality_score > 25.0,
            "shadowingReduced": True,
        }
        for o, res in pq_details.items():
            progress_checklist[f"{o}Visible"] = res.get("presence") != "absent"

        justification = f"The deep learning guidance agent recommends: {action}. Currently scanning the {organ} with quality {quality_score:.1f}%."

        feedback_data = {
            "qualityScore": quality_score,
            "viewLabel": view_label,
            "guidanceSteps": guidance_steps,
            "justification": justification,
            "progressChecklist": progress_checklist,
        }

        await websocket.send_json({
            "type": "aiFeedback",
            "data": feedback_data
        })
    except Exception as e:
        logger.error(f"Error in async AI pipeline executor: {e}", exc_info=True)
    finally:
        s["ai_in_progress"] = False

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Initializing case manager...")
    case_manager.initialize()
    
    logger.info(f"Loading Neural Inference Framework onto Device: {DEVICE.upper()}")
    if os.path.exists(WEIGHTS_PATH):
        G_axial.load_state_dict(torch.load(WEIGHTS_PATH, map_location=DEVICE))
        G_axial.eval()
        logger.info(f"🎯 Successfully bound pre-trained weights file: {os.path.basename(WEIGHTS_PATH)}")
    else:
        logger.warning(f"⚠️ Missing pre-trained weights at {WEIGHTS_PATH}. Running standalone container in debug mode.")
    
    logger.info("Backend ready.")
    yield
    logger.info("Shutting down backend...")

app = FastAPI(
    title="AI Ultrasound Training Simulator",
    description="Professional ultrasound simulation backend with deep learning engine integration",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── In-memory session store ───────────────────────────────────────────────────
sessions: dict[str, dict] = {}

# ── Phone connection tracking ─────────────────────────────────────────────────
# Maps session_id → phone WebSocket (only 1 phone per session)
phone_connections: dict[str, WebSocket] = {}
# Maps session_id → main frontend WebSocket (for relaying frames)
frontend_connections: dict[str, WebSocket] = {}

def _default_session_settings() -> dict:
    return {
        "wl": 40.0,
        "ww": 400.0,
        "show_seg": False,
        "plane_size_mm": 150.0,
        "resolution": 256,
        "pressure": 0.0,
        "contact_quality": 100.0,
        "probe_type": "curvilinear",
        "yaw": 0.0,
        "pitch": 0.0,
        "roll": 0.0,
    }

# ── 3. High Performance Neural Slice Generator Utility ────────────────────────

# Cache for per-volume normalization bounds (matches training's normalize_volume)
_volume_norm_cache: dict[int, tuple[float, float]] = {}

def _get_volume_norm_bounds(volume_array: np.ndarray) -> tuple[float, float]:
    """
    Compute percentile-based normalization bounds for the entire volume.
    This matches the training pipeline's normalize_volume(volume, clip_percentile=0.5):
        lo = np.percentile(volume, 0.5)
        hi = np.percentile(volume, 99.5)
    Cached per volume (keyed by array id) to avoid recomputation each frame.
    """
    vol_id = id(volume_array)
    if vol_id not in _volume_norm_cache:
        lo = float(np.percentile(volume_array, 0.5))
        hi = float(np.percentile(volume_array, 99.5))
        if hi - lo < 1e-8:
            hi = lo + 1.0
        _volume_norm_cache[vol_id] = (lo, hi)
        logger.info(f"Volume normalization bounds (percentile 0.5/99.5): [{lo:.1f}, {hi:.1f}]")
    return _volume_norm_cache[vol_id]


def infer_ultrasound_slice(volume, affine_inv, probe_matrix, wl=40, ww=400, probe_type="curvilinear"):
    """
    Extracts a 5-channel 2.5D axial slab from the CT volume, preprocesses it
    identically to the training pipeline, runs model inference, and returns
    the predicted ultrasound frame.
    
    Training preprocessing (from CT_to_US_Pix2Pix_MultiPlanar.ipynb):
        1. normalize_volume: clip at 0.5th/99.5th percentile → scale to [0, 1]
        2. Dataset.__getitem__: resize to 256×256, then scale [0,1] → [-1,1]
    """
    volume_array = volume.array
    # 1. Map world coordinates → voxel coordinates
    world_translation = np.array([probe_matrix[0, 3], probe_matrix[1, 3], probe_matrix[2, 3], 1.0])
    voxel_coords = affine_inv @ world_translation
    
    # The volume is stored as (Z, Y, X) after transpose in volume_loader.
    # voxel_coords gives [X, Y, Z] in nibabel order; after transpose:
    #   shape[0] = Z (axial),  shape[1] = Y (coronal),  shape[2] = X (sagittal)
    z_idx = int(round(voxel_coords[2]))
    y_idx = int(round(voxel_coords[1]))
    x_idx = int(round(voxel_coords[0]))
    max_z = volume_array.shape[0]
    max_y = volume_array.shape[1]
    max_x = volume_array.shape[2]
    
    # Boundary clamp to ensure valid 5-slice slab extraction (axial)
    z_idx = max(2, min(z_idx, max_z - 3))
    # Clamp coronal/sagittal to valid volume bounds
    y_idx_clamped = max(0, min(y_idx, max_y - 1))
    x_idx_clamped = max(0, min(x_idx, max_x - 1))
    
    # 2. Get volume-level normalization bounds (matches training's normalize_volume)
    lo, hi = _get_volume_norm_bounds(volume_array)
    
    # 3. Extract 5-channel 2.5D slab with training-matched preprocessing
    ct_slices = []
    center_norm_01 = None
    for offset in [-2, -1, 0, 1, 2]:
        raw_slice = volume_array[z_idx + offset, :, :]
        
        # Step A: Percentile clip + scale to [0, 1] (matches normalize_volume)
        clipped = np.clip(raw_slice, lo, hi)
        norm_01 = ((clipped - lo) / (hi - lo)).astype(np.float32)
        
        if offset == 0:
            center_norm_01 = norm_01
            
        # Step B: Resize to 256×256 (matches Dataset.__getitem__)
        tensor_slice = torch.from_numpy(norm_01).unsqueeze(0)  # [1, H, W]
        resized_slice = TF.resize(tensor_slice, [256, 256], antialias=True)
        
        # Step C: Scale [0, 1] → [-1, 1] (matches Dataset.__getitem__: ct * 2.0 - 1.0)
        resized_np = resized_slice.squeeze(0).numpy()
        ct_slices.append(resized_np * 2.0 - 1.0)
        
    ct_slab = np.stack(ct_slices, axis=0).astype(np.float32)  # [5, 256, 256]
    input_tensor = torch.from_numpy(ct_slab).unsqueeze(0).to(DEVICE)  # [1, 5, 256, 256]
    
    # 4. Forward pass (model outputs Tanh → [-1, 1])
    with torch.no_grad():
        predicted_tensor = G_axial(input_tensor)
        
    # 5. Denormalize: Tanh [-1,1] → [0,255]
    us_array = predicted_tensor.squeeze().cpu().numpy().astype(np.float32)
    final_frame = np.clip((us_array + 1.0) / 2.0 * 255.0, 0, 255).astype(np.uint8)
    
    ct_slice_u8 = np.clip(center_norm_01 * 255.0, 0, 255).astype(np.uint8) if center_norm_01 is not None else None
        
    return {
        "frame": final_frame,
        "ct_slice_u8": ct_slice_u8,
        "slice_idx": z_idx,
        "max_slices": max_z,
        "voxel_coords": [float(voxel_coords[0]), float(voxel_coords[1]), float(voxel_coords[2])],
        "plane_positions": {
            "axial":    volume.get_plane_info("axial", z_idx),
            "coronal":  volume.get_plane_info("coronal", y_idx_clamped),
            "sagittal": volume.get_plane_info("sagittal", x_idx_clamped),
        },
    }

# ═══════════════════════════════════════════════════════════════════════════════
# REST Endpoints
# ═══════════════════════════════════════════════════════════════════════════════

def get_lan_ip() -> str:
    """Detect local area network IP address."""
    import socket
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        # doesn't even have to be reachable
        s.connect(('10.255.255.255', 1))
        IP = s.getsockname()[0]
    except Exception:
        IP = '127.0.0.1'
    finally:
        s.close()
    return IP

@app.get("/api/network-info")
async def get_network_info():
    tunnel_url = None
    tunnel_file = os.path.join(os.path.dirname(__file__), "tunnel_url.txt")
    if os.path.exists(tunnel_file):
        try:
            with open(tunnel_file, "r") as f:
                tunnel_url = f.read().strip()
        except Exception:
            pass

    return {
        "lanIp": get_lan_ip(),
        "backendPort": 8000,
        "tunnelUrl": tunnel_url
    }

@app.get("/api/cases")
async def get_cases():
    return {"cases": case_manager.list_cases()}

@app.get("/api/cases/status")
async def get_cases_status():
    return case_manager.get_status()

@app.get("/api/cases/{case_id}/volume")
async def get_case_volume(case_id: str):
    volume = case_manager.load_case(case_id)
    if volume is None:
        raise HTTPException(status_code=404, detail="Case not found")

    ds_array, factors = get_downsampled_volume(volume.array, max_dim=128)
    hu_min, hu_max = -1024.0, 3072.0
    norm_pixels = np.clip(ds_array, hu_min, hu_max)
    norm_pixels = (norm_pixels - hu_min) / (hu_max - hu_min) * 255.0
    u8_pixels = norm_pixels.astype(np.uint8)

    if volume.seg_array is not None:
        from scipy import ndimage
        ds_seg = ndimage.zoom(volume.seg_array, factors, order=0)
        ds_seg = ds_seg[:, :, ::-1]
        ds_seg = ds_seg[:, ::-1, :]
        ds_seg = np.ascontiguousarray(np.transpose(ds_seg, (1, 0, 2))).astype(np.uint8)
    else:
        ds_seg = np.zeros_like(u8_pixels, dtype=np.uint8)

    u8_pixels = u8_pixels[:, :, ::-1]
    u8_pixels = u8_pixels[:, ::-1, :]
    u8_pixels = np.ascontiguousarray(np.transpose(u8_pixels, (1, 0, 2)))
    packed = np.stack([u8_pixels, ds_seg], axis=-1)

    headers = {
        "X-Volume-Dims": ",".join(map(str, packed.shape[:3])),
        "X-Volume-Spacing": ",".join(map(str, volume.voxel_spacing)),
        "X-Volume-Factors": ",".join(map(str, factors)),
        "X-Volume-HU-Range": f"{hu_min},{hu_max}",
        "X-Volume-Axis-Order": "AP-SI-LR-packed",
        "Access-Control-Expose-Headers": "X-Volume-Dims, X-Volume-Spacing, X-Volume-Factors, X-Volume-HU-Range, X-Volume-Axis-Order"
    }
    return Response(content=packed.tobytes(), media_type="application/octet-stream", headers=headers)

@app.get("/api/alignment/{case_id}")
async def get_case_alignment(case_id: str):
    alignment = case_manager.get_alignment(case_id)
    if not alignment: raise HTTPException(status_code=404, detail="Case not found")
    return alignment

@app.get("/api/cases/{case_id}/anatomy")
async def get_case_anatomy(case_id: str):
    import nibabel as nib
    import nibabel.orientations as nibo

    info = case_manager.get_case_info(case_id)
    if info is None or info.volume_path is None:
        raise HTTPException(status_code=404, detail=f"Case '{case_id}' not found")

    try:
        img: Any = nib.load(str(info.volume_path))
        affine = img.affine.astype(np.float64)
        header: Any = img.header
        nifti_shape = img.shape

        zooms = header.get_zooms()[:3]
        voxel_spacing = [float(zooms[0]), float(zooms[1]), float(zooms[2])]
        ornt = nibo.io_orientation(affine)
        axis_codes = list(nibo.ornt2axcodes(ornt))

        dc_i = (affine[:3, 0] / np.linalg.norm(affine[:3, 0])).tolist()
        dc_j = (affine[:3, 1] / np.linalg.norm(affine[:3, 1])).tolist()
        dc_k = (affine[:3, 2] / np.linalg.norm(affine[:3, 2])).tolist()

        W, H, D = nifti_shape[0], nifti_shape[1], nifti_shape[2]
        corners_vox = np.array([
            [0, 0, 0, 1], [W, 0, 0, 1], [0, H, 0, 1], [W, H, 0, 1],
            [0, 0, D, 1], [W, 0, D, 1], [0, H, D, 1], [W, H, D, 1],
        ], dtype=np.float64).T
        corners_world = affine @ corners_vox

        xs, ys, zs = corners_world[0], corners_world[1], corners_world[2]
        world_bounds = {
            "min": [float(xs.min()), float(ys.min()), float(zs.min())],
            "max": [float(xs.max()), float(ys.max()), float(zs.max())],
            "center": [float(xs.mean()), float(ys.mean()), float(zs.mean())],
            "size": [float(xs.max() - xs.min()), float(ys.max() - ys.min()), float(zs.max() - zs.min())],
        }

        return {
            "caseId": case_id, "affine": affine.tolist(),
            "axisOrientations": {"i": dc_i, "j": dc_j, "k": dc_k},
            "axisCodes": axis_codes, "convention": "".join(axis_codes),
            "worldBounds": world_bounds, "voxelSpacing": voxel_spacing,
            "niftiShape": list(nifti_shape), "backendShape": [nifti_shape[2], nifti_shape[1], nifti_shape[0]],
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class CreateSessionRequest(BaseModel):
    case_id: str
    mode: str = "full"
    probe_type: str = "curvilinear"
    target_organs: list[str] = []
    difficulty: str = "beginner"
    session_label: Optional[str] = None

@app.post("/api/session/create")
async def create_session(req: CreateSessionRequest):
    volume = case_manager.load_case(req.case_id)
    if volume is None: raise HTTPException(status_code=404, detail="Case not found")

    affine_inv = build_affine_inverse(volume.affine)
    bounds = compute_volume_bounds_world(volume.shape, volume.affine)
    default_matrix = default_axial_matrix(bounds["center"])

    session_id = str(uuid.uuid4())
    sessions[session_id] = {
        "session_id": session_id,
        "case_id": req.case_id,
        "status": "running",
        "created_at": time.time(),
        "probe_matrix": default_matrix.tolist(),
        "settings": _default_session_settings(),
        "affine_inv": affine_inv,
        "bounds": bounds,
        "config": {
            "mode": req.mode,
            "probeType": req.probe_type,
            "targetOrgans": req.target_organs,
            "difficulty": req.difficulty,
        },
        "last_ai_time": 0.0,
        "ai_in_progress": False,
    }
    return {
        "sessionId": session_id, "wsUrl": f"ws://localhost:8000/ws/{session_id}", "caseId": req.case_id,
        "volumeInfo": {
            "shape": list(volume.shape), "voxelSpacing": list(volume.voxel_spacing),
            "huMin": volume.hu_min, "huMax": volume.hu_max, "hasSegmentation": volume.seg_array is not None,
            "bounds": bounds,
        },
        "config": {"mode": req.mode, "probeType": req.probe_type, "targetOrgans": req.target_organs, "difficulty": req.difficulty},
    }

@app.get("/api/session/{session_id}")
async def get_session(session_id: str):
    s = sessions.get(session_id)
    if not s: raise HTTPException(status_code=404, detail="Session not found")
    return {k: v for k, v in s.items() if k not in ("affine_inv",)}

@app.post("/api/session/{session_id}/stop")
async def stop_session(session_id: str):
    s = sessions.get(session_id)
    if not s: raise HTTPException(status_code=404, detail="Session not found")
    s["status"] = "ended"
    return {"success": True}

class SliceRequest(BaseModel):
    session_id: str
    x: float = 0.0; y: float = 0.0; z: float = 0.0
    pitch: float = 0.0; yaw: float = 0.0; roll: float = 0.0
    wl: float = 40.0; ww: float = 400.0

@app.post("/api/slice")
async def get_slice(req: SliceRequest):
    """HTTP polling fallback updated with deep learning generator core."""
    s = sessions.get(req.session_id)
    if not s: raise HTTPException(status_code=404, detail="Session not found")
    volume = case_manager.get_loaded_volume(s["case_id"])
    if volume is None: raise HTTPException(status_code=503, detail="Volume not loaded")

    pose = ProbePose(x=req.x, y=req.y, z=req.z, pitch=req.pitch, yaw=req.yaw, roll=req.roll)
    probe_matrix = pose_to_matrix(pose)

    # Invoke Axial Inference Pipeline
    result = infer_ultrasound_slice(
        volume, s["affine_inv"], probe_matrix, wl=req.wl, ww=req.ww, 
        probe_type=s["settings"].get("probe_type", "curvilinear")
    )
    
    _, buffer = cv2.imencode('.png', result["frame"])
    image_b64 = f"data:image/png;base64,{base64.b64encode(buffer.tobytes()).decode('utf-8')}"
    return {
        "image": image_b64,
        "timestamp": time.time(),
        "planePositions": result["plane_positions"],
    }

class CaptureRequest(BaseModel):
    session_id: str
    probe_matrix: list[list[float]]
    wl: float = 40.0; ww: float = 400.0

@app.post("/api/capture")
async def do_capture(req: CaptureRequest):
    s = sessions.get(req.session_id)
    if not s: raise HTTPException(status_code=404, detail="Session not found")
    volume = case_manager.get_loaded_volume(s["case_id"])
    if volume is None: raise HTTPException(status_code=503, detail="Volume not loaded")

    probe_matrix = np.array(req.probe_matrix, dtype=np.float64)
    ai_result = infer_ultrasound_slice(
        volume, s["affine_inv"], probe_matrix, wl=req.wl, ww=req.ww,
        probe_type=s["settings"].get("probe_type", "curvilinear")
    )
    
    _, png_bytes = cv2.imencode('.png', ai_result["frame"])
    result = capture_mod.save_capture(
        session_id=req.session_id, png_bytes=png_bytes.tobytes(),
        probe_matrix=req.probe_matrix, case_id=s["case_id"],
        plane_positions=ai_result["plane_positions"],
    )
    return {"success": True, **result}

@app.get("/api/captures/{session_id}")
async def list_captures(session_id: str):
    return {"captures": capture_mod.list_captures(session_id)}


# ═══════════════════════════════════════════════════════════════════════════════
# WebSocket — Real-time probe streaming
# ═══════════════════════════════════════════════════════════════════════════════

@app.websocket("/ws/{session_id}")
async def websocket_endpoint(websocket: WebSocket, session_id: str):
    await websocket.accept()
    logger.info(f"WS connected: {session_id}")
    # Register this frontend WS so the phone endpoint can relay frames to it
    frontend_connections[session_id] = websocket

    s = sessions.get(session_id)
    if not s:
        await websocket.send_json({"type": "sessionEvent", "data": {"event": "error", "message": "Session not found", "timestamp": time.time()}})
        await websocket.close(); return

    volume = case_manager.get_loaded_volume(s["case_id"])
    if volume is None:
        await websocket.send_json({"type": "sessionEvent", "data": {"event": "error", "message": "Volume not loaded", "timestamp": time.time()}})
        await websocket.close(); return

    await websocket.send_json({"type": "sessionEvent", "data": {"event": "started", "timestamp": time.time()}})

    probe_matrix = np.array(s["probe_matrix"], dtype=np.float64)
    settings = s.get("settings", _default_session_settings())

    # 🚨 UPDATED: High frequency asynchronous socket frame streaming engine
    async def send_ai_frame(matrix: np.ndarray, cfg: dict):
        result = infer_ultrasound_slice(
            volume, s["affine_inv"], matrix,
            wl=cfg.get("wl", 40.0), ww=cfg.get("ww", 400.0),
            probe_type=cfg.get("probe_type", "curvilinear")
        )
        
        ai_frame = result["frame"]
        
        # Format compress matrix frame directly for clean JSON string injection
        _, buffer = cv2.imencode('.png', ai_frame)
        b64_str = f"data:image/png;base64,{base64.b64encode(buffer.tobytes()).decode('utf-8')}"
        
        await websocket.send_json({
            "type": "rawUltrasoundFrame" if cfg.get("probe_type") == "linear" else "ultrasoundFrame",
            "data": {
                "image": b64_str,
                "timestamp": time.time(),
                "sliceIdx": result["slice_idx"],
                "maxSlices": result["max_slices"],
                "voxelCoords": result["voxel_coords"],
                "planePositions": result["plane_positions"],
            },
        })

        # Trigger background AI pipeline asynchronously
        ct_slice_u8 = result.get("ct_slice_u8")
        if ct_slice_u8 is not None:
            asyncio.create_task(
                run_ai_pipeline_async(
                    session_id=session_id,
                    volume=volume,
                    probe_matrix=matrix,
                    ct_slice_u8=ct_slice_u8,
                    z_idx=result["slice_idx"],
                    max_z=result["max_slices"],
                    websocket=websocket,
                )
            )

    # Dispatch initial system tracking state frame
    await send_ai_frame(probe_matrix, settings)

    try:
        while True:
            raw = await websocket.receive_json()
            msg_type = raw.get("type")
            data = raw.get("data", {})

            if msg_type == "probeUpdate":
                pose = ProbePose(
                    x=float(data.get("x", 0)), y=float(data.get("y", 0)), z=float(data.get("z", 0)),
                    pitch=float(data.get("pitch", 0)), yaw=float(data.get("yaw", 0)), roll=float(data.get("roll", 0)),
                )
                probe_matrix = pose_to_matrix(pose)
                s["probe_matrix"] = probe_matrix.tolist()
                
                settings["pressure"] = float(data.get("pressure", 0.0))
                settings["contact_quality"] = float(data.get("contactQuality", 100.0))
                settings["probe_type"] = data.get("probeType", "curvilinear")
                
                await send_ai_frame(probe_matrix, settings)

            elif msg_type == "matrixUpdate":
                probe_matrix = np.array(data["matrix"], dtype=np.float64)
                s["probe_matrix"] = probe_matrix.tolist()
                await send_ai_frame(probe_matrix, settings)

            elif msg_type == "settingsUpdate":
                if "wl" in data: settings["wl"] = float(data["wl"])
                if "ww" in data: settings["ww"] = float(data["ww"])
                if "probeType" in data: settings["probe_type"] = data["probeType"]
                s["settings"] = settings
                await send_ai_frame(probe_matrix, settings)

            elif msg_type == "capture":
                ai_result = infer_ultrasound_slice(
                    volume, s["affine_inv"], probe_matrix,
                    wl=settings.get("wl", 40.0), ww=settings.get("ww", 400.0),
                    probe_type=settings.get("probe_type", "curvilinear")
                )
                _, png_bytes = cv2.imencode('.png', ai_result["frame"])
                result = capture_mod.save_capture(
                    session_id=session_id, png_bytes=png_bytes.tobytes(),
                    probe_matrix=probe_matrix.tolist(), case_id=s["case_id"],
                    plane_positions=ai_result["plane_positions"],
                )
                await websocket.send_json({"type": "captureResult", "data": {"success": True, **result}})

            elif msg_type == "ping":
                await websocket.send_json({"type": "pong", "data": {}})

    except WebSocketDisconnect:
        logger.info(f"WS disconnected: {session_id}")
        frontend_connections.pop(session_id, None)
    except Exception as e:
        logger.error(f"WS error ({session_id}): {e}", exc_info=True)
        try:
            await websocket.send_json({"type": "sessionEvent", "data": {"event": "error", "message": str(e), "timestamp": time.time()}})
        except Exception: pass

# ═══════════════════════════════════════════════════════════════════════════════
# Phone-as-Probe WebSocket Endpoint
# ═══════════════════════════════════════════════════════════════════════════════

@app.websocket("/ws/phone/{session_id}")
async def phone_websocket(websocket: WebSocket, session_id: str):
    """
    WebSocket endpoint for the phone probe controller.
    Receives gyroscope orientation from the phone, maps it to probe pose,
    runs AI inference, and relays the ultrasound frame to the main frontend.
    """
    s = sessions.get(session_id)
    if not s:
        await websocket.accept()
        await websocket.send_json({"type": "error", "data": {"message": "Session not found. Please scan the QR code again."}})
        await websocket.close(code=4004, reason="Session not found")
        return

    await websocket.accept()
    phone_connections[session_id] = websocket
    logger.info(f"📱 Phone connected to session: {session_id}")

    volume = case_manager.get_loaded_volume(s["case_id"])
    if volume is None:
        await websocket.send_json({"type": "error", "data": {"message": "Volume not loaded"}})
        await websocket.close()
        return

    # Get the volume's world-space bounds for mapping phone angles → positions
    affine_inv = s["affine_inv"]
    bounds = s.get("bounds", {})
    world_min = bounds.get("min", [-200, -350, -300])
    world_max = bounds.get("max", [200, 50, -40])
    world_center = bounds.get("center", [0, -150, -170])

    settings = s.get("settings", _default_session_settings())

    try:
        while True:
            raw = await websocket.receive_json()
            msg_type = raw.get("type")
            data = raw.get("data", {})

            if msg_type == "phoneOrientation":
                # ── Map phone orientation → world probe position ──────────
                # Calibrated angles from phone:
                pitch = float(data.get("pitch", 0))  # beta - calBeta: front/back tilt
                yaw = float(data.get("yaw", 0))      # alpha - calAlpha: compass heading
                roll = float(data.get("roll", 0))     # gamma - calGamma: left/right tilt

                # Option A mapping (approved in plan):
                # Phone flat = center. Tilt forward/back = scan head↔feet (Z axis).
                # Tilt left/right = scan lateral (X axis).

                # Map pitch (-90° to +90°) → Z world coordinate (axial slice)
                z_range = world_max[2] - world_min[2]
                z_pos = world_center[2] + (pitch / 90.0) * (z_range / 2)
                z_pos = max(world_min[2], min(world_max[2], z_pos))

                # Map roll (-45° to +45°) → X world coordinate (lateral)
                x_range = world_max[0] - world_min[0]
                x_pos = world_center[0] + (roll / 45.0) * (x_range / 2)
                x_pos = max(world_min[0], min(world_max[0], x_pos))

                # Y stays at center (depth into patient, AP direction)
                y_pos = world_center[1]

                # Build probe pose and matrix
                pose = ProbePose(x=x_pos, y=y_pos, z=z_pos, pitch=0, yaw=0, roll=0)
                probe_matrix = pose_to_matrix(pose)

                # Run AI inference
                result = infer_ultrasound_slice(
                    volume, affine_inv, probe_matrix,
                    wl=settings.get("wl", 40.0),
                    ww=settings.get("ww", 400.0),
                    probe_type=settings.get("probe_type", "curvilinear")
                )

                ai_frame = result["frame"]
                _, buffer = cv2.imencode('.png', ai_frame)
                b64_str = f"data:image/png;base64,{base64.b64encode(buffer.tobytes()).decode('utf-8')}"

                frame_msg = {
                    "type": "ultrasoundFrame",
                    "data": {
                        "image": b64_str,
                        "timestamp": time.time(),
                        "sliceIdx": result["slice_idx"],
                        "maxSlices": result["max_slices"],
                        "voxelCoords": result["voxel_coords"],
                        "planePositions": result["plane_positions"],
                    },
                }

                # Relay the frame to the main frontend WebSocket
                frontend_ws = frontend_connections.get(session_id)
                if frontend_ws:
                    try:
                        await frontend_ws.send_json(frame_msg)
                    except Exception:
                        pass  # Frontend may have disconnected

                # Trigger background AI pipeline asynchronously
                ct_slice_u8 = result.get("ct_slice_u8")
                if ct_slice_u8 is not None and frontend_ws:
                    asyncio.create_task(
                        run_ai_pipeline_async(
                            session_id=session_id,
                            volume=volume,
                            probe_matrix=probe_matrix,
                            ct_slice_u8=ct_slice_u8,
                            z_idx=result["slice_idx"],
                            max_z=result["max_slices"],
                            websocket=frontend_ws,
                        )
                    )

                # Send acknowledgement + slice info back to phone
                await websocket.send_json({
                    "type": "phonePoseAck",
                    "data": {
                        "sliceIdx": result["slice_idx"],
                        "maxSlices": result["max_slices"],
                        "worldPos": [x_pos, y_pos, z_pos],
                        "planePositions": result["plane_positions"],
                    }
                })

            elif msg_type == "ping":
                await websocket.send_json({"type": "pong", "data": {}})

    except WebSocketDisconnect:
        logger.info(f"📱 Phone disconnected from session: {session_id}")
    except Exception as e:
        logger.error(f"📱 Phone WS error ({session_id}): {e}", exc_info=True)
    finally:
        phone_connections.pop(session_id, None)


@app.get("/api/session/{session_id}/phone-status")
async def phone_status(session_id: str):
    """Check if a phone is connected to the given session."""
    return {
        "connected": session_id in phone_connections,
        "sessionId": session_id,
    }


@app.get("/api/session/{session_id}/plane-positions")
async def get_plane_positions(session_id: str):
    """
    Returns the current probe's axial/coronal/sagittal slice indices.
    Lightweight endpoint for the guidance model — no AI inference is run.
    """
    s = sessions.get(session_id)
    if not s:
        raise HTTPException(status_code=404, detail="Session not found")
    volume = case_manager.get_loaded_volume(s["case_id"])
    if volume is None:
        raise HTTPException(status_code=503, detail="Volume not loaded")

    probe_matrix = np.array(s["probe_matrix"], dtype=np.float64)
    affine_inv = s["affine_inv"]

    # Map world position → voxel coordinates
    world_translation = np.array([
        probe_matrix[0, 3], probe_matrix[1, 3], probe_matrix[2, 3], 1.0
    ])
    voxel_coords = affine_inv @ world_translation

    max_z, max_y, max_x = volume.array.shape
    z_idx = max(0, min(int(round(voxel_coords[2])), max_z - 1))
    y_idx = max(0, min(int(round(voxel_coords[1])), max_y - 1))
    x_idx = max(0, min(int(round(voxel_coords[0])), max_x - 1))

    return {
        "sessionId": session_id,
        "voxelCoords": [float(voxel_coords[0]), float(voxel_coords[1]), float(voxel_coords[2])],
        "planePositions": {
            "axial":    volume.get_plane_info("axial", z_idx),
            "coronal":  volume.get_plane_info("coronal", y_idx),
            "sagittal": volume.get_plane_info("sagittal", x_idx),
        },
    }


# ── Mount static files for phone controller (MUST be after all routes) ────────
app.mount("/phone", StaticFiles(directory=os.path.join(os.path.dirname(__file__), "static"), html=True), name="phone-static")

# ── Entry point ───────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False, log_level="info")