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
    Grid,
    Html,
    Line,
    Billboard,
} from '@react-three/drei';
import * as THREE from 'three';
import { useAppStore } from '@store/useAppStore';
import { wsService } from '@services/websocket';
import type { VolumeVoxelData } from '@/types';
import styles from './VolumeViewer.module.css';

// ── Euler helper (matches backend: Rz @ Ry @ Rx — extrinsic XYZ) ────────────
function buildProbeMatrix(
    pos: { x: number; y: number; z: number },
    rot: { pitch: number; yaw: number; roll: number }
): THREE.Matrix4 {
    const p = THREE.MathUtils.degToRad(rot.pitch);
    const y = THREE.MathUtils.degToRad(rot.yaw);
    const r = THREE.MathUtils.degToRad(rot.roll);

    const Rx = new THREE.Matrix4().makeRotationX(p);
    const Ry = new THREE.Matrix4().makeRotationY(y);
    const Rz = new THREE.Matrix4().makeRotationZ(r);

    const R = new THREE.Matrix4().multiplyMatrices(Rz, new THREE.Matrix4().multiplyMatrices(Ry, Rx));
    R.setPosition(pos.x, pos.y, pos.z);
    return R;
}

// ── Raymarching Shader ────────────────────────────────────────────────────────
const VOLUME_VERTEX_SHADER = `
  varying vec3 v_world_pos;
  void main() {
    v_world_pos = (modelMatrix * vec4(position, 1.0)).xyz;
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
  
  uniform bool u_clipping_enabled;
  uniform vec3 u_probe_pos;
  
  varying vec3 v_world_pos;

  // Random number for jittering
  float rand(vec2 co) {
    return fract(sin(dot(co.xy, vec2(12.9898, 78.233))) * 43758.5453);
  }

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

  vec3 get_gradient(vec3 uvw) {
    float h = 0.01;
    float v0 = texture(u_data, uvw + vec3(h, 0.0, 0.0)).r;
    float v1 = texture(u_data, uvw - vec3(h, 0.0, 0.0)).r;
    float v2 = texture(u_data, uvw + vec3(0.0, h, 0.0)).r;
    float v3 = texture(u_data, uvw - vec3(0.0, h, 0.0)).r;
    float v4 = texture(u_data, uvw + vec3(0.0, 0.0, h)).r;
    float v5 = texture(u_data, uvw - vec3(0.0, 0.0, h)).r;
    return normalize(vec3(v0 - v1, v2 - v3, v4 - v5));
  }

  void main() {
    vec3 ray_dir = normalize(v_world_pos - u_cam_pos);
    vec2 t_hits = intersect_box(u_cam_pos, ray_dir);
    
    if (t_hits.x > t_hits.y) discard;

    float t = max(0.0, t_hits.x);
    
    // Stochastic jitter to reduce banding
    t += rand(v_world_pos.xy) * 0.01;

    vec3 composite_color = vec3(0.0);
    float composite_alpha = 0.0;
    
    const int STEPS = 160;
    float dt = (t_hits.y - t_hits.x) / float(STEPS);
    
    float l_low = u_wl - u_ww * 0.5;

    for (int i = 0; i < 160; i++) {
        vec3 curr_world = u_cam_pos + t * ray_dir;
        
        // clipping logic (in world coordinates)
        if (u_clipping_enabled) {
            float dist = distance(curr_world, u_probe_pos);
            if (dist > 60.0) { // 60mm radius (approx 6 scene units depending on scale)
                t += dt;
                continue;
            }
        }

        vec3 uvw = (curr_world - u_min) / (u_max - u_min);
        
        float val = texture(u_data, uvw).r;
        float intensity = clamp((val - l_low) / u_ww, 0.0, 1.0);
        
        if (intensity > 0.02) {
            float tf_alpha;
            vec3 tf_color;

            if (intensity < 0.2) {
                // Noise / Air suppression
                tf_alpha = 0.0;
                tf_color = vec3(0.0);
            } else if (intensity < 0.6) {
                // Soft Tissue (Reddish/Fleshy)
                float norm = (intensity - 0.2) / 0.4;
                tf_alpha = pow(norm, 1.8) * 0.08;
                tf_color = mix(vec3(0.6, 0.3, 0.3), vec3(0.8, 0.5, 0.4), norm);
            } else {
                // Bone / Dense structural elements (White/Ivory)
                float norm = (intensity - 0.6) / 0.4;
                tf_alpha = 0.15 + norm * 0.5;
                tf_color = mix(vec3(0.9, 0.9, 0.8), vec3(1.0, 1.0, 1.0), norm);

                // Add simple gradient-based shading for bone
                vec3 normal = get_gradient(uvw);
                float light = max(dot(normal, -ray_dir), 0.3); // Simple N-dot-L (camera light)
                tf_color *= (0.6 + 0.4 * light);
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
    gl_FragColor = vec4(composite_color, composite_alpha);
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
}

const VolumeRaymarch: React.FC<VolumeRaymarchProps> = ({ 
    voxelData, bounds, wl, ww, scale, clippingEnabled, probePos 
}) => {
    const { camera } = useThree();
    const textureRef = useRef<THREE.Data3DTexture | null>(null);

    // Initial texture creation
    const texture = React.useMemo(() => {
        const { dims } = voxelData.metadata;
        const tex = new THREE.Data3DTexture(voxelData.data, dims[2], dims[1], dims[0]); // W, H, D
        tex.format = THREE.RedFormat;
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
        u_clipping_enabled: { value: false },
        u_probe_pos: { value: new THREE.Vector3() },
    }), [texture]);

    // Efficiently update uniforms that change outside memoization
    useFrame(() => {
        uniforms.u_cam_pos.value.copy(camera.position);
        uniforms.u_min.value.set(bounds.min[0] * scale, bounds.min[1] * scale, bounds.min[2] * scale);
        uniforms.u_max.value.set(bounds.max[0] * scale, bounds.max[1] * scale, bounds.max[2] * scale);
        uniforms.u_wl.value = normWL;
        uniforms.u_ww.value = normWW;
        uniforms.u_clipping_enabled.value = clippingEnabled;
        uniforms.u_probe_pos.value.set(probePos.x * scale, probePos.y * scale, probePos.z * scale);
    });

    const sx = (bounds.max[0] - bounds.min[0]) * scale;
    const sy = (bounds.max[1] - bounds.min[1]) * scale;
    const sz = (bounds.max[2] - bounds.min[2]) * scale;

    const cx = ((bounds.min[0] + bounds.max[0]) / 2) * scale;
    const cy = ((bounds.min[1] + bounds.max[1]) / 2) * scale;
    const cz = ((bounds.min[2] + bounds.max[2]) / 2) * scale;

    return (
        <mesh position={[cx, cy, cz]} scale={[1, 1, 1]}>
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

// ── Volume Bounding Box ──────────────────────────────────────────────────────
interface VolumeBoundsProps {
    min: [number, number, number];
    max: [number, number, number];
    scale: number; // world→scene scale factor
}

const VolumeBounds: React.FC<VolumeBoundsProps> = ({ min, max, scale }) => {
    const cx = ((min[0] + max[0]) / 2) * scale;
    const cy = ((min[1] + max[1]) / 2) * scale;
    const cz = ((min[2] + max[2]) / 2) * scale;
    const sx = (max[0] - min[0]) * scale;
    const sy = (max[1] - min[1]) * scale;
    const sz = (max[2] - min[2]) * scale;

    return (
        <group position={[cx, cy, cz]}>
            {/* Outer wireframe */}
            <mesh>
                <boxGeometry args={[sx, sy, sz]} />
                <meshStandardMaterial
                    color="#38bdf8"
                    wireframe
                    transparent
                    opacity={0.15}
                />
            </mesh>
            {/* Inner translucent fill */}
            <mesh>
                <boxGeometry args={[sx * 0.999, sy * 0.999, sz * 0.999]} />
                <meshBasicMaterial
                    color="#0c1a2e"
                    transparent
                    opacity={0.45}
                    depthWrite={false}
                />
            </mesh>
            {/* Face outlines — top */}
            <lineSegments>
                <edgesGeometry args={[new THREE.BoxGeometry(sx, sy, sz)]} />
                <lineBasicMaterial color="#0ea5e9" transparent opacity={0.4} />
            </lineSegments>
        </group>
    );
};

// ── Anatomical Orientation Labels ─────────────────────────────────────────────
interface DirectionLabelsProps {
    min: [number, number, number];
    max: [number, number, number];
    scale: number;
}

const DirectionLabels: React.FC<DirectionLabelsProps> = ({ min, max, scale }) => {
    const cx = ((min[0] + max[0]) / 2) * scale;
    const cy = ((min[1] + max[1]) / 2) * scale;
    const cz = ((min[2] + max[2]) / 2) * scale;
    const hx = (max[0] - min[0]) * scale * 0.5;
    const hy = (max[1] - min[1]) * scale * 0.5;
    const hz = (max[2] - min[2]) * scale * 0.5;

    const labelStyle = {
        color: 'white',
        fontSize: '12px',
        fontWeight: 'bold',
        textShadow: '0 0 4px rgba(0,0,0,0.8)',
        pointerEvents: 'none' as const,
        userSelect: 'none' as const,
    };

    return (
        <group>
            {/* Superior / Inferior (Z) */}
            <Billboard position={[cx, cy, cz + hz + 0.5]}>
                <Html center occlude>
                    <div style={labelStyle}>S</div>
                </Html>
            </Billboard>
            <Billboard position={[cx, cy, cz - hz - 0.5]}>
                <Html center occlude>
                    <div style={labelStyle}>I</div>
                </Html>
            </Billboard>
            {/* Left / Right (X) */}
            <Billboard position={[cx + hx + 0.5, cy, cz]}>
                <Html center occlude>
                    <div style={labelStyle}>R</div>
                </Html>
            </Billboard>
            <Billboard position={[cx - hx - 0.5, cy, cz]}>
                <Html center occlude>
                    <div style={labelStyle}>L</div>
                </Html>
            </Billboard>
            {/* Anterior / Posterior (Y) */}
            <Billboard position={[cx, cy + hy + 0.5, cz]}>
                <Html center occlude>
                    <div style={labelStyle}>A</div>
                </Html>
            </Billboard>
            <Billboard position={[cx, cy - hy - 0.5, cz]}>
                <Html center occlude>
                    <div style={labelStyle}>P</div>
                </Html>
            </Billboard>
        </group>
    );
};

// ── Anatomical Axis Lines ─────────────────────────────────────────────────────
interface AxisLinesProps {
    min: [number, number, number];
    max: [number, number, number];
    scale: number;
}

const AxisLines: React.FC<AxisLinesProps> = ({ min, max, scale }) => {
    const cx = ((min[0] + max[0]) / 2) * scale;
    const cy = ((min[1] + max[1]) / 2) * scale;
    const cz = ((min[2] + max[2]) / 2) * scale;
    const sx = (max[0] - min[0]) * scale * 0.55;
    const sy = (max[1] - min[1]) * scale * 0.55;
    const sz = (max[2] - min[2]) * scale * 0.55;
    const dash: [number, number, number, number] = [0.05, 0.05, 50, 1];
    return (
        <group>
            {/* X axis — red */}
            <Line
                points={[[cx - sx, cy, cz], [cx + sx, cy, cz]]}
                color="#f97316"
                lineWidth={1}
                dashed
                dashScale={dash[2]}
                dashSize={dash[0]}
                gapSize={dash[1]}
                transparent
                opacity={0.35}
            />
            {/* Y axis — green */}
            <Line
                points={[[cx, cy - sy, cz], [cx, cy + sy, cz]]}
                color="#4ade80"
                lineWidth={1}
                dashed
                dashScale={dash[2]}
                dashSize={dash[0]}
                gapSize={dash[1]}
                transparent
                opacity={0.35}
            />
            {/* Z axis — blue */}
            <Line
                points={[[cx, cy, cz - sz], [cx, cy, cz + sz]]}
                color="#60a5fa"
                lineWidth={1}
                dashed
                dashScale={dash[2]}
                dashSize={dash[0]}
                gapSize={dash[1]}
                transparent
                opacity={0.35}
            />
        </group>
    );
};

// ── Probe Mesh ────────────────────────────────────────────────────────────────
interface ProbeMeshProps {
    scale: number;
    onDragStart: () => void;
    onDragEnd: () => void;
    onDrag: (delta: THREE.Vector3) => void;
}

const ProbeMesh3D: React.FC<ProbeMeshProps> = ({ scale, onDragStart, onDragEnd, onDrag }) => {
    const groupRef = useRef<THREE.Group>(null);
    const isDragging = useRef(false);
    const dragStart = useRef<THREE.Vector3>(new THREE.Vector3());
    const planeRef = useRef<THREE.Plane>(new THREE.Plane());

    const { probePos, probeRot } = useAppStore();
    const { camera, gl, raycaster } = useThree();

    // Update mesh to match current probe state every frame
    useFrame(() => {
        if (!groupRef.current) return;
        const mat = buildProbeMatrix(
            { x: probePos.x * scale, y: probePos.y * scale, z: probePos.z * scale },
            probeRot
        );
        groupRef.current.matrix.copy(mat);
        groupRef.current.matrixAutoUpdate = false;
        groupRef.current.matrixWorldNeedsUpdate = true;
    });

    const getPlaneIntersect = useCallback((e: MouseEvent): THREE.Vector3 | null => {
        const rect = gl.domElement.getBoundingClientRect();
        const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        const ny = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(new THREE.Vector2(nx, ny), camera);
        const target = new THREE.Vector3();
        return raycaster.ray.intersectPlane(planeRef.current, target);
    }, [camera, gl, raycaster]);

    const handlePointerDown = useCallback((e: React.PointerEvent) => {
        e.stopPropagation();
        isDragging.current = true;
        onDragStart();
        const probeWorld = new THREE.Vector3(probePos.x * scale, probePos.y * scale, probePos.z * scale);
        const camDir = new THREE.Vector3();
        camera.getWorldDirection(camDir);
        planeRef.current.setFromNormalAndCoplanarPoint(camDir, probeWorld);
        const hit = getPlaneIntersect(e.nativeEvent as MouseEvent);
        if (hit) dragStart.current.copy(hit);
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
    }, [camera, getPlaneIntersect, onDragStart, probePos, scale]);

    const handlePointerMove = useCallback((e: React.PointerEvent) => {
        if (!isDragging.current) return;
        e.stopPropagation();
        const hit = getPlaneIntersect(e.nativeEvent as MouseEvent);
        if (!hit) return;
        const delta = hit.clone().sub(dragStart.current);
        dragStart.current.copy(hit);
        onDrag(delta);
    }, [getPlaneIntersect, onDrag]);

    const handlePointerUp = useCallback((e: React.PointerEvent) => {
        isDragging.current = false;
        onDragEnd();
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    }, [onDragEnd]);

    const bodyLen = 5 * scale;
    const bodyRad = 1.0 * scale;
    const footRad = 1.3 * scale;
    const footThick = 0.6 * scale;

    return (
        <group ref={groupRef}>
            {/* Probe Body */}
            <mesh position={[0, bodyLen / 2 + footThick, 0]} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp}>
                <boxGeometry args={[bodyRad * 2, bodyLen, bodyRad]} />
                <meshStandardMaterial color="#334155" roughness={0.3} metalness={0.8} />
            </mesh>
            
            {/* Probe Head / Footprint */}
            <mesh position={[0, footThick / 2, 0]} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp}>
                <boxGeometry args={[footRad * 2, footThick, footRad]} />
                <meshStandardMaterial color="#0ea5e9" emissive="#0ea5e9" emissiveIntensity={0.4} />
            </mesh>

            {/* Scanning Direction Indicator (Small arrow on side) */}
            <mesh position={[footRad, footThick, 0]} rotation={[0, 0, -Math.PI / 2]}>
                <coneGeometry args={[0.3 * scale, 0.8 * scale, 4]} />
                <meshBasicMaterial color="#fbbf24" />
            </mesh>

            {/* Probe Marker label (Small and discrete) */}
            <Html position={[0, bodyLen + footThick + 0.5 * scale, 0]} center distanceFactor={40}>
                <div style={{
                    color: '#0ea5e9',
                    fontSize: '8px',
                    fontWeight: 800,
                    textShadow: '0 0 2px black',
                    pointerEvents: 'none',
                    opacity: 0.7
                }}>
                    PROBE
                </div>
            </Html>
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
    const { probePos, probeRot } = useAppStore();

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
        const mat = buildProbeMatrix(
            { x: probePos.x * scale, y: probePos.y * scale, z: probePos.z * scale },
            probeRot
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
    const { probePos, probeRot } = useAppStore();
    const half = (planeSizeMm * scale) / 2;

    useFrame(() => {
        if (!lineRef.current) return;
        const mat = buildProbeMatrix(
            { x: probePos.x * scale, y: probePos.y * scale, z: probePos.z * scale },
            probeRot
        );
        lineRef.current.matrix.copy(mat);
        lineRef.current.matrixAutoUpdate = false;
        lineRef.current.matrixWorldNeedsUpdate = true;
    });

    const positions = new Float32Array([
        -half, -half, 0,  half, -half, 0,
        half, -half, 0,   half,  half, 0,
        half,  half, 0,  -half,  half, 0,
        -half,  half, 0, -half, -half, 0,
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

// ── Beam direction indicator ──────────────────────────────────────────────────
const BeamIndicator: React.FC<{ scale: number }> = ({ scale }) => {
    const groupRef = useRef<THREE.Group>(null);
    const { probePos, probeRot } = useAppStore();
    const beamLen = 8 * scale;

    useFrame(() => {
        if (!groupRef.current) return;
        const mat = buildProbeMatrix(
            { x: probePos.x * scale, y: probePos.y * scale, z: probePos.z * scale },
            probeRot
        );
        groupRef.current.matrix.copy(mat);
        groupRef.current.matrixAutoUpdate = false;
        groupRef.current.matrixWorldNeedsUpdate = true;
    });

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(
        new Float32Array([0, 0, 0, 0, -beamLen, 0]), 3
    ));

    return (
        <group ref={groupRef}>
            <lineSegments geometry={geo}>
                <lineBasicMaterial color="#fbbf24" transparent opacity={0.5} />
            </lineSegments>
        </group>
    );
};

// ── Probe drag controller (inner canvas component) ────────────────────────────
interface DragControllerProps {
    volumeBounds: { min: [number, number, number]; max: [number, number, number] };
    scale: number;
}

const DragController: React.FC<DragControllerProps> = ({ volumeBounds, scale }) => {
    const { probePos, probeRot, setProbePos, updatePose } = useAppStore();
    const { gl } = useThree();

    const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

    const handleDragStart = useCallback(() => {
        // Disable OrbitControls during drag — done by making Canvas pointer events passive
        // eslint-disable-next-line react-hooks/immutability
        gl.domElement.style.cursor = 'grabbing';
    }, [gl]);

    const handleDragEnd = useCallback(() => {
        // eslint-disable-next-line react-hooks/immutability
        gl.domElement.style.cursor = 'default';
    }, [gl]);

    const sendThrottleRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const handleDrag = useCallback((delta: THREE.Vector3) => {
        // delta is in scene space — convert back to mm
        const dx = delta.x / scale;
        const dy = delta.y / scale;
        const dz = delta.z / scale;

        const newPos = {
            x: clamp(probePos.x + dx, volumeBounds.min[0], volumeBounds.max[0]),
            y: clamp(probePos.y + dy, volumeBounds.min[1], volumeBounds.max[1]),
            z: clamp(probePos.z + dz, volumeBounds.min[2], volumeBounds.max[2]),
        };

        setProbePos(newPos);
        updatePose({ position: newPos, rotation: probeRot });

        if (sendThrottleRef.current) clearTimeout(sendThrottleRef.current);
        sendThrottleRef.current = setTimeout(() => {
            wsService.sendProbeUpdate(
                newPos.x, newPos.y, newPos.z,
                probeRot.pitch, probeRot.yaw, probeRot.roll
            );
        }, 30); // ~33fps
    }, [probePos, probeRot, scale, volumeBounds, setProbePos, updatePose]);

    return (
        <ProbeMesh3D
            scale={scale}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDrag={handleDrag}
        />
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
        updateRenderSettings,
        currentFrame 
    } = useAppStore();

    // Use real volume bounds if available, otherwise sensible defaults
    const bounds = volumeInfo?.bounds ?? {
        min: [-150, -150, -150] as [number, number, number],
        max: [150, 150, 150] as [number, number, number],
        center: [0, 0, 0] as [number, number, number],
    };

    // Scale factor: map mm to a reasonable scene unit (~0.02 → 300mm → 6 units)
    const volumeExtent = Math.max(
        bounds.max[0] - bounds.min[0],
        bounds.max[1] - bounds.min[1],
        bounds.max[2] - bounds.min[2],
    );
    const SCENE_SIZE = 12; // target max scene units
    const scale = SCENE_SIZE / volumeExtent;

    const cx = ((bounds.min[0] + bounds.max[0]) / 2) * scale;
    const cy = ((bounds.min[1] + bounds.max[1]) / 2) * scale;
    const cz = ((bounds.min[2] + bounds.max[2]) / 2) * scale;
    const camDist = SCENE_SIZE * 1.8;

    const planeSizeMm = renderSettings.planeSizeMm || 150;

    return (
        <div className={styles.container}>
            {/* Top HUD */}
            <div className={styles.overlay}>
                <span className={styles.label}>3D VOLUME</span>
                {volumeInfo && (
                    <span className={styles.labelDim}>
                        {volumeInfo.shape.join('×')} vx
                    </span>
                )}
            </div>

            {/* Coordinate HUD */}
            <div className={styles.coordHud}>
                <div className={styles.coordRow}>
                    <span className={styles.coordAxisX}>X</span>
                    <span className={styles.coordVal}>{probePos.x.toFixed(1)} mm</span>
                </div>
                <div className={styles.coordRow}>
                    <span className={styles.coordAxisY}>Y</span>
                    <span className={styles.coordVal}>{probePos.y.toFixed(1)} mm</span>
                </div>
                <div className={styles.coordRow}>
                    <span className={styles.coordAxisZ}>Z</span>
                    <span className={styles.coordVal}>{probePos.z.toFixed(1)} mm</span>
                </div>
                <div className={styles.coordDivider} />
                <div className={styles.coordRow}>
                    <span className={styles.coordLabel}>P</span>
                    <span className={styles.coordVal}>{probeRot.pitch.toFixed(0)}°</span>
                </div>
                <div className={styles.coordRow}>
                    <span className={styles.coordLabel}>Y</span>
                    <span className={styles.coordVal}>{probeRot.yaw.toFixed(0)}°</span>
                </div>
                <div className={styles.coordRow}>
                    <span className={styles.coordLabel}>R</span>
                    <span className={styles.coordVal}>{probeRot.roll.toFixed(0)}°</span>
                </div>
            </div>

            {/* Interaction hint */}
            <div className={styles.hintBadge}>
                <div className={styles.visualToggles}>
                    <label className={styles.toggleLabel}>
                        <input 
                            type="checkbox"
                            checked={renderSettings.clippingEnabled}
                            onChange={(e) => updateRenderSettings({ clippingEnabled: e.target.checked })}
                        />
                        <span>Local Clipping</span>
                    </label>
                </div>
                <div className={styles.divider} />
                <span>🖱 Drag probe · Orbit: right-click</span>
                <button 
                    className={styles.resetBtn}
                    onClick={() => controlsRef.current?.reset()}
                    title="Reset camera view"
                >
                    Reset View
                </button>
            </div>

            {/* Three.js Canvas */}
            <div className={styles.vtkContainer}>
                <Canvas
                    shadows
                    gl={{ antialias: true, alpha: true }}
                    style={{ background: 'transparent' }}
                >
                    <PerspectiveCamera
                        makeDefault
                        position={[cx + camDist * 0.6, cy + camDist * 0.5, cz + camDist * 0.8]}
                        fov={45}
                        near={0.01}
                        far={500}
                    />
                    <OrbitControls
                        ref={controlsRef}
                        enablePan
                        enableZoom
                        enableRotate
                        mouseButtons={{
                            LEFT: THREE.MOUSE.ROTATE,
                            MIDDLE: THREE.MOUSE.DOLLY,
                            RIGHT: THREE.MOUSE.PAN,
                        }}
                        minDistance={SCENE_SIZE * 0.4}
                        maxDistance={SCENE_SIZE * 6}
                        target={[cx, cy, cz]}
                    />

                    <ambientLight intensity={0.4} />
                    <directionalLight position={[10, 20, 10]} intensity={0.8} castShadow />
                    <pointLight position={[-10, 10, -10]} intensity={0.4} color="#6366f1" />

                    {/* Volume bounding box */}
                    {/* Volume Render (Raymarching) */}
                    {volumeVoxelData && (
                        <VolumeRaymarch
                            voxelData={volumeVoxelData}
                            bounds={bounds}
                            wl={renderSettings.wl}
                            ww={renderSettings.ww}
                            scale={scale}
                            clippingEnabled={renderSettings.clippingEnabled}
                            probePos={probePos}
                        />
                    )}

                    {!volumeVoxelData && (
                        <VolumeBounds min={bounds.min} max={bounds.max} scale={scale} />
                    )}

                    {/* Anatomical markers */}
                    <DirectionLabels min={bounds.min} max={bounds.max} scale={scale} />
                    <AxisLines min={bounds.min} max={bounds.max} scale={scale} />

                    {/* Slice plane + outline */}
                    <SlicePlane3D 
                        planeSizeMm={planeSizeMm} 
                        scale={scale} 
                        currentFrame={currentFrame}
                    />
                    <SlicePlaneOutline planeSizeMm={planeSizeMm} scale={scale} />

                    {/* Beam direction line */}
                    <BeamIndicator scale={scale} />

                    {/* Probe mesh with drag */}
                    <DragController volumeBounds={bounds} scale={scale} />

                    {/* Floor grid */}
                    <Grid
                        position={[cx, (bounds.min[1]) * scale - 0.01, cz]}
                        args={[SCENE_SIZE * 3, SCENE_SIZE * 3]}
                        cellSize={SCENE_SIZE / 10}
                        cellThickness={0.5}
                        cellColor="#1e293b"
                        sectionSize={SCENE_SIZE / 2}
                        sectionThickness={1}
                        sectionColor="#334155"
                        fadeDistance={SCENE_SIZE * 4}
                        fadeStrength={2}
                        infiniteGrid={false}
                    />
                </Canvas>
            </div>

            {/* Axis legend */}
            <div className={styles.axisLegend}>
                <span className={styles.legendX}>● X L/R</span>
                <span className={styles.legendY}>● Y A/P</span>
                <span className={styles.legendZ}>● Z S/I</span>
                <span className={styles.legendPlane}>◇ Slice</span>
            </div>
        </div>
    );
};
