"""
capture.py
──────────
Saves captured frames (PNG) and probe pose matrices (JSON) to disk.
Output structure:
  captures/
    {session_id}/
      frame_{n:04d}.png
      pose_{n:04d}.json
"""
from __future__ import annotations

import json
import logging
import os
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

CAPTURES_DIR = Path(__file__).parent.parent / "captures"


def ensure_session_dir(session_id: str) -> Path:
    session_dir = CAPTURES_DIR / session_id
    session_dir.mkdir(parents=True, exist_ok=True)
    return session_dir


def count_existing_frames(session_id: str) -> int:
    session_dir = CAPTURES_DIR / session_id
    if not session_dir.exists():
        return 0
    return len(list(session_dir.glob("frame_*.png")))


def save_capture(
    session_id: str,
    png_bytes: bytes,
    probe_matrix: list[list[float]],  # 4×4 as nested list
    case_id: str,
    extra_meta: Optional[dict] = None,
) -> dict:
    """
    Save a single captured frame + probe pose.

    Returns a dict with:
      - frame_index: int
      - frame_path: str
      - pose_path: str
    """
    session_dir = ensure_session_dir(session_id)
    n = count_existing_frames(session_id)

    frame_path = session_dir / f"frame_{n:04d}.png"
    pose_path  = session_dir / f"pose_{n:04d}.json"

    # Write PNG
    frame_path.write_bytes(png_bytes)

    # Write pose JSON
    pose_data = {
        "frame_index": n,
        "session_id": session_id,
        "case_id": case_id,
        "probe_matrix_4x4": probe_matrix,
        "extra": extra_meta or {},
    }
    pose_path.write_text(json.dumps(pose_data, indent=2))

    logger.info(f"Saved capture {n} for session {session_id}")
    return {
        "frame_index": n,
        "frame_path": str(frame_path),
        "pose_path": str(pose_path),
    }


def list_captures(session_id: str) -> list[dict]:
    """List all captures for a session."""
    session_dir = CAPTURES_DIR / session_id
    if not session_dir.exists():
        return []

    results = []
    for pose_file in sorted(session_dir.glob("pose_*.json")):
        try:
            data = json.loads(pose_file.read_text())
            frame_file = session_dir / f"frame_{data['frame_index']:04d}.png"
            results.append({
                **data,
                "frame_exists": frame_file.exists(),
                "frame_size_bytes": frame_file.stat().st_size if frame_file.exists() else 0,
            })
        except Exception as e:
            logger.error(f"Error reading {pose_file}: {e}")
    return results
