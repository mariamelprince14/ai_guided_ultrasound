/**
 * Volume35TorsoMesh.tsx
 * ─────────────────────
 * VOLUME 35 ONLY — Anatomically accurate torso for kidney ultrasound training.
 *
 * Design:
 *  - Procedural ring-based mesh with realistic adult male proportions
 *  - Always opaque skin material (realism preserved)
 *  - Mesh named "torso-model" for DragController raycasting
 *  - Invisible anatomical zone markers for probe guidance
 *  - Subcostal + intercostal + flank scanning zones correctly positioned
 */

import React, { useMemo, useRef, useEffect } from 'react';
import { useAppStore } from '@store/useAppStore';
import * as THREE from 'three';
import { VOLUME35_MM_TO_SCENE } from '@/utils/AnatomicalEmbedding';

// ─── Geometry Generation ──────────────────────────────────────────────────────

/**
 * Generates a high-fidelity anatomical male torso geometry.
 * Proportions based on standard clinical phantom dimensions:
 *   Shoulder width:  ~450 mm → normalized 1.0
 *   Waist width:     ~320 mm → normalized 0.71
 *   Hip width:       ~380 mm → normalized 0.84
 *   AP chest depth:  ~200 mm → normalized 0.44
 *   AP abdomen:      ~180 mm → normalized 0.40
 */
function generateMedicalTorsoGeometry(): THREE.BufferGeometry {
    const geometry = new THREE.BufferGeometry();

    const RINGS = 72; // vertices per ring — smoother silhouette

    // Level definitions: [y, halfWidth, halfDepth, frontOffset, backGroove]
    // y      — vertical position (head=2.0, pelvis=-0.85)
    // hw     — half-width (x-axis)
    // hd     — half-depth (z-axis, front-to-back)
    // front  — belly/pec protrusion bias on the front face
    // groove — spinal groove depth on back face
    const levels: Array<[number, number, number, number, number]> = [
        // y,     hw,    hd,    front,  groove
        // ── Neck transition
        [2.00, 0.30, 0.28, 0.00, 0.00],
        [1.85, 0.52, 0.36, 0.02, 0.01],
        // ── Shoulder mass
        [1.68, 0.88, 0.40, 0.03, 0.02],
        [1.52, 1.00, 0.44, 0.05, 0.02],
        // ── Upper chest / pectorals
        [1.36, 0.98, 0.48, 0.07, 0.03],
        [1.20, 0.95, 0.50, 0.08, 0.03],
        [1.04, 0.92, 0.49, 0.07, 0.03],
        // ── Costal margin (rib cage base)
        [0.88, 0.88, 0.47, 0.06, 0.03],
        [0.72, 0.84, 0.45, 0.05, 0.03],
        // ── Epigastrium
        [0.56, 0.78, 0.42, 0.04, 0.02],
        [0.40, 0.74, 0.40, 0.04, 0.02],
        // ── Kidney / flank zone (L1–L3): slight lateral fullness for scanning access
        [0.24, 0.76, 0.41, 0.04, 0.02],
        [0.08, 0.77, 0.41, 0.04, 0.02],
        [-0.08, 0.76, 0.40, 0.04, 0.02],
        // ── Lower abdomen
        [-0.24, 0.75, 0.39, 0.04, 0.02],
        [-0.40, 0.77, 0.40, 0.05, 0.02],
        // ── Pelvic brim
        [-0.56, 0.80, 0.42, 0.04, 0.02],
        [-0.70, 0.82, 0.44, 0.03, 0.01],
        [-0.85, 0.78, 0.42, 0.02, 0.01],
    ];

    const torsoRings: number[][] = [];

    for (const [y, hw, hd, frontBias, grooveDepth] of levels) {
        const ring: number[] = [];
        const step = (Math.PI * 2) / RINGS;

        for (let i = 0; i < RINGS; i++) {
            const angle = step * i;
            const cos = Math.cos(angle); // x direction (±width)
            const sin = Math.sin(angle); // z direction (front/back)

            let rx = hw;
            let rz = hd;

            // Front face: chest/belly forward protrusion
            if (sin > 0) {
                const frontCurve = frontBias * Math.exp(-Math.pow(cos * 1.5, 2));
                rz += frontCurve;
            }

            // Back face: subtle spinal groove at midline
            if (sin < 0) {
                const spineGroove = grooveDepth * Math.exp(-Math.pow(cos * 6.0, 2));
                rz -= spineGroove;
            }

            // Flank rounding: softer curves on the sides for probe contact area
            const flankBlend = Math.exp(-Math.pow(sin * 2.5, 2));
            rx += flankBlend * 0.02;

            ring.push(cos * rx, y, sin * rz);
        }

        torsoRings.push(ring);
    }

    // ── Assemble vertices + indices ───────────────────────────────────────────
    const vertices: number[] = [];
    const indices: number[] = [];

    for (const ring of torsoRings) vertices.push(...ring);

    for (let r = 0; r < torsoRings.length - 1; r++) {
        for (let i = 0; i < RINGS; i++) {
            const ni = (i + 1) % RINGS;
            const v0 = r * RINGS + i;
            const v1 = r * RINGS + ni;
            const v2 = (r + 1) * RINGS + i;
            const v3 = (r + 1) * RINGS + ni;
            indices.push(v0, v2, v1, v1, v2, v3);
        }
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(vertices), 3));
    geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(indices), 1));
    geometry.computeVertexNormals();

    return geometry;
}

function addUVs(geometry: THREE.BufferGeometry): void {
    const pos = geometry.getAttribute('position') as THREE.BufferAttribute;
    const uvs: number[] = [];
    for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const y = pos.getY(i);
        const z = pos.getZ(i);
        uvs.push((Math.atan2(z, x) / Math.PI + 1) * 0.5, (y + 1.0) / 3.0);
    }
    geometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(uvs), 2));
}

// ─── Skin Material ────────────────────────────────────────────────────────────

/**
 * Professional clinical skin material — transparency based on visualization mode.
 * Beginner: semi-transparent to show internal organs
 * Intermediate/Advanced: opaque for realistic phantom simulation
 */
function createSkinMaterial(isBeginnerMode: boolean): THREE.MeshPhysicalMaterial {
    return new THREE.MeshPhysicalMaterial({
        color: new THREE.Color('#c89470'),   // Warm anatomical skin
        roughness: 0.62,
        metalness: 0.0,
        // Subsurface scattering approximation
        thickness: 1.8,
        attenuationColor: new THREE.Color('#b06040'),
        attenuationDistance: 0.8,
        // Subtle sheen for clinical phantom surface
        sheen: 0.12,
        sheenColor: new THREE.Color('#8ba0b8'),
        sheenRoughness: 0.6,
        // Transparency for educational visualization (Beginner mode)
        transparent: isBeginnerMode,
        opacity: isBeginnerMode ? 0.45 : 1.0,
        side: THREE.FrontSide,
    });
}

// ─── Anatomical Markers ───────────────────────────────────────────────────────

/**
 * Invisible reference meshes for probe guidance & raycasting context.
 * These are NOT rendered visually but available to the overlay system.
 */
function createAnatomicalMarkers(): THREE.Group {
    const group = new THREE.Group();
    group.name = 'anatomical-markers';

    const invisible = new THREE.MeshBasicMaterial({ visible: false });

    // Right kidney subcostal/intercostal zone (patient's right = +X)
    const rk = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 16), invisible);
    rk.position.set(0.62, 0.18, 0.05);
    rk.name = 'right-kidney-zone';
    group.add(rk);

    // Left kidney flank zone (patient's left = -X)
    const lk = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 16), invisible);
    lk.position.set(-0.62, 0.18, 0.00);
    lk.name = 'left-kidney-zone';
    group.add(lk);

    // Subcostal window (right, anterior approach)
    const sc = new THREE.Mesh(new THREE.SphereGeometry(0.18, 16, 16), invisible);
    sc.position.set(0.50, 0.70, 0.18);
    sc.name = 'subcostal-zone';
    group.add(sc);

    return group;
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Volume35TorsoMeshProps {
    // No external props needed — this component is self-contained
}

export const Volume35TorsoMesh: React.FC<Volume35TorsoMeshProps> = () => {
    const { torsoSettings, visualizationSettings, setTorsoBounds, setMmToSceneScale } = useAppStore();
    const groupRef = useRef<THREE.Group>(null);

    const isBeginnerMode = visualizationSettings.mode === 'beginner';

    const { geometry, torsoScale, bounds3d } = useMemo(() => {
        const geom = generateMedicalTorsoGeometry();
        addUVs(geom);
        geom.computeBoundingBox();

        const bbox = geom.boundingBox!;
        const size = bbox.getSize(new THREE.Vector3());

        // Target 14 scene units wide — matches VOLUME35_MM_TO_SCENE * 400mm
        const targetSceneWidth = 14;
        const tScale = targetSceneWidth / size.x;

        const finalBounds = {
            min: [bbox.min.x * tScale, bbox.min.y * tScale, bbox.min.z * tScale] as [number, number, number],
            max: [bbox.max.x * tScale, bbox.max.y * tScale, bbox.max.z * tScale] as [number, number, number],
            center: [
                (bbox.min.x + bbox.max.x) * tScale * 0.5,
                (bbox.min.y + bbox.max.y) * tScale * 0.5,
                (bbox.min.z + bbox.max.z) * tScale * 0.5,
            ] as [number, number, number],
            size: [size.x * tScale, size.y * tScale, size.z * tScale] as [number, number, number],
        };

        return { geometry: geom, torsoScale: tScale, bounds3d: finalBounds };
    }, []);

    useEffect(() => {
        if (bounds3d) {
            setTorsoBounds(bounds3d);
            // Use the anatomically motivated constant — not a per-load ratio
            setMmToSceneScale(VOLUME35_MM_TO_SCENE);
        }
    }, [bounds3d, setTorsoBounds, setMmToSceneScale]);

    const material = useMemo(() => createSkinMaterial(isBeginnerMode), [isBeginnerMode]);

    const anatomicalMarkers = useMemo(() => createAnatomicalMarkers(), []);

    if (!torsoSettings || !visualizationSettings.showTorso) return null;

    return (
        <group ref={groupRef} name="volume35-torso">
            {/* PRIMARY TORSO MESH — anterior surface now faces camera, named "torso-model" for DragController raycasting */}
            <mesh
                name="torso-model"
                geometry={geometry}
                material={material}
                scale={[torsoScale, torsoScale, torsoScale]}
                castShadow
                receiveShadow
            />

            {/* Anatomical reference markers (invisible, raycasting only) */}
            <primitive
                object={anatomicalMarkers}
                scale={[torsoScale, torsoScale, torsoScale]}
            />

            {/* Invisible low-poly collider for smooth probe raycasting */}
            <mesh
                name="torso-collider"
                scale={[torsoScale, torsoScale, torsoScale]}
                visible={false}
            >
                <sphereGeometry args={[0.65, 24, 16, 0, Math.PI * 2, 0, Math.PI]} />
                <meshBasicMaterial visible={false} />
            </mesh>
        </group>
    );
};
