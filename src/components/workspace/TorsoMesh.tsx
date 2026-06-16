/**
 * TorsoMesh.tsx
 * ─────────────
 * Loads a human torso GLB model and fits it around the CT volume.
 *
 * Architecture:
 *  - The torso is FIXED in world space, centered on the CT volume center.
 *  - The CT volume group is transformed via registration controls.
 *  - The raw scene ref is kept for future raycasting / probe snapping.
 *
 * Fitting strategy:
 *  1. Compute the torso's bounding box from the GLB geometry.
 *  2. Compute the CT volume's bounding box in scene space.
 *  3. Uniformly scale the torso so its largest dimension matches the CT's
 *     largest dimension (with slight padding).
 *  4. Translate the torso so its center aligns with the CT center.
 */
import React, { useMemo, useRef, useEffect } from 'react';
import { useGLTF } from '@react-three/drei';
import { useAppStore } from '@store/useAppStore';
import * as THREE from 'three';

export const TorsoMesh: React.FC = () => {
    const gltf = useGLTF('/torso.glb');
    const { torsoSettings, visualizationSettings } = useAppStore();
    const setTorsoBounds = useAppStore(state => state.setTorsoBounds);
    const groupRef = useRef<THREE.Group>(null);
    const clonedScene = useMemo(() => gltf.scene.clone(true), [gltf.scene]);

    // Compute the torso's world-space bounding box from the loaded GLB
    const torsoBB = useMemo(() => {
        clonedScene.updateMatrixWorld(true);
        return new THREE.Box3().setFromObject(clonedScene);
    }, [clonedScene]);

    // Compute the transform that makes the torso a fixed entity
    const { torsoPosition, torsoScale, bounds3d } = useMemo(() => {
        if (torsoBB.isEmpty()) {
            return { torsoPosition: [0, 0, 0] as [number, number, number], torsoScale: 1, bounds3d: null };
        }

        // Torso center and size in GLB-space (after internal transforms)
        const tCenter = new THREE.Vector3();
        torsoBB.getCenter(tCenter);
        const tSize = new THREE.Vector3();
        torsoBB.getSize(tSize);
        const torsoMaxDim = Math.max(tSize.x, tSize.y, tSize.z);

        // Uniform fixed scale so the torso is nominally ~16 units (dominant focus)
        const s = 16 / torsoMaxDim;

        // Position: place scaled torso center perfectly at world origin [0,0,0]
        const pos: [number, number, number] = [
            -tCenter.x * s,
            -tCenter.y * s,
            -tCenter.z * s,
        ];

        const finalBB = {
            min: [-tSize.x * s / 2, -tSize.y * s / 2, -tSize.z * s / 2] as [number, number, number],
            max: [tSize.x * s / 2, tSize.y * s / 2, tSize.z * s / 2] as [number, number, number],
            center: [0, 0, 0] as [number, number, number],
            size: [tSize.x * s, tSize.y * s, tSize.z * s] as [number, number, number],
        };

        return { torsoPosition: pos, torsoScale: s, bounds3d: finalBB };
    }, [torsoBB]);

    const setMmToSceneScale = useAppStore(state => state.setMmToSceneScale);

    // Push bounding box to the store for alignment operations
    useEffect(() => {
        if (bounds3d) {
            setTorsoBounds(bounds3d);
            setMmToSceneScale(torsoScale);
        }
    }, [bounds3d, torsoScale, setTorsoBounds, setMmToSceneScale]);

    // Apply material overrides and shadows whenever settings change
    useEffect(() => {
        if (!clonedScene || !torsoSettings) return;
        clonedScene.traverse((child: any) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
                child.material = new THREE.MeshPhysicalMaterial({
                    color: '#e8b4a0',
                    transparent: true,
                    opacity: visualizationSettings.torsoOpacity,
                    wireframe: torsoSettings.wireframe,
                    depthWrite: visualizationSettings.torsoOpacity > 0.9,
                    side: THREE.FrontSide,
                    roughness: 0.7,
                    metalness: 0.1,
                    clearcoat: 0.2,
                });
            }
        });
    }, [clonedScene, visualizationSettings.torsoOpacity, torsoSettings.wireframe]);

    if (!torsoSettings || !visualizationSettings.showTorso) return null;

    return (
        <group>
            <group
                ref={groupRef}
                position={torsoPosition}
                scale={[torsoScale, torsoScale, torsoScale]}
            >
                <primitive object={clonedScene} name="torso-model" />
            </group>
        </group>
    );
};

// Preload the model so it is cached
try { useGLTF.preload('/torso.glb'); } catch { /* ignore if file missing */ }
