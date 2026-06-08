/**
 * Volume35TorsoOverlays.tsx
 * ─────────────────────────
 * VOLUME 35 ONLY — Mode-aware 3D overlays rendered in the anatomical-subject group.
 *
 * Beginner mode:
 *   - Pulsing scan-zone rings at kidney + subcostal locations
 *   - Directional arrow indicator above target zone
 *   - "Anatomy Overlay" feature: localized semi-transparent reveal sphere
 *     at probe position (0.15–0.20 opacity, only when toggle active)
 *
 * Intermediate mode:
 *   - Subtle orientation ring only
 *
 * Advanced mode:
 *   - Nothing rendered
 */

import React, { useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useAppStore } from '@store/useAppStore';

// ─── Pulsing Scan Zone Ring ───────────────────────────────────────────────────

interface ScanZoneRingProps {
    position: [number, number, number];
    scale: number;
    color: string;
    size: number;
    phaseOffset?: number;
}

const ScanZoneRing: React.FC<ScanZoneRingProps> = ({
    position, scale, color, size, phaseOffset = 0,
}) => {
    const outerRef = useRef<THREE.Mesh>(null);
    const innerRef = useRef<THREE.Mesh>(null);

    useFrame(({ clock }) => {
        const t = clock.elapsedTime + phaseOffset;
        const pulse = 0.8 + 0.2 * Math.sin(t * 1.8);
        if (outerRef.current) {
            const mat = outerRef.current.material as THREE.MeshBasicMaterial;
            mat.opacity = 0.5 * pulse;
        }
        if (innerRef.current) {
            const mat = innerRef.current.material as THREE.MeshBasicMaterial;
            mat.opacity = 0.15 * pulse;
        }
    });

    const r = size * scale;

    return (
        <group position={position}>
            {/* Outer ring */}
            <mesh ref={outerRef} rotation={[Math.PI / 2, 0, 0]}>
                <ringGeometry args={[r * 0.85, r, 48]} />
                <meshBasicMaterial color={color} transparent opacity={0.5} side={THREE.DoubleSide} />
            </mesh>
            {/* Fill disc */}
            <mesh ref={innerRef} rotation={[Math.PI / 2, 0, 0]}>
                <circleGeometry args={[r * 0.85, 48]} />
                <meshBasicMaterial color={color} transparent opacity={0.15} side={THREE.DoubleSide} />
            </mesh>
        </group>
    );
};

// ─── Anatomy Overlay Reveal Sphere ────────────────────────────────────────────
// Shown only in Beginner mode when the "Anatomy Overlay" toggle is active.
// Creates a localized semi-transparent window near the probe — NOT full body transparency.

interface AnatomyOverlayProps {
    scale: number;
    probePos: { x: number; y: number; z: number };
}

const AnatomyOverlaySphere: React.FC<AnatomyOverlayProps> = ({ scale, probePos }) => {
    const sphereRef = useRef<THREE.Mesh>(null);
    const kidneyHintRef = useRef<THREE.Mesh>(null);

    useFrame(({ clock }) => {
        const t = clock.elapsedTime;
        const breathe = 0.97 + 0.03 * Math.sin(t * 0.9);
        if (sphereRef.current) {
            const mat = sphereRef.current.material as THREE.MeshBasicMaterial;
            mat.opacity = 0.16 * breathe;
        }
        if (kidneyHintRef.current) {
            const mat = kidneyHintRef.current.material as THREE.MeshBasicMaterial;
            mat.opacity = 0.22 * breathe;
        }
    });

    // Position the reveal sphere at the probe's current location
    const px = probePos.x * scale;
    const py = probePos.y * scale;
    const pz = probePos.z * scale;

    const revealRadius = 2.8 * scale;

    // Kidney target coordinates (anatomical-subject LOCAL space approx)
    const ts = 7.0; // torsoScale
    const rkX = 0.62 * ts;
    const rkY = 0.18 * ts;
    const rkZ = 0.05 * ts;

    return (
        <group position={[px, py, pz]}>
            {/* Localized reveal glow at probe footprint */}
            <mesh ref={sphereRef}>
                <sphereGeometry args={[revealRadius, 32, 32]} />
                <meshBasicMaterial
                    color="#e08050"
                    transparent
                    opacity={0.16}
                    depthWrite={false}
                    side={THREE.FrontSide}
                />
            </mesh>

            {/* Kidney outline hint — capsule-shaped indicator */}
            <mesh
                ref={kidneyHintRef}
                position={[rkX, rkY - 0.5, rkZ]}
                rotation={[0, 0, Math.PI * 0.08]}
            >
                <capsuleGeometry args={[0.6 * scale, 1.6 * scale, 12, 24]} />
                <meshBasicMaterial
                    color="#ff7043"
                    transparent
                    opacity={0.22}
                    depthWrite={false}
                />
            </mesh>

            {/* Label indicator ring */}
            <mesh position={[rkX, rkY, rkZ]} rotation={[Math.PI / 2, 0, 0]}>
                <ringGeometry args={[revealRadius * 0.95, revealRadius, 48]} />
                <meshBasicMaterial
                    color="#ff8a65"
                    transparent
                    opacity={0.35}
                    side={THREE.DoubleSide}
                />
            </mesh>
        </group>
    );
};

// ─── Directional Arrow (Beginner) ─────────────────────────────────────────────

interface DirectionalArrowProps {
    targetPos: [number, number, number];
    scale: number;
}

const DirectionalArrow: React.FC<DirectionalArrowProps> = ({ targetPos, scale }) => {
    const arrowRef = useRef<THREE.Group>(null);

    useFrame(({ clock }) => {
        if (!arrowRef.current) return;
        const t = clock.elapsedTime;
        arrowRef.current.position.y = targetPos[1] + 2.8 * scale + Math.sin(t * 2.2) * 0.3 * scale;
    });

    const coneR = 0.35 * scale;
    const coneH = 0.9 * scale;

    return (
        <group ref={arrowRef} position={[targetPos[0], targetPos[1] + 2.8 * scale, targetPos[2]]}>
            {/* Arrow pointing down toward target */}
            <mesh rotation={[Math.PI, 0, 0]}>
                <coneGeometry args={[coneR, coneH, 8]} />
                <meshBasicMaterial color="#fbbf24" transparent opacity={0.9} />
            </mesh>
            {/* Arrow shaft */}
            <mesh position={[0, coneH * 0.7, 0]}>
                <cylinderGeometry args={[coneR * 0.3, coneR * 0.3, coneH * 0.8, 8]} />
                <meshBasicMaterial color="#fbbf24" transparent opacity={0.7} />
            </mesh>
        </group>
    );
};

// ─── Intermediate Orientation Ring ───────────────────────────────────────────

const IntermediateOrientationRing: React.FC<{ scale: number }> = ({ scale }) => {
    const ringRef = useRef<THREE.Mesh>(null);
    useFrame(({ clock }) => {
        if (!ringRef.current) return;
        const mat = ringRef.current.material as THREE.MeshBasicMaterial;
        mat.opacity = 0.12 + 0.06 * Math.sin(clock.elapsedTime * 0.7);
    });

    return (
        <mesh
            ref={ringRef}
            position={[0, 0.18 * 7.0, 0]}
            rotation={[0, 0, 0]}
        >
            <torusGeometry args={[3.2 * scale, 0.06 * scale, 12, 64]} />
            <meshBasicMaterial color="#3b82f6" transparent opacity={0.15} />
        </mesh>
    );
};

// ─── Main Export ──────────────────────────────────────────────────────────────

interface Volume35TorsoOverlaysProps {
    mode: 'beginner' | 'intermediate' | 'advanced';
    scale: number;
    probePos: { x: number; y: number; z: number };
}

export const Volume35TorsoOverlays: React.FC<Volume35TorsoOverlaysProps> = ({ mode, scale, probePos: probePosFromProps }) => {
    const { anatomyHintActive, probePos: probePosFromStore } = useAppStore();
    const probePos = probePosFromProps || probePosFromStore;

    if (mode === 'advanced') return null;

    if (mode === 'intermediate') {
        return <IntermediateOrientationRing scale={scale} />;
    }

    // ── Beginner mode ─────────────────────────────────────────────────────────
    // Scan zone positions in anatomical-subject LOCAL space (pre-scale)
    // torsoScale ≈ 7 from the new geometry (14 units / ~2.0 shoulder width)
    const ts = 7.0; // approximate torsoScale for positioning
    const rkPos: [number, number, number] = [0.62 * ts, 0.18 * ts, 0.05 * ts];
    const scPos: [number, number, number] = [0.50 * ts, 0.70 * ts, 0.18 * ts];

    return (
        <group name="volume35-beginner-overlays">
            {/* Right kidney scan zone ring — primary target */}
            <ScanZoneRing
                position={rkPos}
                scale={scale}
                color="#4ade80"
                size={1.6}
                phaseOffset={0}
            />

            {/* Subcostal approach zone ring */}
            <ScanZoneRing
                position={scPos}
                scale={scale}
                color="#34d399"
                size={1.2}
                phaseOffset={1.2}
            />

            {/* Directional arrow pointing toward kidney zone */}
            <DirectionalArrow targetPos={rkPos} scale={scale} />

            {/* Localized anatomy reveal — only when toggle active */}
            {anatomyHintActive && (
                <AnatomyOverlaySphere probePos={probePos} scale={scale} />
            )}
        </group>
    );
};
