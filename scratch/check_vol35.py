import nibabel as nib
import os

path = r"E:\downloads\usdemo\ct.volumes\3d test\test35\6 Unnamed Series.nii.gz"
if os.path.exists(path):
    img = nib.load(path)
    print(f"Shape: {img.shape}")
    print(f"Spacing: {img.header.get_zooms()}")
else:
    print("File not found")
