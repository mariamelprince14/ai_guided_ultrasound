"""
volume_alignment.py
───────────────────
Affine registration pipeline for standardizing volume alignment
while preserving anatomical variability.

Pipeline:
1. Load CT volumes with DICOM metadata (voxel spacing, slice thickness)
2. Convert to physical (mm) coordinates
3. Resample to canonical spacing (e.g., 1mm³)
4. Define canonical coordinate system (L/R, A/P, H/F)
5. Affine registration (translation + rotation + scaling)
6. Store transformation matrix per patient
7. Apply at runtime for consistent placement
"""

import numpy as np
from pathlib import Path
from typing import Optional, Tuple, Dict, Any
import json
import nibabel as nib
from scipy.ndimage import affine_transform


class AffineAlignment:
    """
    Manages affine registration and volume alignment.
    
    Assumes one template volume; all others aligned to it.
    """
    
    def __init__(self, template_spacing: Tuple[float, float, float] = (1.0, 1.0, 1.0)):
        """
        Parameters:
            template_spacing: Target voxel spacing in mm (x, y, z)
        """
        self.template_spacing = template_spacing
        self.transformations: Dict[str, np.ndarray] = {}
        self.bounds: Dict[str, Dict] = {}
    
    @staticmethod
    def load_volume_with_metadata(nifti_path: str) -> Tuple[np.ndarray, np.ndarray, Dict]:
        """
        Load NIfTI volume and extract metadata.
        
        Returns:
            volume: 3D numpy array (intensity values)
            affine: 4x4 affine matrix (voxel to mm)
            metadata: dict with spacing, shape, etc.
        """
        img: Any = nib.load(nifti_path)
        volume = np.asarray(img.dataobj)
        affine = img.affine
        
        # Extract spacing from affine matrix
        spacing = np.array([
            np.linalg.norm(affine[:3, 0]),
            np.linalg.norm(affine[:3, 1]),
            np.linalg.norm(affine[:3, 2]),
        ])
        
        metadata = {
            'shape': volume.shape,
            'spacing': spacing,
            'affine': affine,
            'bounds': AffineAlignment.compute_bounds(volume, affine),
        }
        
        return volume, affine, metadata
    
    @staticmethod
    def compute_bounds(volume: np.ndarray, affine: np.ndarray) -> Dict:
        """Compute physical bounds (min/max in mm) from volume."""
        shape = volume.shape
        corners = np.array([
            [0, 0, 0, 1],
            [shape[0], 0, 0, 1],
            [0, shape[1], 0, 1],
            [0, 0, shape[2], 1],
            [shape[0], shape[1], 0, 1],
            [shape[0], 0, shape[2], 1],
            [0, shape[1], shape[2], 1],
            [shape[0], shape[1], shape[2], 1],
        ]).T
        
        physical_corners = affine @ corners
        physical_points = physical_corners[:3, :].T
        
        return {
            'min': physical_points.min(axis=0).tolist(),
            'max': physical_points.max(axis=0).tolist(),
            'center': physical_points.mean(axis=0).tolist(),
            'size': (physical_points.max(axis=0) - physical_points.min(axis=0)).tolist(),
        }
    
    def resample_volume(
        self,
        volume: np.ndarray,
        original_affine: np.ndarray,
        target_spacing: Optional[Tuple[float, float, float]] = None,
    ) -> Tuple[np.ndarray, np.ndarray]:
        """
        Resample volume to target spacing.
        
        Parameters:
            volume: original volume
            original_affine: original affine matrix
            target_spacing: target voxel spacing (default: self.template_spacing)
        
        Returns:
            resampled: new volume with target spacing
            new_affine: updated affine matrix
        """
        if target_spacing is None:
            target_spacing = self.template_spacing
        
        # Scaling factors
        scale = np.array(original_affine[:3, 0:3])
        current_spacing = np.array([
            np.linalg.norm(scale[:, i]) for i in range(3)
        ])
        
        zoom_factors = current_spacing / np.array(target_spacing)
        
        # Resample using scipy
        from scipy.ndimage import zoom
        resampled = zoom(volume, zoom_factors, order=1)  # linear interpolation
        
        # Update affine: scale the basis vectors
        new_affine = original_affine.copy()
        new_affine[:3, 0:3] *= (1.0 / zoom_factors)
        
        return resampled, new_affine
    
    @staticmethod
    def compute_centroid(volume: np.ndarray, affine: np.ndarray) -> np.ndarray:
        """Compute physical centroid of volume using center of mass."""
        from scipy.ndimage import center_of_mass
        
        # Binary: non-zero voxels
        binary = (volume > 0).astype(float)
        com_voxel = np.array(center_of_mass(binary))
        
        # Convert to physical coordinates
        com_physical = affine @ np.append(com_voxel, 1)
        
        return com_physical[:3]
    
    def register_volume(
        self,
        moving_volume: np.ndarray,
        moving_affine: np.ndarray,
        template_volume: np.ndarray,
        template_affine: np.ndarray,
        case_id: str,
    ) -> np.ndarray:
        """
        Compute affine transformation to align moving volume to template.
        
        Simplified: align centroids and match principal axes.
        For production, use elastix, ANTs, or SimpleITK.
        
        Parameters:
            moving_volume, moving_affine: volume to register
            template_volume, template_affine: target (template) volume
            case_id: identifier for storing transformation
        
        Returns:
            affine_matrix: 4x4 transformation matrix
        """
        # Compute centroids
        moving_center = self.compute_centroid(moving_volume, moving_affine)
        template_center = self.compute_centroid(template_volume, template_affine)
        
        # Translation to align centroids
        translation = template_center - moving_center
        
        # Simple affine: translation only (can extend with rotation/scale)
        affine_matrix = np.eye(4)
        affine_matrix[:3, 3] = translation
        
        # Store
        self.transformations[case_id] = affine_matrix
        self.bounds[case_id] = self.compute_bounds(moving_volume, moving_affine)
        
        return affine_matrix
    
    def apply_transformation(
        self,
        volume: np.ndarray,
        affine_matrix: np.ndarray,
    ) -> np.ndarray:
        """Apply affine transformation to volume."""
        # Inverse transformation (for interpolation)
        affine_inv = np.linalg.inv(affine_matrix)
        
        # Use scipy affine_transform
        from scipy.ndimage import affine_transform as scipy_affine_transform
        
        # Note: scipy uses inverse mapping
        transformed = scipy_affine_transform(
            volume,
            affine_inv[:3, :3],
            offset=affine_inv[:3, 3],
            order=1,
            cval=0,
        )
        
        return transformed
    
    def save_transformation(self, case_id: str, output_path: str) -> None:
        """Save transformation matrix to JSON."""
        if case_id not in self.transformations:
            raise ValueError(f"No transformation for case {case_id}")
        
        data = {
            'caseId': case_id,
            'affineTransform': {
                'matrix': self.transformations[case_id].tolist(),
                'spacing': self.template_spacing,
            },
            'bounds': self.bounds.get(case_id, {}),
        }
        
        with open(output_path, 'w') as f:
            json.dump(data, f, indent=2)
    
    def load_transformation(self, input_path: str) -> Dict:
        """Load transformation matrix from JSON."""
        with open(input_path, 'r') as f:
            data = json.load(f)
        
        case_id = data['caseId']
        self.transformations[case_id] = np.array(data['affineTransform']['matrix'])
        self.bounds[case_id] = data.get('bounds', {})
        
        return data


def batch_register_volumes(
    dataset_root: Path,
    template_case_id: str,
    output_dir: Path,
    spacing: Tuple[float, float, float] = (1.0, 1.0, 1.0),
) -> None:
    """
    Batch register all volumes to a template.
    
    Parameters:
        dataset_root: root folder with case subdirectories
        template_case_id: which case to use as template
        output_dir: where to save transformation JSON files
        spacing: target spacing in mm
    """
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    
    aligner = AffineAlignment(spacing)
    
    # Find all cases
    case_dirs = sorted([d for d in dataset_root.iterdir() if d.is_dir()])
    
    # Find template
    template_dir = None
    template_volume = None
    template_affine = None
    
    for case_dir in case_dirs:
        nii_files = list(case_dir.glob('*.nii.gz'))
        vol_files = [f for f in nii_files if 'segmentation' not in f.name.lower()]
        
        if vol_files and case_dir.name == template_case_id:
            template_dir = case_dir
            template_volume, template_affine, _ = aligner.load_volume_with_metadata(
                str(vol_files[0])
            )
            # Resample template
            template_volume, template_affine = aligner.resample_volume(
                template_volume, template_affine, spacing
            )
            print(f"Template loaded: {template_case_id}")
            break
    
    if template_volume is None or template_affine is None:
        raise ValueError(f"Template case {template_case_id} not found")
    
    # Register all other cases
    for case_dir in case_dirs:
        nii_files = list(case_dir.glob('*.nii.gz'))
        vol_files = [f for f in nii_files if 'segmentation' not in f.name.lower()]
        
        if not vol_files:
            continue
        
        case_id = case_dir.name
        if case_id == template_case_id:
            # Template maps to identity
            aligner.transformations[case_id] = np.eye(4)
            aligner.bounds[case_id] = AffineAlignment.compute_bounds(
                template_volume, template_affine
            )
        else:
            # Load and register
            moving_volume, moving_affine, _ = aligner.load_volume_with_metadata(
                str(vol_files[0])
            )
            # Resample
            moving_volume, moving_affine = aligner.resample_volume(
                moving_volume, moving_affine, spacing
            )
            
            # Register
            aligner.register_volume(
                moving_volume,
                moving_affine,
                template_volume,
                template_affine,
                case_id,
            )
            
            print(f"Registered: {case_id}")
        
        # Save
        output_file = output_dir / f"{case_id}_alignment.json"
        aligner.save_transformation(case_id, str(output_file))
