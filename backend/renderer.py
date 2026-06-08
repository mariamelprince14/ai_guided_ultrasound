"""
renderer.py
───────────
Converts a raw CT slice (HU float32 array) into a visually realistic
ultrasound-like PNG image, with optional segmentation overlay.

Steps:
  1. Window/Level the CT values (HU → 0-255)
  2. Apply ultrasound-like appearance:
     - Speckle noise
     - Slight blurring + edge sharpening
     - Depth attenuation gradient
  3. Overlay segmentation mask with semi-transparent color coding
  4. Encode to PNG bytes (returned as bytes for HTTP or base64 for WebSocket)
"""
from __future__ import annotations

import base64
import io
import logging
import time
from typing import Optional

import numpy as np
from PIL import Image, ImageFilter, ImageEnhance

logger = logging.getLogger(__name__)

# Color palette for segmentation labels (RGBA)
SEG_COLORS: dict[int, tuple[int, int, int, int]] = {
    1: (255,  80,  80, 160),   # Red   — Structure 1
    2: ( 80, 200, 255, 160),   # Cyan  — Structure 2
    3: ( 80, 255, 120, 160),   # Green — Structure 3
    4: (255, 200,  60, 160),   # Gold  — Structure 4
    5: (200,  80, 255, 160),   # Violet
    6: (255, 150,  50, 160),   # Orange
    7: ( 50, 150, 255, 160),   # Blue
    8: (255, 255,  80, 160),   # Yellow
}
DEFAULT_SEG_COLOR = (200, 200, 200, 130)


def window_level(
    arr: np.ndarray,
    wl: float = 60.0,      # window level (center) in HU
    ww: float = 360.0,     # window width in HU
) -> np.ndarray:
    """
    Apply window/level clipping and rescale to [0, 255] uint8.
    Defaults are suitable for soft-tissue / abdominal view.
    """
    lo = wl - ww / 2.0
    hi = wl + ww / 2.0
    clipped = np.clip(arr, lo, hi)
    scaled = ((clipped - lo) / (hi - lo) * 255.0).astype(np.uint8)
    return scaled


def apply_ultrasound_appearance(img_arr: np.ndarray, pressure: float = 0.0) -> np.ndarray:
    """
    Apply lightweight ultrasound-like post-processing to a uint8 grayscale array.
    Adjusts speckle noise level and depth attenuation gradient dynamically under pressure.
    Returns uint8 array of same shape.
    """
    H, W = img_arr.shape

    # --- Speckle noise (multiplicative) ---
    # As pressure increases, speckle noise variance decreases (clearer image)
    noise_variance = 0.045 * (1.0 - 0.4 * pressure)
    rng = np.random.default_rng(seed=42)   # fixed seed for reproducibility
    noise = rng.normal(loc=1.0, scale=noise_variance, size=(H, W))
    noisy = np.clip(img_arr.astype(np.float32) * noise, 0, 255).astype(np.uint8)

    # --- Depth attenuation gradient (darker at bottom = deeper tissue) ---
    # As pressure increases, acoustic transmission improves, decreasing deep attenuation
    deep_attenuation = 0.65 + 0.15 * pressure
    gradient = np.linspace(1.0, deep_attenuation, H, dtype=np.float32)[:, np.newaxis]
    attenuated = np.clip(noisy.astype(np.float32) * gradient, 0, 255).astype(np.uint8)

    # --- PIL for blur/sharpen ---
    pil_img = Image.fromarray(attenuated, mode='L')
    pil_img = pil_img.filter(ImageFilter.GaussianBlur(radius=0.6))
    pil_img = pil_img.filter(ImageFilter.UnsharpMask(radius=1, percent=60, threshold=2))
    enhancer = ImageEnhance.Contrast(pil_img)
    pil_img = enhancer.enhance(1.25)

    return np.array(pil_img, dtype=np.uint8)


def get_probe_mask(output_size: tuple[int, int], probe_type: str) -> np.ndarray:
    """
    Generate a high-fidelity, feathered 2D viewport mask for the selected probe.
      - 'linear': Rectangular profile.
      - 'phased_array': Narrow apex wedge profile.
      - 'curvilinear' / others: Wide fan-shaped sector profile.
    """
    W, H = output_size
    u = np.linspace(-1.0, 1.0, W)
    v = np.linspace(0.0, 1.0, H)
    uu, vv = np.meshgrid(u, v)
    
    if probe_type == "linear":
        # Flat rectangular beam profile with feathered vertical edges
        mask = np.clip((0.85 - np.abs(uu)) / 0.03, 0.0, 1.0)
    elif probe_type == "phased_array":
        # Narrow apex point expanding rapidly into a wide wedge
        v_apex = 0.02
        r = np.sqrt(uu**2 + (vv + v_apex)**2)
        theta = np.abs(np.arctan2(uu, vv + v_apex))
        
        angle_soft = np.clip((0.58 - theta) / 0.03, 0.0, 1.0)
        depth_soft = np.clip((r - 0.06) / 0.02, 0.0, 1.0) * np.clip((1.02 - r) / 0.03, 0.0, 1.0)
        mask = angle_soft * depth_soft
    else:  # curvilinear
        # Fan-shaped sector with a wide curved top footprint
        v_apex = 0.4
        r = np.sqrt(uu**2 + (vv + v_apex)**2)
        theta = np.abs(np.arctan2(uu, vv + v_apex))
        
        angle_soft = np.clip((0.42 - theta) / 0.03, 0.0, 1.0)
        depth_soft = np.clip((r - 0.44) / 0.02, 0.0, 1.0) * np.clip((1.40 - r) / 0.03, 0.0, 1.0)
        mask = angle_soft * depth_soft
        
    return mask


def render_slice(
    ct_slice: np.ndarray,
    seg_slice: Optional[np.ndarray] = None,
    show_segmentation: bool = False,
    window_level_params: tuple[float, float] = (60.0, 360.0),
    apply_us_appearance: bool = True,
    output_size: tuple[int, int] = (512, 512),   # (W, H)
    pressure: float = 0.0,
    contact_quality: float = 100.0,
    probe_type: str = "curvilinear",
    yaw: float = 0.0,
    pitch: float = 0.0,
    roll: float = 0.0,
) -> bytes:
    """
    Full render pipeline. Computes acoustic shadowing, tissue anisotropy,
    contact pressure modifications, gel coupling static, masking, and mirroring.
    Returns raw PNG bytes.
    """
    wl, ww = window_level_params
    H_raw, W_raw = ct_slice.shape

    # ── 1. Acoustic Shadowing (applied on raw HU values for physics accuracy) ──
    ct_slice_processed = ct_slice.copy()
    transmission = np.ones(W_raw, dtype=np.float32)
    # Cortical bone is typically > 250 HU, dense bone/ribs > 600 HU
    for y in range(H_raw):
        ct_slice_processed[y, :] *= transmission
        density = ct_slice[y, :]
        attenuation = np.where(density > 250.0, 0.12, 1.0)
        attenuation = np.where(density > 600.0, 0.01, attenuation)
        transmission *= attenuation

    # ── 2. Tissue Anisotropy (dims organized muscle layers under probe tilt) ──
    tilt_angle = np.sqrt(pitch**2 + roll**2)
    # Dimming factor: dims muscle by up to 55% at 45 degrees tilt
    anisotropy_factor = 1.0 - 0.55 * min(1.0, tilt_angle / 45.0)
    # Muscles and linear tissues reside around 35 to 80 HU
    muscle_mask = (ct_slice_processed >= 35.0) & (ct_slice_processed <= 80.0)
    ct_slice_processed[muscle_mask] *= anisotropy_factor

    # ── 3. Window/Level rescaled to [0, 255] ──
    gray = window_level(ct_slice_processed, wl=wl, ww=ww)

    # ── 4. Ultrasound post-processing (speckle & attenuation) ──
    if apply_us_appearance:
        gray = apply_ultrasound_appearance(gray, pressure=pressure)

    # ── 5. Resize to output viewport dimensions ──
    if gray.shape[::-1] != output_size:
        pil_gray = Image.fromarray(gray, mode='L').resize(output_size, Image.BILINEAR)
        gray = np.array(pil_gray)

    # ── 6. Acoustic Coupling (Gel Simulation & Air Static Noise) ──
    coupling = contact_quality / 100.0
    if coupling < 1.0:
        # Dynamic seed allows the grainy static noise to flicker/animate realistically
        seed = int(time.time() * 1000) % 100000
        rng = np.random.default_rng(seed=seed)
        noise_H, noise_W = output_size[1] // 2, output_size[0] // 2
        raw_noise = rng.uniform(20, 180, (noise_H, noise_W)).astype(np.uint8)
        static_pil = Image.fromarray(raw_noise, mode='L').resize(output_size, Image.NEAREST)
        static_noise = np.array(static_pil, dtype=np.uint8)
        
        # Blend grayscale image with grainy static
        gray = np.clip(coupling * gray + (1.0 - coupling) * static_noise, 0, 255).astype(np.uint8)

    # ── 7. Beam Profile & Footprint Masking ──
    mask = get_probe_mask(output_size, probe_type)
    gray = (gray * mask).astype(np.uint8)

    # ── 8. Orientation Tracking Mirroring ──
    # If the user rotates the probe 180 degrees (upside down), flip horizontally
    normalized_yaw = yaw % 360
    is_mirrored = 90.0 <= normalized_yaw < 270.0
    if is_mirrored:
        gray = np.fliplr(gray)

    # ── 9. Convert to RGBA for overlay blending ──
    rgba = Image.fromarray(gray, mode='L').convert('RGBA')
    rgb_arr = np.array(rgba, dtype=np.uint8)  # (H, W, 4)

    # ── 10. Segmentation overlay ──
    if show_segmentation and seg_slice is not None:
        if seg_slice.shape[::-1] != output_size:
            seg_pil = Image.fromarray(seg_slice.astype(np.uint8), mode='L').resize(
                output_size, Image.NEAREST)
            seg_arr = np.array(seg_pil, dtype=np.int16)
        else:
            seg_arr = seg_slice.astype(np.int16)

        if is_mirrored:
            seg_arr = np.fliplr(seg_arr)

        overlay = np.zeros((*seg_arr.shape, 4), dtype=np.uint8)
        for label_id, color in SEG_COLORS.items():
            mask_seg = seg_arr == label_id
            if mask_seg.any():
                overlay[mask_seg] = color
        # Alpha blend
        alpha = overlay[:, :, 3:4].astype(np.float32) / 255.0
        rgb_arr[:, :, :3] = np.clip(
            rgb_arr[:, :, :3].astype(np.float32) * (1 - alpha)
            + overlay[:, :, :3].astype(np.float32) * alpha,
            0, 255
        ).astype(np.uint8)

    # ── 11. Encode to PNG bytes ──
    result_img = Image.fromarray(rgb_arr, mode='RGBA')
    buf = io.BytesIO()
    result_img.save(buf, format='PNG', optimize=False)
    return buf.getvalue()


def render_to_base64(
    ct_slice: np.ndarray,
    seg_slice: Optional[np.ndarray] = None,
    show_segmentation: bool = False,
    window_level_params: tuple[float, float] = (60.0, 360.0),
    apply_us_appearance: bool = True,
    output_size: tuple[int, int] = (512, 512),
    pressure: float = 0.0,
    contact_quality: float = 100.0,
    probe_type: str = "curvilinear",
    yaw: float = 0.0,
    pitch: float = 0.0,
    roll: float = 0.0,
) -> str:
    """Render and return base64-encoded PNG string (no data: prefix)."""
    png_bytes = render_slice(
        ct_slice,
        seg_slice=seg_slice,
        show_segmentation=show_segmentation,
        window_level_params=window_level_params,
        apply_us_appearance=apply_us_appearance,
        output_size=output_size,
        pressure=pressure,
        contact_quality=contact_quality,
        probe_type=probe_type,
        yaw=yaw,
        pitch=pitch,
        roll=roll,
    )
    return base64.b64encode(png_bytes).decode('ascii')
