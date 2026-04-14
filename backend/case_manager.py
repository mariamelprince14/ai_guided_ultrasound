"""
case_manager.py
───────────────
Discovers all CT cases in the dataset directory, serves case metadata,
and manages an in-memory LRU cache of loaded volumes.
"""
from __future__ import annotations

import glob
import logging
import os
from functools import lru_cache
from pathlib import Path
from typing import Optional

from volume_loader import (
    VolumeData,
    load_volume,
    load_segmentation_label,
    load_segmentation_nrrd,
)

logger = logging.getLogger(__name__)

# ── Dataset root ─────────────────────────────────────────────────────────────
# Absolute path to the folder containing all case sub-directories
DATASET_ROOT = Path(r"E:\downloads\usdemo\ct.volumes\3d test")

# LRU cache size: how many volumes to keep in memory simultaneously
CACHE_SIZE = 3


class CaseInfo:
    """Lightweight metadata about a single case (no volume loaded yet)."""
    def __init__(self, case_id: str, folder: Path, volume_path: Optional[Path] = None,
                  seg_nrrd_path: Optional[Path] = None,
                  seg_label_path: Optional[Path] = None,
                  is_valid: bool = True,
                  error: Optional[str] = None):
        self.case_id = case_id
        self.folder = folder
        self.volume_path = volume_path
        self.seg_nrrd_path = seg_nrrd_path
        self.seg_label_path = seg_label_path
        self.is_valid = is_valid
        self.error = error

    def to_dict(self) -> dict:
        return {
            "id": self.case_id,
            "name": f"Case {self.case_id}",
            "folder": str(self.folder),
            "has_segmentation": self.seg_nrrd_path is not None
                                or self.seg_label_path is not None,
            "volume_file": self.volume_path.name if self.volume_path else None,
            "is_valid": self.is_valid,
            "error": self.error
        }


# ── Discovery ────────────────────────────────────────────────────────────────

def discover_cases(dataset_root: Path = DATASET_ROOT) -> list[CaseInfo]:
    """
    Scan dataset_root for sub-directories.
    Each sub-directory must contain at least one *.nii.gz volume file.
    Returns a sorted list of CaseInfo objects.
    """
    if not dataset_root.exists():
        logger.error(f"Dataset root not found: {dataset_root}")
        return []

    cases: list[CaseInfo] = []
    for folder in sorted(dataset_root.iterdir()):
        if not folder.is_dir():
            continue

        # Find volume: prefer files NOT ending in 'segmentation-label.nii.gz'
        nii_files = list(folder.glob("*.nii.gz"))
        vol_files = [f for f in nii_files if "segmentation" not in f.name.lower()]
        
        volume_path = None
        is_valid = True
        error = None
        
        if not vol_files:
            logger.warning(f"No volume .nii.gz found in {folder.name}")
            is_valid = False
            error = "Missing CT volume (.nii.gz)"
        else:
            volume_path = vol_files[0]

        # Find segmentation .seg.nrrd
        nrrd_files = list(folder.glob("*.seg.nrrd"))
        seg_nrrd = nrrd_files[0] if nrrd_files else None

        # Find segmentation-label.nii.gz
        label_files = [f for f in nii_files if "segmentation-label" in f.name.lower()]
        seg_label = label_files[0] if label_files else None

        case_id = folder.name  # e.g. "test3", "test4", ...
        cases.append(CaseInfo(
            case_id=case_id,
            folder=folder,
            volume_path=volume_path,
            seg_nrrd_path=seg_nrrd,
            seg_label_path=seg_label,
            is_valid=is_valid,
            error=error
        ))
        logger.info(
            f"Discovered case {case_id}: valid={is_valid}, "
            f"seg_nrrd={seg_nrrd is not None}, seg_label={seg_label is not None}"
        )

    logger.info(f"Total cases discovered: {len(cases)}")
    return cases


# ── Global registry ───────────────────────────────────────────────────────────

_cases_by_id: dict[str, CaseInfo] = {}
_loaded_volumes: dict[str, VolumeData] = {}   # LRU via insertion order
_MAX_CACHED = CACHE_SIZE


def initialize(dataset_root: Path = DATASET_ROOT) -> None:
    """Call once at startup to discover all cases."""
    global _cases_by_id
    cases = discover_cases(dataset_root)
    _cases_by_id = {c.case_id: c for c in cases}
    logger.info(f"Case manager initialized with {len(_cases_by_id)} cases")


def list_cases() -> list[dict]:
    """Return all discovered cases as JSON-serializable dicts."""
    return [c.to_dict() for c in _cases_by_id.values()]


def get_case_info(case_id: str) -> Optional[CaseInfo]:
    return _cases_by_id.get(case_id)


def load_case(case_id: str) -> Optional[VolumeData]:
    """
    Load a case into memory (or return cached copy).
    Uses a simple dict-based LRU: evicts oldest entry when over limit.
    """
    global _loaded_volumes

    if case_id in _loaded_volumes:
        logger.info(f"Cache hit: {case_id}")
        return _loaded_volumes[case_id]

    info = _cases_by_id.get(case_id)
    if info is None:
        logger.error(f"Case not found: {case_id}")
        return None

    # Evict oldest if at capacity
    if len(_loaded_volumes) >= _MAX_CACHED:
        oldest = next(iter(_loaded_volumes))
        logger.info(f"Evicting cached volume: {oldest}")
        del _loaded_volumes[oldest]

    # Load volume
    volume = load_volume(info.volume_path)

    # Load segmentation (prefer -label.nii.gz for speed; fall back to .seg.nrrd)
    if info.seg_label_path:
        load_segmentation_label(info.seg_label_path, volume)
    elif info.seg_nrrd_path:
        load_segmentation_nrrd(info.seg_nrrd_path, volume)

    _loaded_volumes[case_id] = volume
    return volume


def get_loaded_volume(case_id: str) -> Optional[VolumeData]:
    """Return a previously loaded volume without re-loading."""
    return _loaded_volumes.get(case_id)


def get_status() -> dict:
    """Return a validation summary of all discovered cases."""
    cases = list_cases()
    valid_count = sum(1 for c in cases if c["is_valid"])
    seg_count = sum(1 for c in cases if c["has_segmentation"])
    
    return {
        "total": len(cases),
        "valid": valid_count,
        "segmentations": seg_count,
        "failed": len(cases) - valid_count,
        "cases": cases
    }
