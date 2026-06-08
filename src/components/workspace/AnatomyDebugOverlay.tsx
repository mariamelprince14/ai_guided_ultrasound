/**
 * AnatomyDebugOverlay.tsx
 * ───────────────────────
 * VOLUME 35 ONLY — Runtime-togglable anatomical debug visualization.
 *
 * Renders inside the "anatomical-subject" group (Torso Local Space = TLS).
 * Provides bounding box wireframes, axis arrows, and anatomical landmark spheres
 * for calibrating the CT volume embedding.
 *
 * Toggle:  Ctrl+Shift+D  (keyboard shortcut)
 * Default: disabled (zero overhead when off)
 *
 * Debug elements:
 *   [CYAN]    Torso bounding box
 *   [YELLOW]  Internal cavity region (the valid anatomy zone)
 *   [MAGENTA] CT volume bounding box (after scale + position)
 *   [RED]     Right kidney landmark
 *   [BLUE]    Left kidney landmark
 *   [ORANGE]  Liver landmark
 *   [PURPLE]  Spine landmark
 *   [RGB]     XYZ axis arrows at origin (Red=+X, Green=+Y, Blue=+Z)
 */

import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useAppStore } from '@store/useAppStore';
import {
    AnatomyDebugState,
    AnatomicalLandmarkRegistry,
    computeAnatomicalCavity,
    computeAxisRemapFromAffine,
    VOLUME35_MM_TO_SCENE,
} from '@/utils/AnatomicalEmbedding';

// ── Wire Box Helper ────────────────────────────────────────────────────────────

interface WireBoxProps {
    min: [number, number, number];
    max: [number, number, number];
    color: string;
    opacity?: number;
}

const WireBox: React.FC<WireBoxProps> = ({ min, max, color, opacity = 0.8 }) => {
    const cx = (min[0] + max[0]) * 0.5;
    const cy = (min[1] + max[1]) * 0.5;
    const cz = (min[2] + max[2]) * 0.5;
    const sx = max[0] - min[0];
    const sy = max[1] - min[1];
    const sz = max[2] - min[2];

    return (
        <mesh position={[cx, cy, cz]}>
            <boxGeometry args={[sx, sy, sz]} />
            <meshBasicMaterial
                color={color}
                wireframe
                transparent
                opacity={opacity}
                depthWrite={false}
            />
        </mesh>
    );
};

// ── Axis Arrow Helper ──────────────────────────────────────────────────────────

const AxisArrows: React.FC<{ length?: number }> = ({ length = 3.0 }) => {
    const axes = [
        { dir: [length, 0, 0] as [number, number, number], color: '#ff3333', label: '+X(R)' },
        { dir: [0, length, 0] as [number, number, number], color: '#33ff33', label: '+Y(S)' },
        { dir: [0, 0, length] as [number, number, number], color: '#3333ff', label: '+Z(A)' },
    ];

    return (
        <group name="axis-arrows">
            {axes.map(({ dir, color }) => {
                const len = Math.sqrt(dir[0] ** 2 + dir[1] ** 2 + dir[2] ** 2);
                const cx = dir[0] * 0.5, cy = dir[1] * 0.5, cz = dir[2] * 0.5;
                // Find rotation from Y-axis (cylinder default) to direction
                const from = new THREE.Vector3(0, 1, 0);
                const to   = new THREE.Vector3(dir[0], dir[1], dir[2]).normalize();
                const quat = new THREE.Quaternion().setFromUnitVectors(from, to);
                const euler = new THREE.Euler().setFromQuaternion(quat);

                return (
                    <group key={color}>
                        {/* Shaft */}
                        <mesh
                            position={[cx, cy, cz]}
                            rotation={[euler.x, euler.y, euler.z]}
                        >
                            <cylinderGeometry args={[0.04, 0.04, len * 0.85, 8]} />
                            <meshBasicMaterial color={color} />
                        </mesh>
                        {/* Arrowhead cone */}
                        <mesh
                            position={[dir[0] * 0.92, dir[1] * 0.92, dir[2] * 0.92]}
                            rotation={[euler.x, euler.y, euler.z]}
                        >
                            <coneGeometry args={[0.12, len * 0.15, 8]} />
                            <meshBasicMaterial color={color} />
                        </mesh>
                    </group>
                );
            })}
        </group>
    );
};

// ── Landmark Sphere ────────────────────────────────────────────────────────────

interface LandmarkSphereProps {
    position: [number, number, number];
    color: string;
    label: string;
    torsoScale: number;
}

const LandmarkSphere: React.FC<LandmarkSphereProps> = ({ position, color, torsoScale }) => {
    const meshRef = useRef<THREE.Mesh>(null);

    useFrame(({ clock }) => {
        if (!meshRef.current) return;
        const mat = meshRef.current.material as THREE.MeshBasicMaterial;
        mat.opacity = 0.5 + 0.25 * Math.sin(clock.elapsedTime * 2.0);
    });

    const [px, py, pz] = position;
    const worldPos: [number, number, number] = [
        px * torsoScale,
        py * torsoScale,
        pz * torsoScale,
    ];

    return (
        <mesh ref={meshRef} position={worldPos}>
            <sphereGeometry args={[0.25, 12, 12]} />
            <meshBasicMaterial
                color={color}
                transparent
                opacity={0.65}
                depthWrite={false}
            />
        </mesh>
    );
};

// ── CT Volume Box (derived from registration) ─────────────────────────────────

const CTVolumeDebugBox: React.FC<{
    registration: { position: [number, number, number]; scale: number };
    anatomy: import('@/types').AnatomyMetadata | null;
}> = ({ registration, anatomy }) => {
    if (!anatomy) return null;

    const axisRemap = computeAxisRemapFromAffine(anatomy);
    const worldSize = anatomy.worldBounds.size;

    const ctW = worldSize[axisRemap.tlsXFromWorld] * VOLUME35_MM_TO_SCENE * registration.scale;
    const ctH = worldSize[axisRemap.tlsYFromWorld] * VOLUME35_MM_TO_SCENE * registration.scale;
    const ctD = worldSize[axisRemap.tlsZFromWorld] * VOLUME35_MM_TO_SCENE * registration.scale;

    const [px, py, pz] = registration.position;
    return (
        <WireBox
            min={[px - ctW / 2, py - ctH / 2, pz - ctD / 2]}
            max={[px + ctW / 2, py + ctH / 2, pz + ctD / 2]}
            color="#ff00ff"
            opacity={0.9}
        />
    );
};

// ── Main Debug Overlay ─────────────────────────────────────────────────────────

export const AnatomyDebugOverlay: React.FC = () => {
    const [debugEnabled, setDebugEnabled] = useState(AnatomyDebugState.enabled);
    const { torsoBounds, registration, anatomyMetadata } = useAppStore();

    // Listen for Ctrl+Shift+D toggle events
    useEffect(() => {
        const handler = (e: CustomEvent) => {
            setDebugEnabled(e.detail.enabled as boolean);
        };
        window.addEventListener('anatomy-debug-toggle', handler as EventListener);
        return () => window.removeEventListener('anatomy-debug-toggle', handler as EventListener);
    }, []);

    if (!debugEnabled || !torsoBounds) return null;

    // Compute cavity
    const cavity = computeAnatomicalCavity(torsoBounds);

    // Approximate torso scale for landmarks (14 units / ~2 geometry width)
    const torsoScale = 7.0;

    return (
        <group name="anatomy-debug-overlay">
            {/* 1. Torso bounding box [CYAN] */}
            {AnatomyDebugState.showTorsoBox && (
                <WireBox
                    min={torsoBounds.min}
                    max={torsoBounds.max}
                    color="#00ffff"
                    opacity={0.6}
                />
            )}

            {/* 2. Internal cavity region [YELLOW] */}
            {AnatomyDebugState.showCavityBox && (
                <WireBox
                    min={cavity.min}
                    max={cavity.max}
                    color="#ffff00"
                    opacity={0.7}
                />
            )}

            {/* 3. CT volume box after embedding [MAGENTA] */}
            {AnatomyDebugState.showCTBox && (
                <CTVolumeDebugBox
                    registration={registration}
                    anatomy={anatomyMetadata}
                />
            )}

            {/* 4. Anatomical landmark spheres */}
            {AnatomyDebugState.showLandmarks && (
                <group name="landmarks">
                    <LandmarkSphere
                        position={[
                            AnatomicalLandmarkRegistry.rightKidney.x,
                            AnatomicalLandmarkRegistry.rightKidney.y,
                            AnatomicalLandmarkRegistry.rightKidney.z,
                        ]}
                        color="#ff4500"
                        label="Right Kidney"
                        torsoScale={torsoScale}
                    />
                    <LandmarkSphere
                        position={[
                            AnatomicalLandmarkRegistry.leftKidney.x,
                            AnatomicalLandmarkRegistry.leftKidney.y,
                            AnatomicalLandmarkRegistry.leftKidney.z,
                        ]}
                        color="#4169e1"
                        label="Left Kidney"
                        torsoScale={torsoScale}
                    />
                    <LandmarkSphere
                        position={[
                            AnatomicalLandmarkRegistry.liver.x,
                            AnatomicalLandmarkRegistry.liver.y,
                            AnatomicalLandmarkRegistry.liver.z,
                        ]}
                        color="#ff8c00"
                        label="Liver"
                        torsoScale={torsoScale}
                    />
                    <LandmarkSphere
                        position={[
                            AnatomicalLandmarkRegistry.spine.x,
                            AnatomicalLandmarkRegistry.spine.y,
                            AnatomicalLandmarkRegistry.spine.z,
                        ]}
                        color="#9932cc"
                        label="Spine"
                        torsoScale={torsoScale}
                    />
                </group>
            )}

            {/* 5. Axis arrows at origin */}
            {AnatomyDebugState.showAxes && (
                <AxisArrows length={3.0} />
            )}

            {/* 6. Debug info panel (shown as a floating 3D label via canvas position) */}
            <group name="debug-info" position={[torsoBounds.min[0], torsoBounds.max[1] + 1.5, 0]}>
                {/* Thin lines indicating cavity center */}
                <mesh position={[cavity.center[0], cavity.center[1], cavity.center[2]]}>
                    <sphereGeometry args={[0.1, 8, 8]} />
                    <meshBasicMaterial color="#ffffff" />
                </mesh>
            </group>
        </group>
    );
};
