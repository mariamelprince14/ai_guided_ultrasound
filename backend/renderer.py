import os
import cv2
import base64
import numpy as np
import torch
import torch.nn as nn
import torchvision.transforms.functional as TF

# ==============================================================================
# 1. PYTORCH MODEL ARCHITECTURE DEFINITION
# ==============================================================================
class DownBlock(nn.Module):
    def __init__(self, in_ch, out_ch, norm=True):
        super().__init__()
        layers: list[nn.Module] = [nn.Conv2d(in_ch, out_ch, 4, 2, 1, bias=False)]
        if norm: layers.append(nn.BatchNorm2d(out_ch))
        layers.append(nn.LeakyReLU(0.2, inplace=True))
        self.net = nn.Sequential(*layers)
    def forward(self, x): return self.net(x)

class UpBlock(nn.Module):
    def __init__(self, in_ch, out_ch, dropout=False):
        super().__init__()
        layers: list[nn.Module] = [
            nn.ConvTranspose2d(in_ch, out_ch, 4, 2, 1, bias=False),
            nn.BatchNorm2d(out_ch),
            nn.ReLU(inplace=True),
        ]
        if dropout: layers.append(nn.Dropout(0.5))
        self.net = nn.Sequential(*layers)
    def forward(self, x, skip): return torch.cat([self.net(x), skip], dim=1)

class UNetGenerator(nn.Module):
    def __init__(self):
        super().__init__()
        self.d1, self.d2, self.d3, self.d4 = DownBlock(5, 64, norm=False), DownBlock(64, 128), DownBlock(128, 256), DownBlock(256, 512)
        self.d5, self.d6, self.d7, self.d8 = DownBlock(512, 512), DownBlock(512, 512), DownBlock(512, 512), DownBlock(512, 512, norm=False)
        self.u1, self.u2, self.u3, self.u4 = UpBlock(512, 512, dropout=True), UpBlock(1024, 512, dropout=True), UpBlock(1024, 512, dropout=True), UpBlock(1024, 512)
        self.u5, self.u6, self.u7 = UpBlock(1024, 256), UpBlock(512, 128), UpBlock(256, 64)
        self.final = nn.Sequential(nn.ConvTranspose2d(128, 1, 4, 2, 1), nn.Tanh())

    def forward(self, x):
        d1 = self.d1(x); d2 = self.d2(d1); d3 = self.d3(d2); d4 = self.d4(d3)
        d5 = self.d5(d4); d6 = self.d6(d5); d7 = self.d7(d6); d8 = self.d8(d7)
        u1 = self.u1(d8, d7); u2 = self.u2(u1, d6); u3 = self.u3(u2, d5); u4 = self.u4(u3, d4)
        u5 = self.u5(u4, d3); u6 = self.u6(u5, d2); u7 = self.u7(u6, d1)
        return self.final(u7)

# ==============================================================================
# 2. RUNTIME MODEL INITIALIZATION
# ==============================================================================
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
WEIGHTS_PATH = os.path.join(os.path.dirname(__file__), "weights/generator_final.pth")

print(f"🧠 Loading Deep Learning Simulation Engine on: {DEVICE.upper()}")
G_axial = UNetGenerator().to(DEVICE)

if os.path.exists(WEIGHTS_PATH):
    G_axial.load_state_dict(torch.load(WEIGHTS_PATH, map_location=DEVICE))
    G_axial.eval()
    print(f"🎯 AI-Engine successfully loaded weights: {os.path.basename(WEIGHTS_PATH)}")
else:
    print(f"⚠️ Warning: Model weights not found at {WEIGHTS_PATH}. Running uninitialized.")

# ==============================================================================
# 3. CORE AI GENERATION PIPELINE
# ==============================================================================

# Cache for per-volume normalization bounds (matches training's normalize_volume)
_volume_norm_cache: dict[int, tuple[float, float]] = {}

def _get_volume_norm_bounds(volume_3d):
    """
    Compute percentile-based normalization bounds for the entire volume.
    Matches the training pipeline's normalize_volume(volume, clip_percentile=0.5).
    Cached per volume to avoid recomputation each frame.
    """
    vol_id = id(volume_3d)
    if vol_id not in _volume_norm_cache:
        import numpy as _np
        lo = float(_np.percentile(volume_3d, 0.5))
        hi = float(_np.percentile(volume_3d, 99.5))
        if hi - lo < 1e-8:
            hi = lo + 1.0
        _volume_norm_cache[vol_id] = (lo, hi)
        print(f"📊 Volume normalization bounds (percentile 0.5/99.5): [{lo:.1f}, {hi:.1f}]")
    return _volume_norm_cache[vol_id]


def generate_ai_ultrasound_frame(volume_3d, slice_idx, wl=40, ww=400):
    """
    Extracts an axial 2.5D slab block from the cached NIfTI volume array,
    preprocesses it identically to the training pipeline, runs model inference,
    and returns a Base64 encoded string.
    
    Training preprocessing (from CT_to_US_Pix2Pix_MultiPlanar.ipynb):
        1. normalize_volume: clip at 0.5th/99.5th percentile → scale to [0, 1]
        2. Dataset.__getitem__: resize to 256×256, then scale [0,1] → [-1,1]
    """
    max_z = volume_3d.shape[0]
    
    # Boundary clamp safety check
    slice_idx = max(2, min(slice_idx, max_z - 3))
    
    # Get volume-level normalization bounds (matches training)
    lo, hi = _get_volume_norm_bounds(volume_3d)
    
    # Extract 5-channel 2.5D slab with training-matched preprocessing
    ct_slices = []
    for offset in [-2, -1, 0, 1, 2]:
        raw_slice = volume_3d[slice_idx + offset, :, :]
        
        # Step A: Percentile clip + scale to [0, 1] (matches normalize_volume)
        clipped = np.clip(raw_slice, lo, hi)
        norm_01 = ((clipped - lo) / (hi - lo)).astype(np.float32)
        
        # Step B: Resize to 256×256 (matches Dataset.__getitem__)
        tensor_slice = torch.from_numpy(norm_01).unsqueeze(0)
        resized_slice = TF.resize(tensor_slice, [256, 256], antialias=True)
        
        # Step C: Scale [0, 1] → [-1, 1] (matches Dataset.__getitem__: ct * 2.0 - 1.0)
        resized_np = resized_slice.squeeze(0).numpy()
        ct_slices.append(resized_np * 2.0 - 1.0)
        
    ct_slab = np.stack(ct_slices, axis=0).astype(np.float32)
    input_tensor = torch.from_numpy(ct_slab).unsqueeze(0).to(DEVICE)
    
    # Forward pass (model outputs Tanh → [-1, 1])
    with torch.no_grad():
        predicted_tensor = G_axial(input_tensor)
        
    # Denormalize: Tanh [-1,1] → [0,255]
    us_array = predicted_tensor.squeeze().cpu().numpy().astype(np.float32)
    final_frame = np.clip((us_array + 1.0) / 2.0 * 255.0, 0, 255).astype(np.uint8)
        
    # Compress to PNG and encode as base64
    _, buffer = cv2.imencode('.png', final_frame)
    b64_string = base64.b64encode(buffer.tobytes()).decode('utf-8')
    
    return f"data:image/png;base64,{b64_string}"