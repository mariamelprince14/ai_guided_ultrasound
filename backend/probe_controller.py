"""
probe_controller.py
───────────────────
Converts probe pose (position + Euler rotations) into a 4×4 homogeneous
transformation matrix used by the reslicing engine.

Convention:
  - position: (x, y, z) in mm in RAS world coordinates
  - rotation: pitch (around X), yaw (around Y), roll (around Z) in degrees
  - Output matrix M: world = M @ local
    - M[:3, 0] = probe "right" axis
    - M[:3, 1] = probe "up" axis  (along scan lines)
    - M[:3, 2] = probe "normal" (beam direction, into tissue)
    - M[:3, 3] = probe origin in world mm
"""
from __future__ import annotations

import math
from dataclasses import dataclass

import numpy as np


@dataclass
class ProbePose:
    x: float = 0.0          # mm
    y: float = 0.0          # mm
    z: float = 0.0          # mm
    pitch: float = 0.0      # degrees, rotation around X
    yaw: float = 0.0        # degrees, rotation around Y
    roll: float = 0.0       # degrees, rotation around Z


def euler_to_rotation_matrix(pitch_deg: float, yaw_deg: float, roll_deg: float) -> np.ndarray:
    """
    Build a 3×3 rotation matrix from Euler angles (degrees).
    Order: Rz(roll) @ Ry(yaw) @ Rx(pitch)  — extrinsic XYZ convention
    """
    p = math.radians(pitch_deg)
    y = math.radians(yaw_deg)
    r = math.radians(roll_deg)

    cp, sp = math.cos(p), math.sin(p)
    cy, sy = math.cos(y), math.sin(y)
    cr, sr = math.cos(r), math.sin(r)

    # Rx
    Rx = np.array([[1, 0, 0],
                   [0, cp, -sp],
                   [0, sp,  cp]])
    # Ry
    Ry = np.array([[ cy, 0, sy],
                   [  0, 1,  0],
                   [-sy, 0, cy]])
    # Rz
    Rz = np.array([[cr, -sr, 0],
                   [sr,  cr, 0],
                   [ 0,   0, 1]])

    return Rz @ Ry @ Rx


def pose_to_matrix(pose: ProbePose) -> np.ndarray:
    """
    Convert a ProbePose to a 4×4 homogeneous transformation matrix.
    """
    R = euler_to_rotation_matrix(pose.pitch, pose.yaw, pose.roll)
    M = np.eye(4, dtype=np.float64)
    M[:3, :3] = R
    M[:3, 3] = [pose.x, pose.y, pose.z]
    return M


def matrix_to_pose(M: np.ndarray) -> ProbePose:
    """
    Extract ProbePose from a 4×4 matrix.
    (Approximate Euler decomposition — ZYX convention.)
    """
    x, y, z = M[:3, 3]
    # Extract Euler angles from rotation matrix (ZYX)
    R = M[:3, :3]
    yaw = math.degrees(math.atan2(-R[2, 0], math.sqrt(R[0, 0]**2 + R[1, 0]**2)))
    pitch = math.degrees(math.atan2(R[2, 1], R[2, 2]))
    roll = math.degrees(math.atan2(R[1, 0], R[0, 0]))
    return ProbePose(x=x, y=y, z=z, pitch=pitch, yaw=yaw, roll=roll)


def default_axial_matrix(volume_center_world: list[float]) -> np.ndarray:
    """
    Returns a probe matrix centered in the volume, oriented in the axial plane.
    This gives the trainee a useful starting view (not empty space).
    """
    cx, cy, cz = volume_center_world
    M = np.eye(4, dtype=np.float64)
    # Default orientation: right = +X, up = +Y, normal = +Z (axial view)
    M[:3, 3] = [cx, cy, cz]
    return M


def clamp_pose_to_volume(pose: ProbePose,
                         volume_min: list[float],
                         volume_max: list[float]) -> ProbePose:
    """Clamp position so probe stays within volume bounding box."""
    def clamp(v, lo, hi): return max(lo, min(hi, v))
    return ProbePose(
        x=clamp(pose.x, volume_min[0], volume_max[0]),
        y=clamp(pose.y, volume_min[1], volume_max[1]),
        z=clamp(pose.z, volume_min[2], volume_max[2]),
        pitch=pose.pitch,
        yaw=pose.yaw,
        roll=pose.roll,
    )
