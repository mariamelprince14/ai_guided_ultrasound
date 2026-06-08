"""
inspect_affine.py
-----------------
Reads the NIfTI affine for test35 and prints all orientation information
needed for anatomical embedding.
"""
import sys
sys.path.insert(0, r'e:\downloads\usdemo\backend')

import numpy as np
import nibabel as nib

VOLUME_PATH = r'e:\downloads\usdemo\ct.volumes\3d test\test35\6 Unnamed Series.nii.gz'

img = nib.load(VOLUME_PATH)
affine = img.affine.astype(np.float64)
header = img.header
shape = img.shape  # (X, Y, Z) nibabel order

print("=== NIfTI Volume: test35 ===")
print(f"Shape (X,Y,Z nibabel): {shape}")
print(f"Voxel spacing: {header.get_zooms()[:3]}")
print()
print("=== Affine Matrix (4x4) ===")
print("Maps voxel (i,j,k) -> world (x,y,z) in mm")
print(np.array2string(affine, precision=4, suppress_small=True))
print()

# Extract direction cosines (columns 0,1,2 of affine, normalized)
dc_i = affine[:3, 0] / np.linalg.norm(affine[:3, 0])  # voxel i-axis → world
dc_j = affine[:3, 1] / np.linalg.norm(affine[:3, 1])  # voxel j-axis → world
dc_k = affine[:3, 2] / np.linalg.norm(affine[:3, 2])  # voxel k-axis → world

print("=== Direction Cosines ===")
print(f"i-axis (columns) -> world: [{dc_i[0]:.4f}, {dc_i[1]:.4f}, {dc_i[2]:.4f}]")
print(f"j-axis (rows)    -> world: [{dc_j[0]:.4f}, {dc_j[1]:.4f}, {dc_j[2]:.4f}]")
print(f"k-axis (slices)  -> world: [{dc_k[0]:.4f}, {dc_k[1]:.4f}, {dc_k[2]:.4f}]")
print()

# Determine orientation labels
def axis_label(v):
    ax = np.argmax(np.abs(v))
    dirs = ['X(R)', 'Y(A)', 'Z(S)']
    sign = '+' if v[ax] > 0 else '-'
    return f"{sign}{dirs[ax]}"

print(f"i-axis encodes: {axis_label(dc_i)}")
print(f"j-axis encodes: {axis_label(dc_j)}")
print(f"k-axis encodes: {axis_label(dc_k)}")
print()

# World bounds (convert corners to world coords)
D, H, W = shape[2], shape[1], shape[0]  # nibabel shape is (X,Y,Z), so W=X,H=Y,D=Z
corners_vox = np.array([
    [0, 0, 0, 1], [W, 0, 0, 1], [0, H, 0, 1], [W, H, 0, 1],
    [0, 0, D, 1], [W, 0, D, 1], [0, H, D, 1], [W, H, D, 1],
], dtype=np.float64).T
corners_world = affine @ corners_vox

print("=== World Bounds (mm) ===")
for i, label in enumerate(['X(R-L)', 'Y(A-P)', 'Z(S-I)']):
    vals = corners_world[i]
    print(f"  {label}: [{vals.min():.1f}, {vals.max():.1f}]  range={vals.max()-vals.min():.1f}mm")
print()

# Check if it's standard RAS or LPS etc.
ornt = nib.orientations.io_orientation(affine)
print("=== Nibabel Orientation ===")
axcodes = nib.orientations.ornt2axcodes(ornt)
print(f"  Axis codes: {axcodes}")
print(f"  (R/L=Right/Left, A/P=Anterior/Posterior, S/I=Superior/Inferior)")
print()

# World center
center = corners_world[:3].mean(axis=1)
print(f"=== Volume Center (world mm) ===")
print(f"  [{center[0]:.1f}, {center[1]:.1f}, {center[2]:.1f}]")
print()

# Patient orientation from header
try:
    srow_x = header['srow_x']
    srow_y = header['srow_y']
    srow_z = header['srow_z']
    print("=== sform srows ===")
    print(f"  srow_x: {srow_x}")
    print(f"  srow_y: {srow_y}")
    print(f"  srow_z: {srow_z}")
    print(f"  sform_code: {header['sform_code']}")
    print(f"  qform_code: {header['qform_code']}")
except Exception as e:
    print(f"Could not read sform: {e}")
