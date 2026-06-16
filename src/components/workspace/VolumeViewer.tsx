/**
 * VolumeViewer.tsx
 * ─────────────────
 * Interactive 3D CT volume viewer using @react-three/fiber + Three.js.
 *
 * Features:
 *   - Semi-transparent volume bounding box (scaled to real mm from volumeInfo)
 *   - Anatomical orientation planes (faint axial/coronal/sagittal cross-hairs)
 *   - Probe mesh (cylinder + cone, colored teal/green) that follows probePos/probeRot
 *   - Slice plane (translucent indigo plane) that matches current probe transform
 *   - 3D drag interaction: drag the probe → updates Zustand store → sends to backend → 2D slice updates
 *   - OrbitControls for camera pan/zoom/rotate (independent of probe drag)
 *   - HUD overlay showing probe coordinates
 */
import React, { useRef, useCallback } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import {
    OrbitControls,
    PerspectiveCamera,
    ContactShadows,
} from '@react-three/drei';
import * as THREE from 'three';
import { Target, Compass, Move, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { useAppStore } from '@store/useAppStore';
import { wsService } from '@services/websocket';
import type { VolumeVoxelData } from '@/types';
import {
    raycastProbeHit,
    buildNormalAlignedRotation,
    clampProbeToVolume,
    DEFAULT_PROBE_CONSTRAINTS,
} from '@/utils/ProbeRaycasting';
import {
    ProbeStabilityTracker,
    computeContactQualityFromAngles,
    exceedsDeadZone,
    adaptiveSmoothFactor,
} from '@/utils/ProbeMetrics';

import { TorsoMesh } from './TorsoMesh';
import { Volume35TorsoMesh } from './Volume35TorsoMesh';
import { RealisticProbe } from './RealisticProbeModels';
import { Volume35TorsoOverlays } from './Volume35TorsoOverlays';
import { AnatomyDebugOverlay } from './AnatomyDebugOverlay';
import { isVolume35Case } from '@/utils/Volume35Integration';
import { subjectToNifti, niftiToSubject } from '@/utils/AnatomicalEmbedding';

import styles from './VolumeViewer.module.css';

// ── Euler helper (matches backend: Rz @ Ry @ Rx — extrinsic XYZ) ────────────
function buildProbeMatrix(
    pos: { x: number; y: number; z: number },
    rot: { pitch: number; yaw: number; roll: number },
    normal: { x: number; y: number; z: number } = { x: 0, y: 1, z: 0 }
): THREE.Matrix4 {
    const targetNormal = new THREE.Vector3(normal.x, normal.y, normal.z).normalize();
    const alignQuat = buildNormalAlignedRotation(targetNormal);

    const pitchRad = THREE.MathUtils.degToRad(rot.pitch);
    const yawRad = THREE.MathUtils.degToRad(rot.yaw);
    const rollRad = THREE.MathUtils.degToRad(rot.roll);
    const userQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(pitchRad, yawRad, rollRad, 'YXZ'));

    const finalQuat = alignQuat.multiply(userQuat).normalize();
    const matrix = new THREE.Matrix4().makeRotationFromQuaternion(finalQuat);
    matrix.setPosition(pos.x, pos.y, pos.z);
    return matrix;
}

// ── Raymarching Shader ────────────────────────────────────────────────────────
const VOLUME_VERTEX_SHADER = `
  varying vec3 v_local_pos;
  void main() {
    v_local_pos = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const VOLUME_FRAGMENT_SHADER = `
  precision highp float;
  precision highp sampler3D;
  precision highp int;

  uniform sampler3D u_data;
  uniform vec3 u_cam_pos;
  uniform vec3 u_min;
  uniform vec3 u_max;
  uniform float u_wl;
  uniform float u_ww;
  uniform float u_volume_opacity;
  
  uniform bool u_clipping_enabled;
  uniform vec3 u_probe_pos;
  
  varying vec3 v_local_pos;

  // Random number for jittering to reduce banding
  float rand(vec2 co) {
    return fract(sin(dot(co.xy, vec2(12.9898, 78.233))) * 43758.5453);
  }

  // Ray-box intersection helper
  vec2 intersect_box(vec3 orig, vec3 dir) {
    vec3 inv_dir = 1.0 / dir;
    vec3 t0 = (u_min - orig) * inv_dir;
    vec3 t1 = (u_max - orig) * inv_dir;
    vec3 tmin = min(t0, t1);
    vec3 tmax = max(t0, t1);
    float t_start = max(max(tmin.x, tmin.y), tmin.z);
    float t_end = min(min(tmax.x, tmax.y), tmax.z);
    return vec2(t_start, t_end);
  }

  // Safe gradient estimation with epsilon to prevent NaN
  vec3 get_gradient(vec3 uvw) {
    float h = 0.005; // Step size for central differences
    float v0 = texture(u_data, uvw + vec3(h, 0.0, 0.0)).r;
    float v1 = texture(u_data, uvw - vec3(h, 0.0, 0.0)).r;
    float v2 = texture(u_data, uvw + vec3(0.0, h, 0.0)).r;
    float v3 = texture(u_data, uvw - vec3(0.0, h, 0.0)).r;
    float v4 = texture(u_data, uvw + vec3(0.0, 0.0, h)).r;
    float v5 = texture(u_data, uvw - vec3(0.0, 0.0, h)).r;
    vec3 g = vec3(v0 - v1, v2 - v3, v4 - v5);
    float len = length(g);
    if (len < 0.0001) {
        return vec3(0.0);
    }
    return g / len;
  }

  void main() {
    vec3 ray_dir = normalize(v_local_pos - u_cam_pos);
    vec2 t_hits = intersect_box(u_cam_pos, ray_dir);
    
    if (t_hits.x > t_hits.y) discard;

    float t = max(0.0, t_hits.x);
    
    // Stochastic jitter to reduce banding
    t += rand(v_local_pos.xy) * 0.01;

    vec3 composite_color = vec3(0.0);
    float composite_alpha = 0.0;
    
    const int STEPS = 180; // Increased steps slightly for higher quality rendering
    float dt = (t_hits.y - t_hits.x) / float(STEPS);
    
    float l_low = u_wl - u_ww * 0.5;

    for (int i = 0; i < 180; i++) {
        vec3 curr_local = u_cam_pos + t * ray_dir;
        
        // Clipping logic (in local coordinates)
        if (u_clipping_enabled) {
            float dist = distance(curr_local, u_probe_pos);
            if (dist > 6.0) { // 60mm radius (approx 6 scene units depending on scale)
                t += dt;
                continue;
            }
        }

        vec3 uvw = (curr_local - u_min) / (u_max - u_min);
        
        vec4 texSample = texture(u_data, uvw);
        float val = texSample.r;
        float seg_val = texSample.g;
        int label = int(seg_val * 255.0 + 0.5);
        
        float intensity = clamp((val - l_low) / u_ww, 0.0, 1.0);
        
        if (label > 0 || val > 0.15) {
            float tf_alpha = 0.0;
            vec3 tf_color = vec3(0.0);
            float spec_intensity = 0.05;

            if (label > 0) {
                // Color-coded organs based on segmentation label ID
                if (label == 5) {
                    // Liver: Terracotta / warm brown
                    tf_color = vec3(0.86, 0.44, 0.28);
                    tf_alpha = 0.35;
                    spec_intensity = 0.12;
                } else if (label == 1) {
                    // Spleen: Purple
                    tf_color = vec3(0.58, 0.31, 0.58);
                    tf_alpha = 0.30;
                    spec_intensity = 0.08;
                } else if (label == 2 || label == 3) {
                    // Kidneys: Maroon
                    tf_color = vec3(0.65, 0.23, 0.18);
                    tf_alpha = 0.30;
                    spec_intensity = 0.10;
                } else if (label == 4) {
                    // Gallbladder: Forest green
                    tf_color = vec3(0.18, 0.52, 0.28);
                    tf_alpha = 0.38;
                    spec_intensity = 0.22;
                } else if (label == 6) {
                    // Stomach: Light pink/salmon
                    tf_color = vec3(0.85, 0.52, 0.48);
                    tf_alpha = 0.25;
                    spec_intensity = 0.05;
                } else if (label == 7) {
                    // Pancreas: Golden orange
                    tf_color = vec3(0.88, 0.62, 0.28);
                    tf_alpha = 0.28;
                    spec_intensity = 0.06;
                } else if (label == 8 || label == 9) {
                    // Adrenal Glands: Yellowish
                    tf_color = vec3(0.82, 0.72, 0.24);
                    tf_alpha = 0.25;
                    spec_intensity = 0.04;
                } else if (label == 15 || label == 16 || label == 17) {
                    // Bowel / Duodenum / Colon: Beige/tan
                    tf_color = vec3(0.78, 0.65, 0.48);
                    tf_alpha = 0.22;
                    spec_intensity = 0.05;
                } else if (label >= 18 && label <= 31) {
                    // Spine / Vertebrae: Ivory / White
                    tf_color = vec3(0.92, 0.90, 0.82);
                    tf_alpha = 0.50;
                    spec_intensity = 0.30;
                } else if (label == 32) {
                    // Heart: Red
                    tf_color = vec3(0.82, 0.15, 0.15);
                    tf_alpha = 0.35;
                    spec_intensity = 0.15;
                } else if (label == 33 || label == 37 || label == 38) {
                    // Aorta & Arteries: Bright red
                    tf_color = vec3(0.92, 0.18, 0.18);
                    tf_alpha = 0.32;
                    spec_intensity = 0.20;
                } else if (label == 35 || label == 36 || label == 39 || label == 40) {
                    // IVC & Veins: Blue
                    tf_color = vec3(0.18, 0.44, 0.86);
                    tf_alpha = 0.32;
                    spec_intensity = 0.20;
                } else if (label >= 51 && label <= 67) {
                    // Ribs / Sternum / Bones: Ivory / White
                    tf_color = vec3(0.92, 0.90, 0.82);
                    tf_alpha = 0.50;
                    spec_intensity = 0.30;
                } else {
                    // Other segmented structures
                    tf_color = vec3(0.68, 0.68, 0.68);
                    tf_alpha = 0.15;
                    spec_intensity = 0.05;
                }
            } else {
                // Non-segmented tissue (label == 0)
                // Render as bone if raw CT value is high (val > 0.31)
                if (val > 0.31) {
                    tf_color = vec3(0.92, 0.90, 0.82); // Bone
                    tf_alpha = 0.45;
                    spec_intensity = 0.25;
                } else {
                    // Hide soft tissue / fat to make internal organs visible
                    tf_alpha = 0.0;
                }
            }

            // Phong-style shading with gradient-based normals for depth perception
            vec3 normal = get_gradient(uvw);
            if (length(normal) > 0.1) {
                // Diffuse lighting: Headlight model (light direction = camera direction)
                float diffuse = max(dot(normal, -ray_dir), 0.0);
                
                // Specular highlight: Shiny tissues (organs, bone)
                vec3 half_dir = normalize(-ray_dir + -ray_dir);
                float spec_power = (intensity > 0.5) ? 32.0 : 16.0;
                float specular = pow(max(dot(normal, half_dir), 0.0), spec_power) * spec_intensity;
                
                // Phong lighting blend: ambient + diffuse + specular
                float phong = 0.35 + 0.55 * diffuse + specular;
                tf_color = clamp(tf_color * phong, 0.0, 1.0);
            } else {
                // Flat ambient-like fallback for homogeneous regions
                tf_color *= 0.65;
            }

            // Front-to-back alpha blending
            composite_color += (1.0 - composite_alpha) * tf_alpha * tf_color;
            composite_alpha += tf_alpha;
        }

        if (composite_alpha >= 0.95) break;
        t += dt;
        if (t > t_hits.y) break;
    }

    if (composite_alpha <= 0.02) discard;
    
    // Apply global volume opacity
    gl_FragColor = vec4(composite_color, composite_alpha * u_volume_opacity);
  }
`;

// ── Volume Renderer Component ────────────────────────────────────────────────
interface VolumeRaymarchProps {
    voxelData: VolumeVoxelData;
    bounds: { min: [number, number, number]; max: [number, number, number] };
    wl: number;
    ww: number;
    scale: number;
    clippingEnabled: boolean;
    probePos: { x: number; y: number; z: number };
    volumeOpacity: number;
}

const VolumeRaymarch: React.FC<VolumeRaymarchProps> = ({
    voxelData, bounds, wl, ww, scale, clippingEnabled, probePos, volumeOpacity
}) => {
    useThree();
    const textureRef = useRef<THREE.Data3DTexture | null>(null);

    // Initial texture creation — the backend always returns (AP, SI, LR) order
    const texture = React.useMemo(() => {
        const { dims } = voxelData.metadata;
        
        // dims[0] = AP (depth)
        // dims[1] = SI (height)
        // dims[2] = LR (width)
        // Data3DTexture expects (width, height, depth) = (LR, SI, AP)
        const w = dims[2];  // LR (width)
        const h = dims[1];  // Z (SI)
        const d = dims[0];  // Y (AP)
        
        const tex = new THREE.Data3DTexture(voxelData.data, w, h, d);
        tex.format = THREE.RGFormat;
        tex.type = THREE.UnsignedByteType;
        tex.minFilter = THREE.LinearFilter;
        tex.magFilter = THREE.LinearFilter;
        tex.needsUpdate = true;
        return tex;
    }, [voxelData]);

    // Update ref in effect, not render
    React.useEffect(() => {
        textureRef.current = texture;
    }, [texture]);

    // Map HU window to [0, 1] normalized texture range
    const normWL = (wl + 1024) / 4096;
    const normWW = ww / 4096;

    const uniforms = React.useMemo(() => ({
        u_data: { value: texture },
        u_cam_pos: { value: new THREE.Vector3() },
        u_min: { value: new THREE.Vector3() },
        u_max: { value: new THREE.Vector3() },
        u_wl: { value: 0 },
        u_ww: { value: 0 },
        u_volume_opacity: { value: 1.0 },
        u_clipping_enabled: { value: false },
        u_probe_pos: { value: new THREE.Vector3() },
    }), [texture]);

    const meshRef = useRef<THREE.Mesh>(null);

    // ── Axis alignment: box dimensions ───────────────────────────────────────
    // The 3D texture is created as Data3DTexture(data, W, H, D) where:
    //   W = LR (NIfTI X)  → texture u-axis
    //   H = AP (NIfTI Y)  → texture v-axis
    //   D = SI (NIfTI Z)  → texture w-axis
    //
    // The box geometry LOCAL axes (before the Rx(+90°) mesh rotation):
    //   local X = LR  (sx)
    //   local Y = SI  (sy)  ← this does NOT match texture v (AP)
    //   local Z = AP  (sz)  ← this does NOT match texture w (SI)
    //
    // The Rx(+90°) rotation on the mesh body swaps local Y↔Z in parent space
    // so the volume appears correctly oriented. The SHADER however still works
    // in the pre-rotation local space (v_local_pos = position).
    //
    // Therefore, to correctly map uvw to the texture:
    //   uvw.x = (local.x + sx/2) / sx  → LR ✓
    //   uvw.y = (local.z + sz/2) / sz  → AP (local Z encodes AP) ✓
    //   uvw.z = (local.y + sy/2) / sy  → SI (local Y encodes SI) ✓
    //
    // i.e.  u_min = (-sx/2, -sz/2, -sy/2)
    //        u_max = (+sx/2, +sz/2, +sy/2)
    //
    // PREVIOUS BUG: u_min/u_max were set from absolute NIfTI world coords
    //   (bounds.min * scale, e.g. [-170*0.035, -333*0.035, -291*0.035])
    // These are ABSOLUTE world offsets, nowhere near the box local-space
    // half-extents (±sx/2 etc.). The ray-box intersection and uvw lookup
    // both produced garbage as a result.
    const lrRange = bounds.max[0] - bounds.min[0];  // LR extent in mm (NIfTI X)
    const apRange = bounds.max[1] - bounds.min[1];  // AP extent in mm (NIfTI Y) → TLS Z
    const siRange = bounds.max[2] - bounds.min[2];  // SI extent in mm (NIfTI Z) → TLS Y

    // Box geometry sized to TLS axes: X=LR, Y=SI, Z=AP
    const sx = lrRange * scale;  // local X = LR
    const sy = siRange * scale;  // local Y = SI (Superior)
    const sz = apRange * scale;  // local Z = AP (Anterior)

    // Efficiently update uniforms that change outside memoization
    useFrame(({ camera }) => {
        if (!meshRef.current) return;

        // Convert world camera position to LOCAL mesh space (includes all parent transforms)
        const invMat = meshRef.current.matrixWorld.clone().invert();
        uniforms.u_cam_pos.value.copy(camera.position).applyMatrix4(invMat);

        // ── u_min / u_max: LOCAL SPACE half-extents with axis-swapped uvw mapping ──
        // These must be in the same space as v_local_pos (the mesh's local space).
        // The box spans [-sx/2, +sx/2] in local X, [-sy/2, +sy/2] in local Y,
        // [-sz/2, +sz/2] in local Z.
        //
        // For Volume 35 with reordered axes (X, Z, Y) and [-π/2, 0, 0] rotation:
        // The texture is organized as (u=X_LR, v=Z_SI, w=Y_AP)
        // Mapping to local box axes:
        //   uniform x component → uvw.x (LR) → use local X half-extent sx/2
        //   uniform y component → uvw.y (SI) → use local Y half-extent sy/2
        //   uniform z component → uvw.z (AP) → use local Z half-extent sz/2
        uniforms.u_min.value.set(-sx / 2, -sy / 2, -sz / 2);
        uniforms.u_max.value.set( sx / 2,  sy / 2,  sz / 2);

        uniforms.u_wl.value = normWL;
        uniforms.u_ww.value = normWW;
        uniforms.u_volume_opacity.value = volumeOpacity;
        uniforms.u_clipping_enabled.value = clippingEnabled;

        // probePos in mm → convert to local space.
        // Local space ≈ scene units / registrationScale; approximate as mm * scale here.
        uniforms.u_probe_pos.value.set(probePos.x * scale, probePos.y * scale, probePos.z * scale);
    });

    return (
        <mesh ref={meshRef} position={[0, 0, 0]}>
            <boxGeometry args={[sx, sy, sz]} />
            <shaderMaterial
                vertexShader={VOLUME_VERTEX_SHADER}
                fragmentShader={VOLUME_FRAGMENT_SHADER}
                uniforms={uniforms}
                transparent
                depthWrite={false}
                side={THREE.BackSide}
            />
        </mesh>
    );
};

// ── Probe Mesh ────────────────────────────────────────────────────────────────
interface ProbeMeshProps {
    scale: number;
}

const ProbeMesh3D: React.FC<ProbeMeshProps> = ({ scale }) => {
    const groupRef = useRef<THREE.Group>(null);
    const { probePos, probeRot, probeNormal, probePhysics, registration, anatomyMetadata, volumeInfo } = useAppStore();

    useFrame(() => {
        if (!groupRef.current) return;
        const posScene = (anatomyMetadata && volumeInfo?.bounds)
            ? niftiToSubject(probePos, registration, scale, volumeInfo.bounds, anatomyMetadata)
            : new THREE.Vector3(probePos.x * scale, probePos.y * scale, probePos.z * scale);
        const mat = buildProbeMatrix(
            posScene,
            probeRot,
            probeNormal
        );
        groupRef.current.matrix.copy(mat);
        groupRef.current.matrixAutoUpdate = false;
        groupRef.current.matrixWorldNeedsUpdate = true;
    });

    const handleLen = 140 * scale;
    const handleRad = 18 * scale;
    const headWidth = 55 * scale;
    const headHeight = 25 * scale;
    const headDepth = 20 * scale;

    // Skin depression: probe "sinks" into soft tissue based on pressure
    const depression = probePhysics.surfaceContact.pressureLevel * 8 * scale;

    return (
        <group ref={groupRef} name="probe-group">
            <group position={[0, -depression, 0]}>
                {/* 1. Ergonomic Handle (Tapered) */}
                <mesh position={[0, handleLen / 2 + headHeight, 0]}>
                    <cylinderGeometry args={[handleRad * 0.85, handleRad, handleLen, 32]} />
                    <meshPhysicalMaterial 
                        color="#ffffff" 
                        roughness={0.05} 
                        metalness={0.1}
                        clearcoat={1.0}
                        clearcoatRoughness={0.1}
                        reflectivity={0.5}
                    />
                </mesh>

                {/* 2. Neck Transition (Smooth curve) */}
                <mesh position={[0, headHeight, 0]}>
                    <cylinderGeometry args={[handleRad, headWidth / 1.8, 0.6 * scale, 32]} />
                    <meshStandardMaterial color="#94a3b8" roughness={0.4} />
                </mesh>

                {/* 3. Curvilinear Head (Rounded sides) */}
                <group position={[0, headHeight / 2, 0]}>
                    {/* Main Head Body */}
                    <mesh>
                        <boxGeometry args={[headWidth * 0.8, headHeight, headDepth]} />
                        <meshPhysicalMaterial color="#334155" roughness={0.3} metalness={0.3} />
                    </mesh>
                    
                    {/* Rounded Sides (Left/Right) */}
                    <mesh position={[headWidth * 0.4, 0, 0]}>
                        <cylinderGeometry args={[headDepth / 2, headDepth / 2, headHeight, 32]} />
                        <meshPhysicalMaterial color="#334155" roughness={0.3} metalness={0.3} />
                    </mesh>
                    <mesh position={[-headWidth * 0.4, 0, 0]}>
                        <cylinderGeometry args={[headDepth / 2, headDepth / 2, headHeight, 32]} />
                        <meshPhysicalMaterial color="#334155" roughness={0.3} metalness={0.3} />
                    </mesh>
                </group>

                {/* 4. Scanning Footprint (Curved Bottom) */}
                <mesh position={[0, 0.1 * scale, 0]} rotation={[Math.PI / 2, 0, 0]}>
                    <cylinderGeometry args={[headWidth / 1.8, headWidth / 1.8, headDepth, 32, 1, false, 0, Math.PI]} />
                    <meshPhysicalMaterial 
                        color={probePhysics.surfaceContact.isInContact ? "#4f46e5" : "#334155"} 
                        emissive={probePhysics.surfaceContact.isInContact ? "#4f46e5" : "#000000"}
                        emissiveIntensity={1.5}
                        roughness={0.1}
                        metalness={0.8}
                        transmission={0.4}
                        thickness={2}
                    />
                </mesh>

                {/* 5. Orientation Notch (Clinical indicator) */}
                <mesh position={[headWidth / 2.2, headHeight * 0.7, 0]}>
                    <boxGeometry args={[0.25 * scale, 0.5 * scale, 0.25 * scale]} />
                    <meshBasicMaterial color="#ef4444" />
                </mesh>

                {/* 6. Realistic Cable (Curved Tube) */}
                <group position={[0, headHeight + headHeight * 0.8, 0]}>
                    <mesh>
                        <tubeGeometry args={[
                            new THREE.QuadraticBezierCurve3(
                                new THREE.Vector3(0, 0, 0),
                                new THREE.Vector3(0, 40 * scale, -20 * scale),
                                new THREE.Vector3(100 * scale, 80 * scale, -60 * scale)
                            ),
                            32, 2 * scale, 8, false
                        ]} />
                        <meshStandardMaterial color="#334155" roughness={0.5} />
                    </mesh>
                </group>
            </group>
        </group>
    );
};

// ── Slice Plane ───────────────────────────────────────────────────────────────
interface SlicePlaneProps {
    planeSizeMm: number;
    scale: number;
    currentFrame: string | null;
}

const SlicePlane3D: React.FC<SlicePlaneProps> = ({ planeSizeMm, scale, currentFrame }) => {
    const meshRef = useRef<THREE.Mesh>(null);
    const { probePos, probeRot, probeNormal, registration, anatomyMetadata, volumeInfo } = useAppStore();

    // Projected Texture Logic
    const texture = React.useMemo(() => {
        if (!currentFrame) return null;
        const tex = new THREE.Texture();
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            tex.image = img;
            tex.needsUpdate = true;
        };
        img.src = currentFrame;
        tex.minFilter = THREE.LinearFilter;
        tex.magFilter = THREE.LinearFilter;
        return tex;
    }, [currentFrame]);

    useFrame(() => {
        if (!meshRef.current) return;
        const posScene = (anatomyMetadata && volumeInfo?.bounds)
            ? niftiToSubject(probePos, registration, scale, volumeInfo.bounds, anatomyMetadata)
            : new THREE.Vector3(probePos.x * scale, probePos.y * scale, probePos.z * scale);
        const mat = buildProbeMatrix(
            posScene,
            probeRot,
            probeNormal
        );
        meshRef.current.matrix.copy(mat);
        meshRef.current.matrixAutoUpdate = false;
        meshRef.current.matrixWorldNeedsUpdate = true;
    });

    const planeSizeScene = planeSizeMm * scale;

    return (
        <group>
            {/* Main slice plane with ultrasound texture */}
            <mesh ref={meshRef}>
                <planeGeometry args={[planeSizeScene, planeSizeScene]} />
                <meshBasicMaterial
                    map={texture}
                    transparent
                    opacity={texture ? 0.85 : 0.15}
                    color={texture ? '#ffffff' : '#6366f1'}
                    side={THREE.DoubleSide}
                    depthWrite={false}
                />
            </mesh>
            <SlicePlaneOutline planeSizeMm={planeSizeMm} scale={scale} />
        </group>
    );
};

// Animated slice plane outline (follows probe transform via useFrame)
const SlicePlaneOutline: React.FC<{ planeSizeMm: number; scale: number }> = ({ planeSizeMm, scale }) => {
    const lineRef = useRef<THREE.LineSegments>(null);
    const { probePos, probeRot, probeNormal, registration, anatomyMetadata, volumeInfo } = useAppStore();
    const half = (planeSizeMm * scale) / 2;

    useFrame(() => {
        if (!lineRef.current) return;
        const posScene = (anatomyMetadata && volumeInfo?.bounds)
            ? niftiToSubject(probePos, registration, scale, volumeInfo.bounds, anatomyMetadata)
            : new THREE.Vector3(probePos.x * scale, probePos.y * scale, probePos.z * scale);
        const mat = buildProbeMatrix(
            posScene,
            probeRot,
            probeNormal
        );
        lineRef.current.matrix.copy(mat);
        lineRef.current.matrixAutoUpdate = false;
        lineRef.current.matrixWorldNeedsUpdate = true;
    });

    const positions = new Float32Array([
        -half, -half, 0, half, -half, 0,
        half, -half, 0, half, half, 0,
        half, half, 0, -half, half, 0,
        -half, half, 0, -half, -half, 0,
        // Cross-hair lines
        -half, 0, 0, half, 0, 0,
        0, -half, 0, 0, half, 0,
    ]);

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    return (
        <lineSegments ref={lineRef} geometry={geo}>
            <lineBasicMaterial color="#818cf8" transparent opacity={0.4} />
        </lineSegments>
    );
};

// ── Breathing Effect Component ───────────────────────────────────────────────
const BreathingGroup: React.FC<{ children: React.ReactNode; amplitude?: number }> = ({ children, amplitude = 0.15 }) => {
    const groupRef = useRef<THREE.Group>(null);
    useFrame((state) => {
        if (!groupRef.current) return;
        const breath = Math.sin(state.clock.elapsedTime * 0.8) * amplitude;
        groupRef.current.position.y = breath;
    });
    return <group ref={groupRef}>{children}</group>;
};

// ── Volumetric Beam Visualization ─────────────────────────────────────────────


// ── 3D Guidance Indicators (Minimalist Arcs) ──────────────────────────────────


// ── Contact Pressure Ring ─────────────────────────────────────────────────────
const ContactRing: React.FC<{ scale: number }> = ({ scale }) => {
    const { probePos, probeNormal, probePhysics } = useAppStore();
    if (!probePhysics.surfaceContact.isInContact) return null;

    // Align ring with surface normal
    const mat = buildProbeMatrix(
        { x: probePos.x * scale, y: probePos.y * scale, z: probePos.z * scale },
        { pitch: 0, yaw: 0, roll: 0 },
        probeNormal
    );

    // Ring scales slightly with pressure to simulate skin indentation spread
    const ringScale = 1 + probePhysics.surfaceContact.pressureLevel * 0.3;

    return (
        <mesh matrix={mat} matrixAutoUpdate={false} scale={[ringScale, ringScale, 1]}>
            <ringGeometry args={[10 * scale, 12 * scale, 32]} />
            <meshBasicMaterial color="#0ea5e9" transparent opacity={0.6} side={THREE.DoubleSide} />
        </mesh>
    );
};

// ── Front-Surface-Constrained Probe Controller ────────────────────────────────
// INTERACTION ROUTING (strictly separated):
//   LEFT click on torso anterior surface → Probe Manipulation Mode
//     - Camera locked, probe drags on surface
//     - Scroll wheel = contact pressure (not zoom)
//   RIGHT click (anywhere) → Camera Orbit Mode (always, no restriction)
//     - Rotate/pan the entire scene view
//   Alt + LEFT drag → Camera orbit/pan even over torso (escape hatch)
//
// Implementation: DragController captures LEFT clicks for probe; OrbitControls
// is configured for RIGHT button. When probe drag starts, orbit is disabled.
// When probe drag ends, orbit re-enables. Alt key bypasses probe capture.
interface DragControllerProps {
    volumeBounds: { min: [number, number, number]; max: [number, number, number] };
    scale: number;
    selectedCaseId: string;
    orbitControlsRef: React.RefObject<any>;
}

// ── Probe Stability Tracker singleton (outside component, persists across renders) ──
const _stabilityTracker = new ProbeStabilityTracker(90); // 1.5s window at 60fps

// ── Module-level smoothing targets (avoid per-render allocations) ─────────────
const _probeTarget  = new THREE.Vector3();
const _normalTarget = new THREE.Vector3(0, 1, 0);

/** Drag interaction mode */
type DragMode = 'slide' | 'rotate' | 'yaw';

// ── DragController ────────────────────────────────────────────────────────────
// INTERACTION ROUTING (strictly separated):
//   LEFT click on torso anterior surface → Probe SLIDE mode
//     - Camera locked, probe glides smoothly across skin surface
//     - Surface normal is computed and used as probe base orientation
//   Shift + LEFT drag / RIGHT click drag → Probe ROTATE mode (Pitch + Roll)
//     - Adjusts the user's pitch/roll offsets on top of normal-aligned base
//   Ctrl + LEFT drag / Scroll → YAW mode (probe spin)
//     - Rotates probe about its own longitudinal axis
//   Alt + LEFT drag → Camera orbit/pan escape hatch (bypasses probe)
interface DragControllerProps {
    volumeBounds: { min: [number, number, number]; max: [number, number, number]; center: [number, number, number] };
    scale: number;
    selectedCaseId: string;
    orbitControlsRef: React.RefObject<any>;
    interactionMode: 'probe' | 'orbit' | 'pan';
}

const DragController: React.FC<DragControllerProps> = ({ scale, volumeBounds, selectedCaseId, orbitControlsRef, interactionMode }) => {
    const {
        probeRot,
        imagingSettings,
        setProbePos,
        setProbeRot,
        updatePose,
        probePhysics,
        updateProbeMetrics,
        registration,
        anatomyMetadata,
    } = useAppStore();
    const { gl, scene, raycaster, camera } = useThree();
    const isVolume35 = isVolume35Case(selectedCaseId);

    // ── Interaction state (refs = no re-renders) ───────────────────────────────
    const dragMode          = useRef<DragMode | null>(null);
    const lastPointer       = useRef({ x: 0, y: 0 });
    const pointerSpeed      = useRef(0);

    // Smoothed display values (lerped toward target each frame)
    const smoothPos   = useRef(new THREE.Vector3());
    const smoothNorm  = useRef(new THREE.Vector3(0, 1, 0));

    // User rotation offsets applied ON TOP of the normal-aligned base orientation
    const userPitch  = useRef(probeRot.pitch);
    const userYaw    = useRef(probeRot.yaw);
    const userRoll   = useRef(probeRot.roll);

    const groupRef   = useRef<THREE.Group>(null);
    const { probePos, probeNormal } = useAppStore();

    // ── Helpers ────────────────────────────────────────────────────────────────
    const getNdcFromEvent = useCallback((e: PointerEvent | WheelEvent) => {
        const rect = gl.domElement.getBoundingClientRect();
        return new THREE.Vector2(
            ((e.clientX - rect.left) / rect.width)  * 2 - 1,
            -((e.clientY - rect.top)  / rect.height) * 2 + 1,
        );
    }, [gl]);

    const raycastTorso = useCallback((ndc: THREE.Vector2) => {
        // Use the low-poly collider for smooth, reliable raycasting.
        // Falls back to torso-model if collider not found.
        const collider = scene.getObjectByName('torso-collider');
        const target   = collider || scene.getObjectByName('torso-model');
        if (!target) return null;
        return raycastProbeHit(ndc, camera, raycaster, target, DEFAULT_PROBE_CONSTRAINTS);
    }, [scene, camera, raycaster]);

    // ── Pointer DOWN ───────────────────────────────────────────────────────────
    const handlePointerDown = useCallback((e: PointerEvent) => {
        if (interactionMode !== 'probe') return; // Do not intercept if not in probe mode
        if (e.altKey) return; // Alt = camera orbit escape hatch

        const ndc = getNdcFromEvent(e);
        lastPointer.current = { x: e.clientX, y: e.clientY };

        if (e.button === 2 || e.shiftKey) {
            // RIGHT click or SHIFT+LEFT → rotate mode (pitch + roll)
            dragMode.current = 'rotate';
            e.preventDefault();
            if (orbitControlsRef.current) orbitControlsRef.current.enabled = false;
            return;
        }

        if (e.button === 0 && e.ctrlKey) {
            // CTRL+LEFT → yaw mode
            dragMode.current = 'yaw';
            e.preventDefault();
            if (orbitControlsRef.current) orbitControlsRef.current.enabled = false;
            return;
        }

        if (e.button === 0) {
            // Plain LEFT → slide mode (must hit torso anterior surface)
            const hit = raycastTorso(ndc);
            if (!hit?.isValidHit) return;

            dragMode.current = 'slide';

            const subject = scene.getObjectByName('anatomical-subject');
            if (subject) {
                // Convert hit point and normal from world space to anatomical-subject local space
                const localPoint = subject.worldToLocal(hit.point.clone());
                const localNormal = hit.normal.clone().transformDirection(subject.matrixWorld.clone().invert());

                // Convert localPoint (scene units) to NIfTI millimeters
                const hitMm = (anatomyMetadata && volumeBounds)
                    ? subjectToNifti(localPoint, registration, scale, volumeBounds, anatomyMetadata)
                    : new THREE.Vector3(
                        (localPoint.x / scale - registration.position[0]) / registration.scale,
                        (localPoint.y / scale - registration.position[1]) / registration.scale,
                        (localPoint.z / scale - registration.position[2]) / registration.scale
                    );

                _probeTarget.set(hitMm.x, hitMm.y, hitMm.z);
                _normalTarget.copy(localNormal);
            } else {
                _probeTarget.copy(hit.point);
                _normalTarget.copy(hit.normal);
            }

            if (orbitControlsRef.current) orbitControlsRef.current.enabled = false;
            e.stopPropagation();
        }
    }, [getNdcFromEvent, raycastTorso, orbitControlsRef, interactionMode, scale, registration, scene]);

    // ── Pointer MOVE ───────────────────────────────────────────────────────────
    const handlePointerMove = useCallback((e: PointerEvent) => {
        if (interactionMode !== 'probe') return;
        if (!dragMode.current) return;

        const dx = e.clientX - lastPointer.current.x;
        const dy = e.clientY - lastPointer.current.y;
        lastPointer.current = { x: e.clientX, y: e.clientY };

        // Dead-zone: ignore micro-jitter from high-DPI mice (reduced to 0.15px for fine probe adjustments)
        if (!exceedsDeadZone(dx, dy, 0.15)) return;

        // Track pointer speed for adaptive LERP
        pointerSpeed.current = Math.sqrt(dx * dx + dy * dy);

        if (dragMode.current === 'slide') {
            const ndc = getNdcFromEvent(e);
            const hit = raycastTorso(ndc);
            // Continue sliding even if hit is invalid (stay at last valid position)
            if (hit?.isValidHit) {
                const subject = scene.getObjectByName('anatomical-subject');
                if (subject) {
                    // Convert hit point and normal from world space to anatomical-subject local space
                    const localPoint = subject.worldToLocal(hit.point.clone());
                    const localNormal = hit.normal.clone().transformDirection(subject.matrixWorld.clone().invert());

                    // Convert localPoint (scene units) to NIfTI millimeters
                    const hitMm = (anatomyMetadata && volumeBounds)
                        ? subjectToNifti(localPoint, registration, scale, volumeBounds, anatomyMetadata)
                        : new THREE.Vector3(
                            (localPoint.x / scale - registration.position[0]) / registration.scale,
                            (localPoint.y / scale - registration.position[1]) / registration.scale,
                            (localPoint.z / scale - registration.position[2]) / registration.scale
                        );

                    const clamped = clampProbeToVolume(hitMm, volumeBounds);
                    _probeTarget.set(clamped.x, clamped.y, clamped.z);
                    _normalTarget.copy(localNormal);
                }
            }
        }

        if (dragMode.current === 'rotate') {
            // Shift+drag: Δpitch from vertical movement, Δroll from horizontal
            const sensitivity = 0.5; // increased from 0.35 for snappier rotation response
            userPitch.current = Math.max(-60, Math.min(60, userPitch.current + dy * sensitivity));
            userRoll.current  = Math.max(-60, Math.min(60, userRoll.current  + dx * sensitivity));
        }

        if (dragMode.current === 'yaw') {
            // Ctrl+drag: yaw from horizontal movement
            const sensitivity = 0.55; // increased from 0.4 for snappier yaw response
            userYaw.current = (userYaw.current + dx * sensitivity) % 360;
        }
    }, [getNdcFromEvent, raycastTorso, volumeBounds, interactionMode, scale, registration, scene]);

    // ── Scroll → YAW ──────────────────────────────────────────────────────────
    const handleWheel = useCallback((e: WheelEvent) => {
        if (interactionMode !== 'probe') return;
        if (dragMode.current === 'slide' || dragMode.current === 'yaw') {
            e.preventDefault();
            const yawDelta = e.deltaY * 0.08; // degrees per scroll unit
            userYaw.current = (userYaw.current + yawDelta) % 360;
        }
    }, [interactionMode]);

    // ── Pointer UP ─────────────────────────────────────────────────────────────
    const handlePointerUp = useCallback(() => {
        dragMode.current = null;
        pointerSpeed.current = 0;
        if (orbitControlsRef.current) orbitControlsRef.current.enabled = true;
    }, [orbitControlsRef]);

    // ── Context menu (prevent on canvas for right-drag rotate) ────────────────
    const handleContextMenu = useCallback((e: MouseEvent) => { e.preventDefault(); }, []);

    // ── Event listener registration ────────────────────────────────────────────
    React.useEffect(() => {
        const canvas = gl.domElement;
        canvas.addEventListener('pointerdown',   handlePointerDown, { passive: false });
        canvas.addEventListener('contextmenu',   handleContextMenu);
        canvas.addEventListener('wheel',         handleWheel,        { passive: false });
        window.addEventListener('pointermove',   handlePointerMove);
        window.addEventListener('pointerup',     handlePointerUp);
        return () => {
            canvas.removeEventListener('pointerdown',  handlePointerDown);
            canvas.removeEventListener('contextmenu',  handleContextMenu);
            canvas.removeEventListener('wheel',        handleWheel);
            window.removeEventListener('pointermove',  handlePointerMove);
            window.removeEventListener('pointerup',    handlePointerUp);
        };
    }, [gl, handlePointerDown, handlePointerMove, handlePointerUp, handleWheel, handleContextMenu]);

    // ── Per-frame update (runs at 60fps inside R3F canvas) ────────────────────
    useFrame(() => {
        if (!groupRef.current) return;

        const isSliding  = dragMode.current === 'slide';
        const isRotating = dragMode.current === 'rotate' || dragMode.current === 'yaw';
        const isActive   = isSliding || isRotating;

        // Adaptive LERP factor — high for immediate response, lower bound for fast sweeps
        const alpha = adaptiveSmoothFactor(pointerSpeed.current, 0.7, 0.45);
        // Decay speed toward 0 each frame (keep momentum)
        pointerSpeed.current *= 0.88;

        // ── Smooth position toward target (only when sliding) ──────────────────
        if (isSliding) {
            smoothPos.current.lerp(_probeTarget, alpha);
            smoothNorm.current.lerp(_normalTarget, alpha * 1.4).normalize();
        } else {
            // Snap smooth state to store when not dragging (keeps sync on session load)
            smoothPos.current.set(probePos.x, probePos.y, probePos.z);
            smoothNorm.current.set(probeNormal.x, probeNormal.y, probeNormal.z);
        }

        // ── Stability tracking ─────────────────────────────────────────────────
        _stabilityTracker.push(smoothPos.current);
        const { score: stability } = _stabilityTracker.compute();

        // ── Build surface-normal-aligned base orientation ──────────────────────
        const baseNormal = isActive ? smoothNorm.current : new THREE.Vector3(probeNormal.x, probeNormal.y, probeNormal.z);
        const baseQuat   = buildNormalAlignedRotation(baseNormal);

        // Apply user rotation offsets (pitch/yaw/roll) on top of base alignment
        const userQuat = new THREE.Quaternion().setFromEuler(
            new THREE.Euler(
                (userPitch.current * Math.PI) / 180,
                (userYaw.current   * Math.PI) / 180,
                (userRoll.current  * Math.PI) / 180,
                'YXZ',  // Yaw-Pitch-Roll Euler order (intuitive for probe rotation)
            )
        );
        const finalQuat = baseQuat.multiply(userQuat);

        // ── Build final 4×4 matrix ─────────────────────────────────────────────
        // smoothPos.current is in millimeters (NIfTI coordinates).
        // Convert to anatomical-subject space (scene units) for rendering:
        const posScene = (anatomyMetadata && volumeBounds)
            ? niftiToSubject(smoothPos.current, registration, scale, volumeBounds, anatomyMetadata)
            : new THREE.Vector3(
                (smoothPos.current.x * registration.scale + registration.position[0]) * scale,
                (smoothPos.current.y * registration.scale + registration.position[1]) * scale,
                (smoothPos.current.z * registration.scale + registration.position[2]) * scale
            );
        const mat = new THREE.Matrix4()
            .makeRotationFromQuaternion(finalQuat)
            .setPosition(posScene);

        groupRef.current.matrix.copy(mat);
        groupRef.current.matrixAutoUpdate = false;
        groupRef.current.matrixWorldNeedsUpdate = true;

        // ── Contact quality from probe tilt vs surface normal ──────────────────
        const { score: quality, label: qLabel } = computeContactQualityFromAngles(
            userPitch.current,
            userRoll.current,
            baseNormal,
        );

        // ── Broadcast to store (every frame — no throttle, minimal overhead) ───
        if (isActive) {
            setProbePos(
                { x: smoothPos.current.x, y: smoothPos.current.y, z: smoothPos.current.z },
                { x: baseNormal.x, y: baseNormal.y, z: baseNormal.z },
            );
            setProbeRot({ pitch: userPitch.current, yaw: userYaw.current, roll: userRoll.current });
            updatePose({
                position: { x: smoothPos.current.x, y: smoothPos.current.y, z: smoothPos.current.z },
                rotation: { pitch: userPitch.current, yaw: userYaw.current, roll: userRoll.current },
            });
        }

        // Metrics update (always, so HUD values are live even when still)
        updateProbeMetrics(quality, qLabel, stability);
    });

    return (
        <group ref={groupRef}>
            {isVolume35 ? (
                <RealisticProbe
                    scale={scale}
                    probeType={imagingSettings.probeType || 'curvilinear'}
                    isInContact={probePhysics.surfaceContact.isInContact}
                    pressureLevel={probePhysics.surfaceContact.pressureLevel}
                />
            ) : (
                <ProbeMesh3D scale={scale} />
            )}
        </group>
    );
};


// ── Main VolumeViewer component ───────────────────────────────────────────────
export const VolumeViewer: React.FC = () => {
    const controlsRef = useRef<any>(null);
    const {
        volumeInfo,
        volumeVoxelData,
        renderSettings,
        probePos,
        probeRot,
        currentFrame,
        registration,
        setCTBounds,
        visualizationSettings,
        mmToSceneScale,
        torsoBounds,
        selectedCaseId,
        anatomyMetadata,
        fetchAnatomyMetadata,
        embedCTAnatomically,
        probePhysics,
        contactQuality,
        imagingSettings,
    } = useAppStore();

    const isVolume35 = isVolume35Case(selectedCaseId);
    const bounds = React.useMemo(() => volumeInfo?.bounds ? {
        ...volumeInfo.bounds,
        size: [
            volumeInfo.bounds.max[0] - volumeInfo.bounds.min[0],
            volumeInfo.bounds.max[1] - volumeInfo.bounds.min[1],
            volumeInfo.bounds.max[2] - volumeInfo.bounds.min[2]
        ] as [number, number, number]
    } : {
        min: [-150, -150, -150] as [number, number, number],
        max: [150, 150, 150] as [number, number, number],
        center: [0, 0, 0] as [number, number, number],
        size: [300, 300, 300] as [number, number, number]
    }, [volumeInfo?.bounds]);

    const scale = mmToSceneScale;
    const planeSizeMm = renderSettings.planeSizeMm || 150;

    // ── Anatomical Embedding Pipeline ─────────────────────────────────────────
    // Triggered once when BOTH torsoBounds AND anatomyMetadata are available.
    // This replaces the old broken fitCTToTorso + centerCTInTorso calls.
    React.useEffect(() => {
        if (isVolume35 && torsoBounds && anatomyMetadata) {
            embedCTAnatomically();
        }
    }, [isVolume35, torsoBounds, anatomyMetadata, embedCTAnatomically]);

    // ── Seed probe to CT volume center on session load ────────────────────────
    // The CT world center (e.g. [5, -158, -165] mm for test35) is the natural
    // starting point — it guarantees the first WS slice hits real anatomy.
    // Without this, probePos = (0,0,0) mm which is often outside the CT bounds.
    const { setProbePos, updatePose } = useAppStore();
    React.useEffect(() => {
        if (!isVolume35 || !volumeInfo?.bounds?.center) return;
        const [cx, cy, cz] = volumeInfo.bounds.center;
        const seedPos = { x: cx, y: cy, z: cz };
        setProbePos(seedPos);
        updatePose({ position: seedPos, rotation: { pitch: 0, yaw: 0, roll: 0 } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isVolume35, volumeInfo?.bounds?.center?.toString()]);

    // ── Fetch anatomy metadata when Volume 35 session loads ───────────────────
    React.useEffect(() => {
        if (isVolume35 && selectedCaseId && !anatomyMetadata) {
            fetchAnatomyMetadata(selectedCaseId);
        }
    }, [isVolume35, selectedCaseId, anatomyMetadata, fetchAnatomyMetadata]);

    React.useEffect(() => {
        wsService.sendProbeUpdate(
            probePos.x, probePos.y, probePos.z,
            probeRot.pitch, probeRot.yaw, probeRot.roll,
            probePhysics.surfaceContact.pressureLevel,
            contactQuality,
            imagingSettings.probeType || 'curvilinear'
        );
    }, [
        probePos,
        probeRot,
        probePhysics.surfaceContact.pressureLevel,
        contactQuality,
        imagingSettings.probeType
    ]);

    React.useEffect(() => {
        const handleReset = () => {
            if (controlsRef.current) {
                controlsRef.current.reset();
                controlsRef.current.target.set(0, 4, 0);
                controlsRef.current.update();
            }
        };
        window.addEventListener('reset-simulator-view', handleReset);
        return () => window.removeEventListener('reset-simulator-view', handleReset);
    }, []);

    React.useEffect(() => {
        setCTBounds({
            min: bounds.min,
            max: bounds.max,
            center: bounds.center,
            size: [bounds.max[0] - bounds.min[0], bounds.max[1] - bounds.min[1], bounds.max[2] - bounds.min[2]]
        });
    }, [bounds, setCTBounds]);

    // ── Interaction and Camera Controls ───────────────────────────────────────
    const [interactionMode, setInteractionMode] = React.useState<'probe' | 'orbit' | 'pan'>('probe');

    const [mouseConfig, setMouseConfig] = React.useState<any>({
        LEFT: THREE.MOUSE.ROTATE, // Default left rotates when not dragging probe
        MIDDLE: THREE.MOUSE.PAN,
        RIGHT: THREE.MOUSE.ROTATE,
    });

    React.useEffect(() => {
        if (interactionMode === 'probe') {
            setMouseConfig({
                LEFT: THREE.MOUSE.ROTATE,
                MIDDLE: THREE.MOUSE.PAN,
                RIGHT: THREE.MOUSE.ROTATE,
            });
        } else if (interactionMode === 'orbit') {
            setMouseConfig({
                LEFT: THREE.MOUSE.ROTATE,
                MIDDLE: THREE.MOUSE.PAN,
                RIGHT: THREE.MOUSE.ROTATE,
            });
        } else if (interactionMode === 'pan') {
            setMouseConfig({
                LEFT: THREE.MOUSE.PAN,
                MIDDLE: THREE.MOUSE.PAN,
                RIGHT: THREE.MOUSE.ROTATE,
            });
        }
    }, [interactionMode]);

    React.useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.altKey) {
                setMouseConfig({ LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.PAN, RIGHT: THREE.MOUSE.ROTATE });
            } else if (e.shiftKey) {
                setMouseConfig({ LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.PAN, RIGHT: THREE.MOUSE.ROTATE });
            }
        };
        const handleKeyUp = (e: KeyboardEvent) => {
            if (!e.altKey && !e.shiftKey) {
                if (interactionMode === 'probe') {
                    setMouseConfig({ LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.PAN, RIGHT: THREE.MOUSE.ROTATE });
                } else if (interactionMode === 'orbit') {
                    setMouseConfig({ LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.PAN, RIGHT: THREE.MOUSE.ROTATE });
                } else if (interactionMode === 'pan') {
                    setMouseConfig({ LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.PAN, RIGHT: THREE.MOUSE.ROTATE });
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, [interactionMode]);

    const setCameraPreset = (preset: 'front' | 'side' | 'top' | 'iso') => {
        const controls = controlsRef.current;
        if (!controls) return;
        const cameraObj = controls.object;
        if (!cameraObj) return;

        controls.reset();
        controls.target.set(0, 4, 0);

        const dist = isVolume35 ? 25 : 20;
        const height = isVolume35 ? 8 : 10;
        const zDist = isVolume35 ? 22 : 18;

        if (preset === 'iso') {
            cameraObj.position.set(0, height, zDist);
        } else if (preset === 'front') {
            cameraObj.position.set(0, 4, dist);
        } else if (preset === 'side') {
            cameraObj.position.set(dist, 4, 0);
        } else if (preset === 'top') {
            cameraObj.position.set(0, dist, 0.01);
        }

        controls.update();
    };

    const handleZoom = (direction: 'in' | 'out') => {
        const controls = controlsRef.current;
        if (!controls) return;
        if (direction === 'in') {
            controls.dollyIn(1.1);
        } else {
            controls.dollyOut(1.1);
        }
        controls.update();
    };

    const handleResetView = () => {
        if (controlsRef.current) {
            controlsRef.current.reset();
            controlsRef.current.target.set(0, 4, 0);
            controlsRef.current.update();
        }
    };

    // Construct adaptive hint text based on current interactionMode
    const getHintText = () => {
        if (interactionMode === 'probe') {
            return "🖱️ Left-drag: Move Probe · Shift+drag: Tilt · Ctrl+drag: Rotate · Scroll: Yaw · Alt+drag: Orbit";
        } else if (interactionMode === 'orbit') {
            return "🖱️ Drag anywhere: Orbit/Rotate Torso · Scroll: Zoom · Right-drag: Orbit · Middle-drag: Pan";
        } else {
            return "🖱️ Drag anywhere: Pan/Move Torso · Scroll: Zoom · Right-drag: Orbit · Middle-drag: Pan";
        }
    };

    return (
        <div className={styles.container}>
            {/* Interaction hint */}
            <div className={styles.hintBadge}>
                <span>{getHintText()}</span>
                <button className={styles.resetBtn} onClick={handleResetView}>Reset</button>
            </div>

            <div className={styles.vtkContainer}>
                <Canvas shadows gl={{ antialias: true, alpha: true }}>
                    <PerspectiveCamera
                        makeDefault
                        position={isVolume35 ? [0, 8, 22] : [0, 10, 18]}
                        fov={isVolume35 ? 28 : 30}
                    />
                    {/*
                      * ORBIT CONTROLS ROUTING:
                      *   RIGHT click  → Rotate (always, never blocked by probe)
                      *   MIDDLE click → Pan (always)
                      *   SCROLL       → Zoom (always)
                      *   Alt + LEFT   → Rotate
                      *   Shift + LEFT → Pan
                      *
                      * The DragController captures normal left-clicks on the torso surface
                      * to control the probe. OrbitControls natively ignores left-clicks
                      * unless Alt or Shift are pressed.
                      */}
                    <OrbitControls
                        ref={controlsRef}
                        mouseButtons={mouseConfig}
                        target={[0, 4, 0]}
                        enablePan={true}
                        minDistance={12}
                        maxDistance={55}
                        maxPolarAngle={Math.PI * 0.85}
                        minPolarAngle={Math.PI * 0.05}
                        dampingFactor={0.08}
                        enableDamping
                    />

                    <ambientLight intensity={isVolume35 ? 0.5 : 0.4} />
                    <directionalLight position={[5, 10, 5]} intensity={isVolume35 ? 1.8 : 2.0} castShadow />
                    {isVolume35 && <directionalLight position={[-4, 6, 2]} intensity={0.6} />}
                    
                    <ContactShadows position={[0, -2, 0]} opacity={0.6} scale={40} blur={2} far={4.5} />

                    <BreathingGroup amplitude={isVolume35 ? 0.08 : 0.15}>
                        <group name="anatomical-subject" rotation={[-Math.PI / 2, 0, 0]}>
                            <React.Suspense fallback={null}>
                                {isVolume35 ? (
                                    <Volume35TorsoMesh />
                                ) : (
                                    <TorsoMesh />
                                )}
                                <ContactRing scale={scale} />
                            </React.Suspense>

                            {/* Anatomy debug overlay — Ctrl+Shift+D to toggle */}
                            {isVolume35 && <AnatomyDebugOverlay />}

                            {/* ── Registration Group: ONLY contains the CT volume ──
                                All other probe-following elements (slice plane, overlays)
                                live at the anatomical-subject level to avoid double-transforms. */}
                            <group
                                name="registration-group"
                                position={[
                                    registration.position[0],
                                    registration.position[1],
                                    registration.position[2],
                                ]}
                                rotation={[
                                    THREE.MathUtils.degToRad(registration.rotation[0]),
                                    THREE.MathUtils.degToRad(registration.rotation[1]),
                                    THREE.MathUtils.degToRad(registration.rotation[2]),
                                ]}
                                scale={[registration.scale, registration.scale, registration.scale]}
                            >
                                {volumeVoxelData && (visualizationSettings.showVolume || visualizationSettings.mode === 'beginner') && (
                                    <VolumeRaymarch
                                        voxelData={volumeVoxelData}
                                        bounds={bounds}
                                        wl={renderSettings.wl}
                                        ww={renderSettings.ww}
                                        scale={scale}
                                        clippingEnabled={renderSettings.clippingEnabled}
                                        probePos={probePos}
                                        volumeOpacity={visualizationSettings.volumeOpacity}
                                    />
                                )}
                            </group>

                            {/* Slice plane follows the PROBE (anatomical-subject space),
                                NOT the CT registration offset. */}
                            {visualizationSettings.showSlicePlane && (
                                <SlicePlane3D planeSizeMm={planeSizeMm} scale={scale} currentFrame={currentFrame} />
                            )}

                            {/* Torso overlays (scan zones, beginner hints) are positioned
                                relative to the torso anatomy, not the CT registration. */}
                            {isVolume35 && (
                                <Volume35TorsoOverlays
                                    mode={visualizationSettings.mode as 'beginner' | 'intermediate' | 'advanced'}
                                    scale={scale}
                                    probePos={probePos}
                                />
                            )}

                            {/* DragController lives at anatomical-subject level, NOT inside
                                registration-group. This ensures probe raycasting uses the
                                same coordinate space as the torso surface, and the probe
                                moves with the torso when it rotates — but is unaffected
                                by the CT registration transform. */}
                            {visualizationSettings.showProbe && (
                                <DragController
                                    scale={scale}
                                    volumeBounds={bounds}
                                    selectedCaseId={selectedCaseId as string}
                                    orbitControlsRef={controlsRef}
                                    interactionMode={interactionMode}
                                />
                            )}
                        </group>
                    </BreathingGroup>
                </Canvas>

                {/* Viewport Control Panel */}
                <div className={styles.viewportControls}>
                    {/* Interaction Modes */}
                    <div className={styles.controlGroup}>
                        <span className={styles.groupLabel}>MODE</span>
                        <button
                            className={`${styles.controlBtn} ${interactionMode === 'probe' ? styles.controlBtnActive : ''}`}
                            onClick={() => setInteractionMode('probe')}
                            title="Probe Mode: Left drag torso to move probe. Drag background to rotate camera."
                        >
                            <Target size={16} />
                        </button>
                        <button
                            className={`${styles.controlBtn} ${interactionMode === 'orbit' ? styles.controlBtnActive : ''}`}
                            onClick={() => setInteractionMode('orbit')}
                            title="Orbit Mode: Left drag anywhere to rotate the torso/camera."
                        >
                            <Compass size={16} />
                        </button>
                        <button
                            className={`${styles.controlBtn} ${interactionMode === 'pan' ? styles.controlBtnActive : ''}`}
                            onClick={() => setInteractionMode('pan')}
                            title="Pan Mode: Left drag anywhere to move/pan the torso."
                        >
                            <Move size={16} />
                        </button>
                    </div>

                    <div className={styles.groupDivider} />

                    {/* Quick Preset Angles */}
                    <div className={styles.controlGroup}>
                        <span className={styles.groupLabel}>ANGLE</span>
                        <button
                            className={styles.controlBtn}
                            onClick={() => setCameraPreset('front')}
                            title="Coronal View (Front)"
                        >
                            <span className={styles.textBtn}>F</span>
                        </button>
                        <button
                            className={styles.controlBtn}
                            onClick={() => setCameraPreset('side')}
                            title="Sagittal View (Side)"
                        >
                            <span className={styles.textBtn}>S</span>
                        </button>
                        <button
                            className={styles.controlBtn}
                            onClick={() => setCameraPreset('top')}
                            title="Axial View (Top)"
                        >
                            <span className={styles.textBtn}>T</span>
                        </button>
                        <button
                            className={styles.controlBtn}
                            onClick={() => setCameraPreset('iso')}
                            title="Isometric View (3D)"
                        >
                            <span className={styles.textBtn}>3D</span>
                        </button>
                    </div>

                    <div className={styles.groupDivider} />

                    {/* Camera Actions */}
                    <div className={styles.controlGroup}>
                        <span className={styles.groupLabel}>VIEW</span>
                        <button
                            className={styles.controlBtn}
                            onClick={() => handleZoom('in')}
                            title="Zoom In"
                        >
                            <ZoomIn size={16} />
                        </button>
                        <button
                            className={styles.controlBtn}
                            onClick={() => handleZoom('out')}
                            title="Zoom Out"
                        >
                            <ZoomOut size={16} />
                        </button>
                        <button
                            className={styles.controlBtn}
                            onClick={handleResetView}
                            title="Reset View"
                        >
                            <RotateCcw size={16} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

