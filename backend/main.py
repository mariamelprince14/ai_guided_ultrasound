"""
main.py
───────
FastAPI backend for the AI-Guided Ultrasound Training System.
No 3D Slicer. No external medical viewers. Everything runs here.

Endpoints:
  GET  /api/cases                  → list all discovered CT cases
  POST /api/session/create         → load a case, return session info
  GET  /api/session/{id}           → get session status
  POST /api/session/{id}/stop      → end session
  POST /api/slice                  → on-demand slice (polling fallback)
  POST /api/capture                → save current frame + pose
  GET  /api/captures/{session_id}  → list captures
  WS   /ws/{session_id}            → real-time probe→frame streaming

WebSocket protocol:
  Client → Server: { "type": "probeUpdate", "data": { "x", "y", "z", "pitch", "yaw", "roll" } }
                OR { "type": "settingsUpdate", "data": { "wl", "ww", "showSeg", "planeSizeMm" } }
                OR { "type": "capture" }
  Server → Client: { "type": "ultrasoundFrame", "data": { "image": "<base64-png>", "timestamp": 0 } }
                OR { "type": "sessionEvent", "data": { "event": "...", "timestamp": 0 } }
                OR { "type": "captureResult", "data": { "frame_index": 0, ... } }
"""

from __future__ import annotations

import logging
import time
import uuid
from typing import Optional

import numpy as np
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel

import case_manager
import capture as capture_mod
from probe_controller import ProbePose, pose_to_matrix, default_axial_matrix
from reslicer import (
    reslice, reslice_segmentation, compute_volume_bounds_world,
    build_affine_inverse, get_downsampled_volume
)
from renderer import render_slice, render_to_base64
from fastapi import Response

# ── Logging ───────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
)
logger = logging.getLogger(__name__)

# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(title="US Training Backend", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],          # dev: allow all; restrict in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── In-memory session store ───────────────────────────────────────────────────
sessions: dict[str, dict] = {}


def _default_session_settings() -> dict:
    return {
        "wl": 60.0,          # window level (HU center)
        "ww": 360.0,         # window width
        "show_seg": False,
        "plane_size_mm": 150.0,
        "resolution": 512,
    }


# ── Startup ───────────────────────────────────────────────────────────────────
@app.on_event("startup")
async def startup():
    logger.info("Initializing case manager...")
    case_manager.initialize()
    logger.info("Backend ready.")


# ═══════════════════════════════════════════════════════════════════════════════
# REST Endpoints
# ═══════════════════════════════════════════════════════════════════════════════

@app.get("/api/cases")
async def get_cases():
    """Return all discovered CT cases."""
    return {"cases": case_manager.list_cases()}


@app.get("/api/cases/status")
async def get_cases_status():
    """Return a detailed validation report of all discovered cases."""
    return case_manager.get_status()


@app.get("/api/cases/{case_id}/volume")
async def get_case_volume(case_id: str):
    """
    Returns downsampled voxel data for 3D visualization.
    Format: raw Uint8 binary data.
    Metadata is provided in X-Volume headers.
    """
    volume = case_manager.load_case(case_id)
    if volume is None:
        raise HTTPException(status_code=404, detail="Case not found")

    # 1. Downsample
    # Target 128 max dim (~2MB payload in Uint8)
    ds_array, factors = get_downsampled_volume(volume.array, max_dim=128)

    # 2. Normalize HU [-1024, 3072] to Uint8 [0, 255]
    # This range covers almost all medical CT anatomy.
    hu_min, hu_max = -1024.0, 3072.0
    norm_pixels = np.clip(ds_array, hu_min, hu_max)
    norm_pixels = (norm_pixels - hu_min) / (hu_max - hu_min) * 255.0
    u8_pixels = norm_pixels.astype(np.uint8)

    # 3. Prepare response with metadata in headers
    headers = {
        "X-Volume-Dims": ",".join(map(str, u8_pixels.shape)),  # (Z, Y, X)
        "X-Volume-Spacing": ",".join(map(str, volume.voxel_spacing)),
        "X-Volume-Factors": ",".join(map(str, factors)),
        "X-Volume-HU-Range": f"{hu_min},{hu_max}",
        "X-Volume-Axis-Order": "Z-Y-X",
        "Access-Control-Expose-Headers": "X-Volume-Dims, X-Volume-Spacing, X-Volume-Factors, X-Volume-HU-Range, X-Volume-Axis-Order"
    }

    return Response(
        content=u8_pixels.tobytes(),
        media_type="application/octet-stream",
        headers=headers
    )


class CreateSessionRequest(BaseModel):
    case_id: str
    mode: str = "full"
    probe_type: str = "curvilinear"
    target_organs: list[str] = []
    difficulty: str = "beginner"
    session_label: Optional[str] = None


@app.post("/api/session/create")
async def create_session(req: CreateSessionRequest):
    """
    Load a CT case and create a training session.
    Returns session_id, ws_url, and volume metadata.
    """
    logger.info(f"Creating session for case: {req.case_id}")

    # Load the volume (may take a few seconds on first load)
    volume = case_manager.load_case(req.case_id)
    if volume is None:
        raise HTTPException(status_code=404, detail=f"Case '{req.case_id}' not found")

    # Compute bounds and default probe position
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
        "affine_inv": affine_inv,   # cached for fast slicing
        "bounds": bounds,
    }

    logger.info(f"Session created: {session_id}")
    return {
        "sessionId": session_id,
        "wsUrl": f"ws://localhost:8000/ws/{session_id}",
        "caseId": req.case_id,
        "volumeInfo": {
            "shape": list(volume.shape),
            "voxelSpacing": list(volume.voxel_spacing),
            "huMin": volume.hu_min,
            "huMax": volume.hu_max,
            "hasSegmentation": volume.seg_array is not None,
            "segLabels": volume.seg_labels,
            "bounds": bounds,
        },
        "config": {
            "mode": req.mode,
            "probeType": req.probe_type,
            "targetOrgans": req.target_organs,
            "difficulty": req.difficulty,
        },
    }


@app.get("/api/session/{session_id}")
async def get_session(session_id: str):
    s = sessions.get(session_id)
    if not s:
        raise HTTPException(status_code=404, detail="Session not found")
    return {k: v for k, v in s.items() if k not in ("affine_inv",)}


@app.post("/api/session/{session_id}/stop")
async def stop_session(session_id: str):
    s = sessions.get(session_id)
    if not s:
        raise HTTPException(status_code=404, detail="Session not found")
    s["status"] = "ended"
    return {"success": True}


class SliceRequest(BaseModel):
    session_id: str
    x: float = 0.0
    y: float = 0.0
    z: float = 0.0
    pitch: float = 0.0
    yaw: float = 0.0
    roll: float = 0.0
    show_seg: bool = False
    wl: float = 60.0
    ww: float = 360.0


@app.post("/api/slice")
async def get_slice(req: SliceRequest):
    """HTTP polling fallback: get a single slice for a given probe pose."""
    s = sessions.get(req.session_id)
    if not s:
        raise HTTPException(status_code=404, detail="Session not found")

    volume = case_manager.get_loaded_volume(s["case_id"])
    if volume is None:
        raise HTTPException(status_code=503, detail="Volume not loaded")

    pose = ProbePose(x=req.x, y=req.y, z=req.z,
                     pitch=req.pitch, yaw=req.yaw, roll=req.roll)
    probe_matrix = pose_to_matrix(pose)

    ct_slice = reslice(volume.array, s["affine_inv"], probe_matrix)
    seg_slice = None
    if req.show_seg and volume.seg_array is not None:
        seg_slice = reslice_segmentation(
            volume.seg_array, s["affine_inv"], probe_matrix)

    image_b64 = render_to_base64(
        ct_slice,
        seg_slice=seg_slice,
        show_segmentation=req.show_seg,
        window_level_params=(req.wl, req.ww),
    )
    return {"image": image_b64, "timestamp": time.time()}


class CaptureRequest(BaseModel):
    session_id: str
    probe_matrix: list[list[float]]   # 4×4
    show_seg: bool = False
    wl: float = 60.0
    ww: float = 360.0


@app.post("/api/capture")
async def do_capture(req: CaptureRequest):
    """Save current frame + probe pose to disk."""
    s = sessions.get(req.session_id)
    if not s:
        raise HTTPException(status_code=404, detail="Session not found")

    volume = case_manager.get_loaded_volume(s["case_id"])
    if volume is None:
        raise HTTPException(status_code=503, detail="Volume not loaded")

    probe_matrix = np.array(req.probe_matrix, dtype=np.float64)
    ct_slice = reslice(volume.array, s["affine_inv"], probe_matrix)
    seg_slice = None
    if req.show_seg and volume.seg_array is not None:
        seg_slice = reslice_segmentation(
            volume.seg_array, s["affine_inv"], probe_matrix)

    png_bytes = render_slice(
        ct_slice, seg_slice=seg_slice,
        show_segmentation=req.show_seg,
        window_level_params=(req.wl, req.ww),
    )
    result = capture_mod.save_capture(
        session_id=req.session_id,
        png_bytes=png_bytes,
        probe_matrix=req.probe_matrix,
        case_id=s["case_id"],
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

    s = sessions.get(session_id)
    if not s:
        await websocket.send_json({
            "type": "sessionEvent",
            "data": {"event": "error", "message": "Session not found",
                     "timestamp": time.time()}
        })
        await websocket.close()
        return

    volume = case_manager.get_loaded_volume(s["case_id"])
    if volume is None:
        await websocket.send_json({
            "type": "sessionEvent",
            "data": {"event": "error", "message": "Volume not loaded",
                     "timestamp": time.time()}
        })
        await websocket.close()
        return

    # Send started event + initial frame
    await websocket.send_json({
        "type": "sessionEvent",
        "data": {"event": "started", "timestamp": time.time()}
    })

    probe_matrix = np.array(s["probe_matrix"], dtype=np.float64)
    settings = s.get("settings", _default_session_settings())

    async def send_frame(matrix: np.ndarray, cfg: dict):
        ct_slice = reslice(
            volume.array, s["affine_inv"], matrix,
            plane_size_mm=(cfg["plane_size_mm"], cfg["plane_size_mm"]),
            resolution=(cfg["resolution"], cfg["resolution"]),
        )
        seg_slice = None
        if cfg["show_seg"] and volume.seg_array is not None:
            seg_slice = reslice_segmentation(
                volume.seg_array, s["affine_inv"], matrix,
                plane_size_mm=(cfg["plane_size_mm"], cfg["plane_size_mm"]),
                resolution=(cfg["resolution"], cfg["resolution"]),
            )
        b64 = render_to_base64(
            ct_slice, seg_slice=seg_slice,
            show_segmentation=cfg["show_seg"],
            window_level_params=(cfg["wl"], cfg["ww"]),
            output_size=(cfg["resolution"], cfg["resolution"]),
        )
        await websocket.send_json({
            "type": "ultrasoundFrame",
            "data": {"image": b64, "timestamp": time.time()},
        })

    # Send initial frame
    await send_frame(probe_matrix, settings)

    try:
        while True:
            raw = await websocket.receive_json()
            msg_type = raw.get("type")
            data = raw.get("data", {})

            if msg_type == "probeUpdate":
                # Update probe pose
                pose = ProbePose(
                    x=float(data.get("x", 0)),
                    y=float(data.get("y", 0)),
                    z=float(data.get("z", 0)),
                    pitch=float(data.get("pitch", 0)),
                    yaw=float(data.get("yaw", 0)),
                    roll=float(data.get("roll", 0)),
                )
                probe_matrix = pose_to_matrix(pose)
                s["probe_matrix"] = probe_matrix.tolist()
                await send_frame(probe_matrix, settings)

            elif msg_type == "matrixUpdate":
                # Accept raw 4x4 matrix
                probe_matrix = np.array(data["matrix"], dtype=np.float64)
                s["probe_matrix"] = probe_matrix.tolist()
                await send_frame(probe_matrix, settings)

            elif msg_type == "settingsUpdate":
                if "wl" in data:   settings["wl"] = float(data["wl"])
                if "ww" in data:   settings["ww"] = float(data["ww"])
                if "showSeg" in data: settings["show_seg"] = bool(data["showSeg"])
                if "planeSizeMm" in data: settings["plane_size_mm"] = float(data["planeSizeMm"])
                if "resolution" in data:  settings["resolution"] = int(data["resolution"])
                s["settings"] = settings
                await send_frame(probe_matrix, settings)

            elif msg_type == "capture":
                png_bytes = render_slice(
                    reslice(volume.array, s["affine_inv"], probe_matrix),
                    show_segmentation=settings["show_seg"],
                    window_level_params=(settings["wl"], settings["ww"]),
                )
                result = capture_mod.save_capture(
                    session_id=session_id,
                    png_bytes=png_bytes,
                    probe_matrix=probe_matrix.tolist(),
                    case_id=s["case_id"],
                )
                await websocket.send_json({
                    "type": "captureResult",
                    "data": {"success": True, **result},
                })

            elif msg_type == "ping":
                await websocket.send_json({"type": "pong", "data": {}})

    except WebSocketDisconnect:
        logger.info(f"WS disconnected: {session_id}")
    except Exception as e:
        logger.error(f"WS error ({session_id}): {e}", exc_info=True)
        try:
            await websocket.send_json({
                "type": "sessionEvent",
                "data": {"event": "error", "message": str(e), "timestamp": time.time()}
            })
        except Exception:
            pass


# ── Entry point ───────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False, log_level="info")
