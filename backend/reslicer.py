"""
reslicer.py
───────────
Core reslicing engine: extracts an arbitrary 2D plane from a 3D CT volume
given a probe's 4×4 world-space transformation matrix.

Algorithm:
  1. Build a grid of (u,v) sample points in the probe's local 2D plane
  2. Transform them to world-mm coordinates using the probe matrix
  3. Convert world-mm → voxel indices using the volume's affine inverse
  4. Sample the 3D array at those voxel coordinates via nearest neighbor interpolation
     (numpy-based replacement for scipy.ndimage.map_coordinates)
  5. Return a 2D float32 numpy array (the extracted slice)
"""
from __future__ import annotations

import logging

import numpy as np
import scipy.ndimage as ndimage

logger = logging.getLogger(__name__)

# Default probe plane dimensions and resolution
DEFAULT_PLANE_SIZE_MM = (150.0, 150.0)   # (width, height) of sampling plane in mm
DEFAULT_RESOLUTION = (512, 512)           # output pixel dimensions


def map_coordinates_nearest(volume: np.ndarray, coords: np.ndarray, cval: float = 0.0) -> np.ndarray:
    """
    Simple nearest neighbor interpolation replacement for scipy.ndimage.map_coordinates.
    coords should be (3, n_points) for 3D volume.
    """
    # Round to nearest integer indices
    indices = np.round(coords).astype(int)
    
    # Clip to volume bounds
    indices = np.clip(indices, 0, np.array(volume.shape)[:, None] - 1)
    
    # Extract values
    return volume[indices[0], indices[1], indices[2]]


def build_affine_inverse(affine: np.ndarray) -> np.ndarray:
    """Pre-compute the inverse affine for repeated use."""
    return np.linalg.inv(affine)


def reslice(
    volume: np.ndarray,          # (D, H, W) float32 in (Z,Y,X) order
    affine_inv: np.ndarray,      # 4×4  world→voxel transform (pre-computed inverse)
    probe_matrix: np.ndarray,    # 4×4  probe pose in world (mm) coords
    plane_size_mm: tuple[float, float] = DEFAULT_PLANE_SIZE_MM,
    resolution: tuple[int, int] = DEFAULT_RESOLUTION,
) -> np.ndarray:
    """
    Extract a 2D CT slice at the given probe position/orientation.

    Returns:
        slice_2d: (H×W) float32 numpy array, same HU range as input volume.
    """
    out_h, out_w = resolution

    # ── 1. Build sampling grid in probe local space (mm) ─────────────────────
    # u = horizontal axis, v = vertical axis of the image plane
    u = np.linspace(-plane_size_mm[0] / 2.0, plane_size_mm[0] / 2.0, out_w)
    v = np.linspace(-plane_size_mm[1] / 2.0, plane_size_mm[1] / 2.0, out_h)
    uu, vv = np.meshgrid(u, v)     # both (out_h, out_w)
    n_pts = out_h * out_w

    # ── 2. Transform to world coords ──────────────────────────────────────────
    # probe_matrix columns:
    #   [:3,0] = right axis (u)
    #   [:3,1] = up axis (v)
    #   [:3,2] = beam normal (not used for point sampling)
    #   [:3,3] = probe origin
    origin   = probe_matrix[:3, 3]          # (3,)
    right_ax = probe_matrix[:3, 0]          # (3,)
    up_ax    = probe_matrix[:3, 1]          # (3,)

    # world_pts shape: (3, n_pts)
    world_pts = (
        origin[:, np.newaxis]
        + right_ax[:, np.newaxis] * uu.ravel()[np.newaxis, :]
        + up_ax[:, np.newaxis]   * vv.ravel()[np.newaxis, :]
    )   # (3, n_pts)

    # Homogeneous
    ones = np.ones((1, n_pts), dtype=np.float64)
    world_h = np.vstack([world_pts, ones])   # (4, n_pts)

    # ── 3. World → voxel coordinates ──────────────────────────────────────────
    # affine_inv maps world (mm) → voxel indices in original (X,Y,Z) nibabel order
    # Our array is stored as (Z,Y,X), so we swap axes after
    vox = affine_inv @ world_h   # (4, n_pts)

    # nibabel affine: voxel order is (i,j,k) = (X,Y,Z)
    # Our array is (Z,Y,X) so coords are:  [k=vox[2], j=vox[1], i=vox[0]]
    coords_z = vox[2].reshape(out_h, out_w)   # → depth axis
    coords_y = vox[1].reshape(out_h, out_w)   # → height axis
    coords_x = vox[0].reshape(out_h, out_w)   # → width axis

    coords = np.array([coords_z, coords_y, coords_x])  # (3, out_h, out_w)

    # ── 4. Nearest neighbor interpolation ────────────────────────────────────────────
    slice_2d = map_coordinates_nearest(
        volume,
        coords.reshape(3, -1),   # (ndim, n_pts)
        cval=volume.min(),       # fill outside volume with background
    ).reshape(out_h, out_w).astype(np.float32)

    return slice_2d


def reslice_segmentation(
    seg_array: np.ndarray,      # (D, H, W) int16 label array
    affine_inv: np.ndarray,
    probe_matrix: np.ndarray,
    plane_size_mm: tuple[float, float] = DEFAULT_PLANE_SIZE_MM,
    resolution: tuple[int, int] = DEFAULT_RESOLUTION,
) -> np.ndarray:
    """
    Extract segmentation labels at the probe plane.
    Uses nearest-neighbor interpolation (order=0) to preserve label integers.
    """
    out_h, out_w = resolution
    u = np.linspace(-plane_size_mm[0] / 2.0, plane_size_mm[0] / 2.0, out_w)
    v = np.linspace(-plane_size_mm[1] / 2.0, plane_size_mm[1] / 2.0, out_h)
    uu, vv = np.meshgrid(u, v)
    n_pts = out_h * out_w

    origin   = probe_matrix[:3, 3]
    right_ax = probe_matrix[:3, 0]
    up_ax    = probe_matrix[:3, 1]

    world_pts = (
        origin[:, np.newaxis]
        + right_ax[:, np.newaxis] * uu.ravel()[np.newaxis, :]
        + up_ax[:, np.newaxis]   * vv.ravel()[np.newaxis, :]
    )
    ones = np.ones((1, n_pts), dtype=np.float64)
    world_h = np.vstack([world_pts, ones])
    vox = affine_inv @ world_h

    coords_z = vox[2].reshape(out_h, out_w)
    coords_y = vox[1].reshape(out_h, out_w)
    coords_x = vox[0].reshape(out_h, out_w)
    coords = np.array([coords_z, coords_y, coords_x])

    seg_slice = map_coordinates_nearest(
        seg_array.astype(np.float32),
        coords.reshape(3, -1),
        cval=0.0,
    ).reshape(out_h, out_w).astype(np.int16)

    return seg_slice


def compute_volume_bounds_world(shape: tuple, affine: np.ndarray) -> dict:
    """
    Compute the world-space bounding box of the volume (in mm).
    Returns min/max for x,y,z and the center.
    Needed to initialize the probe at a sensible default position.
    """
    D, H, W = shape
    # 8 corners of the volume in voxel space
    corners_vox = np.array([
        [0, 0, 0, 1], [W, 0, 0, 1], [0, H, 0, 1], [W, H, 0, 1],
        [0, 0, D, 1], [W, 0, D, 1], [0, H, D, 1], [W, H, D, 1],
    ], dtype=np.float64).T   # (4,8)

    # nibabel affine maps (X,Y,Z) voxel → world, but our shape is (Z,Y,X)
    # so corners in nibabel order are (W→i, H→j, D→k):
    corners_world = affine @ corners_vox   # (4,8)

    xs = corners_world[0]
    ys = corners_world[1]
    zs = corners_world[2]

    return {
        "min": [float(xs.min()), float(ys.min()), float(zs.min())],
        "max": [float(xs.max()), float(ys.max()), float(zs.max())],
        "center": [float(xs.mean()), float(ys.mean()), float(zs.mean())],
    }


def get_downsampled_volume(
    array: np.ndarray, 
    max_dim: int = 128
) -> tuple[np.ndarray, tuple[float, float, float]]:
    """
    Downsample a 3D volume for frontend visualization.
    Returns (downsampled_array, scale_factors).
    """
    current_shape = array.shape
    factors = [max_dim / s if s > max_dim else 1.0 for s in current_shape]
    
    # Using order=1 (bilinear) for balance of speed and smoothness
    downsampled = ndimage.zoom(array, factors, order=1)
    
    return downsampled, tuple(factors)
