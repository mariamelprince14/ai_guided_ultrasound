"""
volume_loader.py
────────────────
Loads CT volumes (.nii.gz) and segmentation masks (.seg.nrrd / -label.nii.gz)
into memory as numpy arrays with spatial metadata.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

import nibabel as nib
import numpy as np

logger = logging.getLogger(__name__)


@dataclass
class VolumeData:
    """All data for one loaded CT volume."""
    case_id: str
    volume_path: str
    array: np.ndarray          # (D, H, W)  float32
    affine: np.ndarray         # 4×4 world-to-voxel transform
    voxel_spacing: tuple       # (dz, dy, dx) in mm
    shape: tuple               # (D, H, W)
    hu_min: float = -1024.0
    hu_max: float = 3071.0
    seg_array: Optional[np.ndarray] = None    # same shape, int labels
    seg_labels: dict = field(default_factory=dict)  # label_int → name


def load_volume(volume_path: str | Path) -> VolumeData:
    """
    Load a .nii.gz CT volume.  Returns a VolumeData object.
    The array is stored as float32 in (Z, Y, X) = (D, H, W) order
    (nibabel loads in Fortran/column-major, we transpose to C order).
    """
    path = Path(volume_path)
    logger.info(f"Loading volume: {path.name}")

    img = nib.load(str(path)) # type: ignore
    # nibabel gives (X,Y,Z) order; transpose to (Z,Y,X) for easier slicing
    arr = np.asarray(img.dataobj, dtype=np.float32) # type: ignore
    arr = np.transpose(arr, (2, 1, 0))   # → (Z, Y, X) = (D, H, W)

    affine = img.affine.astype(np.float64) # type: ignore
    # Voxel spacing from header
    header = img.header # type: ignore
    try:
        zooms = header.get_zooms()[:3] # type: ignore
        voxel_spacing = (float(zooms[2]), float(zooms[1]), float(zooms[0]))  # (dz,dy,dx)
    except Exception:
        voxel_spacing = (1.0, 1.0, 1.0)

    volume = VolumeData(
        case_id=path.parent.name,
        volume_path=str(path),
        array=arr,
        affine=affine,
        voxel_spacing=voxel_spacing,
        shape=arr.shape,
        hu_min=float(np.percentile(arr, 0.1)),
        hu_max=float(np.percentile(arr, 99.9)),
    )
    logger.info(
        f"  Loaded {arr.shape} | spacing {voxel_spacing} mm | "
        f"HU [{volume.hu_min:.0f}, {volume.hu_max:.0f}]"
    )
    return volume


def load_segmentation_label(label_path: str | Path, volume: VolumeData) -> None:
    """
    Load a *-label.nii.gz segmentation and attach it to the VolumeData.
    The label array is resampled to match the volume shape if needed.
    """
    path = Path(label_path)
    logger.info(f"Loading segmentation label: {path.name}")
    try:
        seg_img = nib.load(str(path)) # type: ignore
        seg_arr = np.asarray(seg_img.dataobj, dtype=np.int16) # type: ignore
        seg_arr = np.transpose(seg_arr, (2, 1, 0))  # → (Z,Y,X)
        if seg_arr.shape != volume.shape:
            logger.warning(
                f"Seg shape {seg_arr.shape} != volume shape {volume.shape}; skipping"
            )
            return
        volume.seg_array = seg_arr
        # Build label map from unique values
        unique = np.unique(seg_arr[seg_arr > 0])
        volume.seg_labels = {int(v): f"Structure {int(v)}" for v in unique}
        logger.info(f"  Segmentation labels: {volume.seg_labels}")
    except Exception as e:
        logger.error(f"Failed to load segmentation label: {e}")


def load_segmentation_nrrd(nrrd_path: str | Path, volume: VolumeData) -> None:
    """
    Load a .seg.nrrd Slicer segmentation and attach to VolumeData.
    Handles multi-layer NRRD (each layer is one segment).
    """
    try:
        import nrrd  # pynrrd
    except ImportError:
        logger.warning("pynrrd not installed; skipping .seg.nrrd loading")
        return

    path = Path(nrrd_path)
    logger.info(f"Loading segmentation NRRD: {path.name}")
    try:
        data, header = nrrd.read(str(path))
        # data may be 3D (single label) or 4D (multi-segment)
        if data.ndim == 4:
            # (segments, Z, Y, X) — combine by taking argmax of segments
            # each slice along axis-0 is a binary mask for one segment
            combined = np.zeros(data.shape[1:], dtype=np.int16)
            labels: dict[int, str] = {}
            for seg_idx in range(data.shape[0]):
                mask = data[seg_idx].astype(bool)
                label_id = seg_idx + 1
                combined[mask] = label_id
                # Try to get segment name from header
                name_key = f"Segment{seg_idx}_Name"
                labels[label_id] = header.get(name_key, f"Segment {label_id}")
            seg_arr = np.transpose(combined, (2, 1, 0))  # → (Z,Y,X)
        else:
            # 3D single-label
            seg_arr = np.transpose(data.astype(np.int16), (2, 1, 0))
            unique = np.unique(seg_arr[seg_arr > 0])
            labels = {int(v): f"Structure {int(v)}" for v in unique}

        if seg_arr.shape != volume.shape:
            logger.warning(
                f"NRRD seg shape {seg_arr.shape} != volume shape {volume.shape}; skipping"
            )
            return

        volume.seg_array = seg_arr
        volume.seg_labels = labels
        logger.info(f"  NRRD segments: {labels}")
    except Exception as e:
        logger.error(f"Failed to load NRRD segmentation: {e}")
