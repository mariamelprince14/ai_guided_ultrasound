/**
 * AnatomicalEmbedding.ts
 * ──────────────────────
 * VOLUME 35 — Anatomical Coordinate Embedding System
 *
 * Provides mathematically correct alignment of a NIfTI CT volume
 * inside the procedural torso mesh. All transforms are derived from
 * the REAL NIfTI affine matrix — no orientation assumptions.
 *
 * Architecture:
 *   1. AnatomicalTransformManager  — derives transforms from NIfTI affine
 *   2. VolumeEmbeddingSystem       — computes cavity fit and registration
 *   3. AnatomicalLandmarkRegistry  — known organ positions in torso space
 *   4. DebugState                  — runtime-togglable debug overlay state
 *
 * ── Coordinate Systems ───────────────────────────────────────────────────────
 *
 *  NIFTI WORLD SPACE (mm):
 *    Defined by the NIfTI affine. For test35, convention is LPS:
 *    +X = Left, +Y = Posterior, +Z = Superior
 *    World bounds: X[-170,180] Y[-333,17] Z[-291,-39]
 *    World center: [5, -158, -165] mm (scanner isocenter)
 *
 *  TORSO LOCAL SPACE (TLS, scene units):
 *    The space inside the "anatomical-subject" group AFTER its rotation.
 *    The group has rotation={[-π/2, 0, 0]} applied in Three.js.
 *    Inside TLS (post-rotation):
 *      +X = patient Right   (same as -NIfTI X for LPS)
 *      +Y = patient Superior (maps from NIfTI Z)
 *      +Z = patient Anterior (maps from -NIfTI Y for LPS)
 *    Torso mesh width ≈ 14 scene units = 400 mm real anatomy
 *    mmToScene = 14 / 400 = 0.035
 *
 *  REGISTRATION GROUP SPACE:
 *    Child of anatomical-subject. Position/scale in scene units.
 *    The CT volume box lives here, centered at (0,0,0) by default.
 *    Registration.position shifts it, registration.scale sizes it.
 */

import type { BoundingBox3D, VolumeRegistration, AnatomyMetadata } from '@/types';
import * as THREE from 'three';

// ── Constants ─────────────────────────────────────────────────────────────────

/**
 * Anatomically motivated mm→scene scale for Volume 35.
 * Based on: torso scene width (14 units) / real adult torso width (~400mm).
 * This is the SINGLE SOURCE OF TRUTH for coordinate conversion.
 */
export const VOLUME35_MM_TO_SCENE = 14.0 / 400.0; // = 0.035

/**
 * Safety shrink margins for the internal cavity region.
 * The cavity is the anatomically viable zone for organ placement —
 * NOT the outer skin surface.
 */
export const CAVITY_MARGINS = {
    xFraction: 0.08,         // shrink 8% per side left-right — narrower margin preserves organ width
    yTopFraction: 0.05,      // shrink 5% from superior end (just below shoulder-neck transition)
    yBottomFraction: 0.05,   // shrink 5% from inferior end (just above pelvis brim)
    zFraction: 0.10,         // shrink 10% per side anterior-posterior — retroperitoneal organs are deep
} as const;

/**
 * Anatomical positioning offsets applied after center alignment.
 * Kidneys and abdominal organs sit slightly inferior and posterior
 * relative to the geometric torso center.
 *
 * The right kidney sits at approximately L1-L3 (mid-abdomen).
 * The liver occupies the right upper quadrant, subphrenic.
 * Corrected values prevent the hepatic dome from dropping below the costal margin
 * and the kidney from appearing below the iliac crest.
 */
export const ANATOMICAL_OFFSETS = {
    yFraction: -0.03,   // shift 3% inferior — small nudge so mid-kidney aligns with L2
    zFraction: -0.10,   // shift 10% posterior from cavity center (retroperitoneal placement)
} as const;

/**
 * Scale reduction factor applied to the fitted scale.
 * Provides a safe margin so anatomy never clips the torso skin.
 * Raised from 0.85 → 0.92 so the CT volume fills the abdominal cavity
 * realistically instead of floating shrunken inside it.
 */
export const SCALE_SAFETY_MARGIN = 0.92;

// ── AnatomicalLandmarkRegistry ────────────────────────────────────────────────

/**
 * Known anatomical landmark positions in Torso Local Space,
 * expressed as fractions of the procedural torso geometry.
 *
 * Torso geometry levels (from Volume35TorsoMesh.tsx):
 *   y = 2.00 → top of neck
 *   y = 0.00 → approximately umbilicus / L2-L4 (kidney zone)
 *   y = -0.85 → pelvis
 *
 * Multiply fractional values by torsoScale (≈7.0) to get scene units.
 */
export const AnatomicalLandmarkRegistry = {
    /** Right kidney (patient right = +X in TLS) — retroperitoneal, L1-L3 */
    rightKidney:   { x:  0.62, y: 0.18, z: -0.15 },
    /** Left kidney (patient left = -X in TLS) — retroperitoneal, L1-L3 */
    leftKidney:    { x: -0.62, y: 0.18, z: -0.15 },
    /** Liver — right upper quadrant, subcostal */
    liver:         { x:  0.45, y: 0.55, z:  0.10 },
    /** Spleen — left upper quadrant, posterior */
    spleen:        { x: -0.50, y: 0.50, z: -0.05 },
    /** Spine (L1-L4) — posterior midline */
    spine:         { x:  0.00, y: 0.10, z: -0.30 },
    /** Aorta — midline, slightly left of spine */
    aorta:         { x: -0.05, y: 0.10, z: -0.25 },
    /** Gallbladder — right anterior, subcostal */
    gallbladder:   { x:  0.38, y: 0.45, z:  0.20 },
} as const;

export type LandmarkName = keyof typeof AnatomicalLandmarkRegistry;

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CavityRegion {
    min: [number, number, number];
    max: [number, number, number];
    center: [number, number, number];
    size: [number, number, number];
}

export interface AnatomicalTransformResult {
    registration: VolumeRegistration;
    scaleFactor: number;
    cavityRegion: CavityRegion;
    /** CT volume bounds remapped into TLS in scene units (after axis remap) */
    ctBoundsInTLS: { size: [number, number, number]; center: [number, number, number] };
    /** Validation warnings */
    warnings: string[];
}

export interface ValidationResult {
    isValid: boolean;
    volumeFitsInCavity: boolean;
    warnings: string[];
    details: {
        scaleFactor: number;
        cavitySize: [number, number, number];
        ctSizeInTLS: [number, number, number];
        offsetApplied: [number, number, number];
    };
}

// ── AnatomicalTransformManager ────────────────────────────────────────────────

/**
 * Derives axis remap information from the NIfTI affine.
 *
 * The torso anatomical-subject group applies rotation={[-π/2, 0, 0]},
 * which maps Three.js coordinates so that inside TLS:
 *   TLS +Y (up)      ← Three.js world +Z (before rotation)
 *   TLS +Z (forward) ← Three.js world -Y (before rotation)
 *
 * Combined with the NIfTI→Three.js mapping, we need to know which
 * world-mm dimensions map to which TLS dimensions.
 *
 * For LPS (test35): world X=LR, world Y=AP, world Z=SI
 *   TLS X ← NIfTI world X size (L-R range = 350mm)
 *   TLS Y ← NIfTI world Z size (S-I range = 252mm) — because anatomical-subject
 *            rotation lifts Z into Y
 *   TLS Z ← NIfTI world Y size (A-P range = 350mm)
 *
 * This function generalizes to ANY NIfTI orientation.
 */
export function computeAxisRemapFromAffine(anatomy: AnatomyMetadata): {
    /** Index into worldBounds.size[] that maps to TLS X (L-R) */
    tlsXFromWorld: number;
    /** Index into worldBounds.size[] that maps to TLS Y (Sup-Inf) */
    tlsYFromWorld: number;
    /** Index into worldBounds.size[] that maps to TLS Z (Ant-Post) */
    tlsZFromWorld: number;
    /** Sign corrections (+1 or -1) for each axis */
    signs: [number, number, number];
    description: string;
} {
    // The anatomical-subject group rotation maps world Z→TLS Y and world Y→TLS Z.
    // We need to find which NIfTI world axis carries:
    //   - Superior/Inferior → TLS Y
    //   - Anterior/Posterior → TLS Z
    //   - Left/Right → TLS X

    // Find which world axis (0=X, 1=Y, 2=Z) primarily encodes each anatomical direction
    const axisCodes = anatomy.axisCodes; // e.g. ['L','P','S']

    // Map axis code to world axis index
    // axisCodes[i] tells us what anatomical direction nibabel axis i encodes
    let lrWorldAxis = 0;   // Left-Right
    let apWorldAxis = 1;   // Anterior-Posterior
    let siWorldAxis = 2;   // Superior-Inferior

    for (let i = 0; i < 3; i++) {
        const code = axisCodes[i].toUpperCase();
        if (code === 'L' || code === 'R') lrWorldAxis = i;
        else if (code === 'A' || code === 'P') apWorldAxis = i;
        else if (code === 'S' || code === 'I') siWorldAxis = i;
    }

    // Signs: LPS convention has L=+X, P=+Y, S=+Z in NIfTI world
    // TLS convention: Right=+X, Superior=+Y, Anterior=+Z
    // So for LPS:
    //   NIfTI world X (L→+) → TLS X (R→+) needs FLIP
    //   NIfTI world Y (P→+) → TLS Z (A→+) needs FLIP
    //   NIfTI world Z (S→+) → TLS Y (S→+) no flip
    const lrSign = (axisCodes[lrWorldAxis] === 'R') ? 1 : -1;  // R positive in TLS
    const siSign = (axisCodes[siWorldAxis] === 'S') ? 1 : -1;  // S positive in TLS
    const apSign = (axisCodes[apWorldAxis] === 'A') ? 1 : -1;  // A positive in TLS

    // After anatomical-subject rotation (-π/2 on X):
    //   NIfTI world SI axis → TLS Y
    //   NIfTI world AP axis → TLS Z
    return {
        tlsXFromWorld: lrWorldAxis,
        tlsYFromWorld: siWorldAxis,
        tlsZFromWorld: apWorldAxis,
        signs: [lrSign, siSign, apSign],
        description:
            `Convention=${anatomy.convention}: ` +
            `worldAxis[${lrWorldAxis}](${axisCodes[lrWorldAxis]})→TLSX(sign=${lrSign}), ` +
            `worldAxis[${siWorldAxis}](${axisCodes[siWorldAxis]})→TLSY(sign=${siSign}), ` +
            `worldAxis[${apWorldAxis}](${axisCodes[apWorldAxis]})→TLSZ(sign=${apSign})`,
    };
}

// ── VolumeEmbeddingSystem ─────────────────────────────────────────────────────

/**
 * Compute the internal anatomical cavity region from the torso bounding box.
 * Applies configurable safety margins to stay inside the body surface.
 */
export function computeAnatomicalCavity(torsoBounds: BoundingBox3D): CavityRegion {
    const { min, max, size } = torsoBounds;

    // X: shrink left and right sides
    const xShrink = size[0] * CAVITY_MARGINS.xFraction;
    const cavMinX = min[0] + xShrink;
    const cavMaxX = max[0] - xShrink;

    // Y: shrink top (superior) and bottom (inferior) differently
    const yTopShrink    = size[1] * CAVITY_MARGINS.yTopFraction;
    const yBottomShrink = size[1] * CAVITY_MARGINS.yBottomFraction;
    const cavMinY = min[1] + yBottomShrink;
    const cavMaxY = max[1] - yTopShrink;

    // Z: shrink anterior and posterior sides
    const zShrink = size[2] * CAVITY_MARGINS.zFraction;
    const cavMinZ = min[2] + zShrink;
    const cavMaxZ = max[2] - zShrink;

    const cavW = cavMaxX - cavMinX;
    const cavH = cavMaxY - cavMinY;
    const cavD = cavMaxZ - cavMinZ;

    return {
        min: [cavMinX, cavMinY, cavMinZ],
        max: [cavMaxX, cavMaxY, cavMaxZ],
        center: [
            (cavMinX + cavMaxX) * 0.5,
            (cavMinY + cavMaxY) * 0.5,
            (cavMinZ + cavMaxZ) * 0.5,
        ],
        size: [cavW, cavH, cavD],
    };
}

/**
 * Compute the full anatomical embedding transform.
 *
 * This is the MASTER function that produces a VolumeRegistration
 * (position + scale) for placing the CT volume correctly inside the torso.
 *
 * Algorithm:
 *  1. Remap CT world-mm bounds to TLS using NIfTI affine axis codes
 *  2. Convert CT TLS dimensions to scene units using mmToScene
 *  3. Compute cavity region from torso bounds
 *  4. Compute uniform scale: min(cavW/ctW, cavH/ctH, cavD/ctD) * SAFETY_MARGIN
 *  5. Compute center alignment with anatomical offsets
 *  6. Return VolumeRegistration in scene units
 *
 * @param anatomy      NIfTI anatomy metadata from backend
 * @param torsoBounds  Torso bounding box in scene units
 * @param mmToScene    mm → scene unit conversion factor
 */
export function computeAnatomicalTransform(
    anatomy: AnatomyMetadata,
    torsoBounds: BoundingBox3D,
    mmToScene: number,
): AnatomicalTransformResult {
    const warnings: string[] = [];

    // 1. Compute axis remap from real affine
    const axisRemap = computeAxisRemapFromAffine(anatomy);
    console.info(`[AnatomicalEmbedding] ${axisRemap.description}`);

    // 2. Get CT world-space dimensions in mm (absolute sizes, always positive)
    const worldSize = anatomy.worldBounds.size;
    const worldCenter = anatomy.worldBounds.center;

    // Remap world dimensions to TLS axes
    // tlsXFromWorld, tlsYFromWorld, tlsZFromWorld are indices into worldSize[]
    const ctWidthMm  = worldSize[axisRemap.tlsXFromWorld];  // TLS X (L-R)
    const ctHeightMm = worldSize[axisRemap.tlsYFromWorld];  // TLS Y (S-I)
    const ctDepthMm  = worldSize[axisRemap.tlsZFromWorld];  // TLS Z (A-P)

    // 3. Convert CT TLS dimensions to scene units
    const ctWidthScene  = ctWidthMm  * mmToScene;
    const ctHeightScene = ctHeightMm * mmToScene;
    const ctDepthScene  = ctDepthMm  * mmToScene;

    // 4. Compute cavity region (used for position anchor only, NOT for primary scale fitting)
    const cavity = computeAnatomicalCavity(torsoBounds);
    const [cavW, cavH, cavD] = cavity.size;

    // 5. Compute uniform scale factor.
    //
    // STRATEGY: Fit the CT volume to the FULL torso bounding box using ALL THREE axes
    // as constraints. Previously, only X (L-R) and Y (S-I) were used, which allowed
    // the CT's Z (A-P) dimension to silently overflow the torso depth — making the
    // volume appear to float/clip outside the body in the anterior-posterior direction.
    //
    // The CT scanner FOV (≈350mm circle) is WIDER than the actual body depth (≈200mm),
    // so the AP extent of a raw CT is almost always larger than the torso mesh depth.
    // Adding the Z constraint ensures the CT box always sits INSIDE the torso shell.
    const torsoWidth  = torsoBounds.size[0];  // full L-R torso extent
    const torsoHeight = torsoBounds.size[1];  // full S-I torso extent
    const torsoDepth  = torsoBounds.size[2];  // full A-P torso extent ← CRITICAL

    const rawScale = Math.min(
        torsoWidth  / ctWidthScene,   // L-R fit
        torsoHeight / ctHeightScene,  // S-I fit
        torsoDepth  / ctDepthScene    // A-P fit ← prevents Z overflow outside torso
    );
    const scaleFactor = rawScale * SCALE_SAFETY_MARGIN;

    // Warn if scale is very different from expected range
    if (scaleFactor < 0.2 || scaleFactor > 2.0) {
        warnings.push(
            `Scale factor ${scaleFactor.toFixed(3)} is unusual. ` +
            `CT TLS dims: ${ctWidthScene.toFixed(1)} × ${ctHeightScene.toFixed(1)} × ${ctDepthScene.toFixed(1)} scene units. ` +
            `Torso: ${torsoWidth.toFixed(1)} × ${torsoHeight.toFixed(1)} × ${torsoDepth.toFixed(1)} scene units. ` +
            `Cavity: ${cavW.toFixed(1)} × ${cavH.toFixed(1)} × ${cavD.toFixed(1)} scene units.`
        );
    }

    // 6. Compute anatomically correct position.
    //
    // X (Left-Right): Center the CT volume in the torso (mid-sagittal plane).
    const posX = cavity.center[0];  // cavity is symmetric about X, so this is ≈ 0

    // Y (Superior-Inferior): Center in the cavity then apply a small inferior shift.
    // The abdominal organs sit in the mid-to-lower half of the torso.
    // Shift is relative to the cavity height so the liver dome is at the costal margin.
    const posY = cavity.center[1] + cavity.size[1] * ANATOMICAL_OFFSETS.yFraction;

    // Z (Anterior-Posterior): Center the CT volume in the cavity's Z midpoint.
    // Retroperitoneal organs (kidneys) sit slightly posterior to the abdominal
    // midline. A −10% cavity-depth offset places them correctly behind the midline.
    // NOTE: cavity.center[2] ≈ 0 (the torso is symmetric front-to-back).
    // Negative = posterior (the back of the torso in TLS +Z = anterior).
    const posZ = cavity.center[2] + cavity.size[2] * ANATOMICAL_OFFSETS.zFraction;

    console.info(
        `[AnatomicalEmbedding] CT scene dims (unscaled): ${ctWidthScene.toFixed(2)} × ${ctHeightScene.toFixed(2)} × ${ctDepthScene.toFixed(2)}`,
        `| scaleFactor: ${scaleFactor.toFixed(4)}`,
        `| pos: [${posX.toFixed(2)}, ${posY.toFixed(2)}, ${posZ.toFixed(2)}]`,
    );

    // The registration position is in scene units (direct Three.js offset)
    // Rotation is always [0,0,0] — orientation is handled by the NIfTI affine
    // and the anatomical-subject group's rotation={[-π/2, 0, 0]}.
    const registration: VolumeRegistration = {
        position: [posX, posY, posZ],
        rotation: [0, 0, 0],
        scale: parseFloat(scaleFactor.toFixed(4)),
    };

    const ctBoundsInTLS = {
        size: [ctWidthScene, ctHeightScene, ctDepthScene] as [number, number, number],
        center: [
            worldCenter[axisRemap.tlsXFromWorld] * mmToScene * axisRemap.signs[0],
            worldCenter[axisRemap.tlsYFromWorld] * mmToScene * axisRemap.signs[1],
            worldCenter[axisRemap.tlsZFromWorld] * mmToScene * axisRemap.signs[2],
        ] as [number, number, number],
    };

    if (warnings.length > 0) {
        warnings.forEach(w => console.warn(`[AnatomicalEmbedding] WARNING: ${w}`));
    }

    return { registration, scaleFactor, cavityRegion: cavity, ctBoundsInTLS, warnings };
}

/**
 * Validate that the computed registration places the volume correctly.
 * Checks that the scaled CT volume fits within the cavity region.
 */
export function validateAnatomicalPlacement(
    registration: VolumeRegistration,
    torsoBounds: BoundingBox3D,
    anatomy: AnatomyMetadata,
    mmToScene: number,
): ValidationResult {
    const axisRemap = computeAxisRemapFromAffine(anatomy);
    const worldSize = anatomy.worldBounds.size;

    const ctW = worldSize[axisRemap.tlsXFromWorld] * mmToScene * registration.scale;
    const ctH = worldSize[axisRemap.tlsYFromWorld] * mmToScene * registration.scale;
    const ctD = worldSize[axisRemap.tlsZFromWorld] * mmToScene * registration.scale;

    const cavity = computeAnatomicalCavity(torsoBounds);
    const [pos0, pos1, pos2] = registration.position;
    const warnings: string[] = [];

    // Check if scaled CT box fits inside torso bounds
    const halfW = ctW * 0.5, halfH = ctH * 0.5, halfD = ctD * 0.5;
    const ctMinX = pos0 - halfW, ctMaxX = pos0 + halfW;
    const ctMinY = pos1 - halfH, ctMaxY = pos1 + halfH;
    const ctMinZ = pos2 - halfD, ctMaxZ = pos2 + halfD;

    const fitsX = ctMinX >= torsoBounds.min[0] && ctMaxX <= torsoBounds.max[0];
    const fitsY = ctMinY >= torsoBounds.min[1] && ctMaxY <= torsoBounds.max[1];
    const fitsZ = ctMinZ >= torsoBounds.min[2] && ctMaxZ <= torsoBounds.max[2];
    const volumeFitsInCavity = fitsX && fitsY && fitsZ;

    if (!fitsX) warnings.push(`CT volume clips torso in X axis (L-R). Scale: ${registration.scale.toFixed(3)}`);
    if (!fitsY) warnings.push(`CT volume clips torso in Y axis (S-I). Scale: ${registration.scale.toFixed(3)}`);
    if (!fitsZ) warnings.push(`CT volume clips torso in Z axis (A-P). Scale: ${registration.scale.toFixed(3)}`);

    return {
        isValid: volumeFitsInCavity && warnings.length === 0,
        volumeFitsInCavity,
        warnings,
        details: {
            scaleFactor: registration.scale,
            cavitySize: cavity.size,
            ctSizeInTLS: [ctW, ctH, ctD],
            offsetApplied: registration.position,
        },
    };
}

// ── Debug State ───────────────────────────────────────────────────────────────

/**
 * Runtime-togglable debug state.
 * Zero overhead when disabled — all debug renders check this flag first.
 * Stored outside React state to avoid re-render cost.
 */
export const AnatomyDebugState = {
    enabled: false,
    showTorsoBox: true,
    showCavityBox: true,
    showCTBox: true,
    showLandmarks: true,
    showAxes: true,
    showSlicePlanes: false,

    toggle() {
        this.enabled = !this.enabled;
        console.info(`[AnatomyDebug] ${this.enabled ? 'ENABLED' : 'DISABLED'}`);
        return this.enabled;
    },

    enable()  { this.enabled = true; },
    disable() { this.enabled = false; },
};

// Register global hotkey (Ctrl+Shift+D) for toggling debug mode
if (typeof window !== 'undefined') {
    window.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.shiftKey && e.key === 'D') {
            e.preventDefault();
            const state = AnatomyDebugState.toggle();
            // Dispatch custom event so React components can re-render
            window.dispatchEvent(new CustomEvent('anatomy-debug-toggle', { detail: { enabled: state } }));
        }
    });
}

/**
 * Convert a point from anatomical-subject space (scene units) to NIfTI world millimeter coordinates
 */
export function subjectToNifti(
    pointSubject: THREE.Vector3 | { x: number; y: number; z: number },
    registration: VolumeRegistration,
    scale: number,
    bounds: { center: [number, number, number] },
    anatomy: AnatomyMetadata
): THREE.Vector3 {
    const axisRemap = computeAxisRemapFromAffine(anatomy);
    const signs = axisRemap.signs;
    
    // 1. Convert to local CT space (mm from volume center)
    const factor = registration.scale * scale;
    const xt = (pointSubject.x - registration.position[0]) / factor;
    const yt = (pointSubject.y - registration.position[1]) / factor;
    const zt = (pointSubject.z - registration.position[2]) / factor;
    
    // 2. Remap to NIfTI axes and apply signs
    const xn_offset = xt * signs[0];
    const yn_offset = zt * signs[2]; // local Z is AP, which is NIfTI Y
    const zn_offset = yt * signs[1]; // local Y is SI, which is NIfTI Z
    
    // 3. Add NIfTI center
    return new THREE.Vector3(
        xn_offset + bounds.center[0],
        yn_offset + bounds.center[1],
        zn_offset + bounds.center[2]
    );
}

/**
 * Convert a point from NIfTI world millimeter coordinates to anatomical-subject space (scene units)
 */
export function niftiToSubject(
    pointNifti: { x: number; y: number; z: number },
    registration: VolumeRegistration,
    scale: number,
    bounds: { center: [number, number, number] },
    anatomy: AnatomyMetadata
): THREE.Vector3 {
    const axisRemap = computeAxisRemapFromAffine(anatomy);
    const signs = axisRemap.signs;
    
    // 1. Subtract NIfTI center
    const xn_offset = pointNifti.x - bounds.center[0];
    const yn_offset = pointNifti.y - bounds.center[1];
    const zn_offset = pointNifti.z - bounds.center[2];
    
    // 2. Convert to TLS millimeters (apply signs and swap axes)
    const xt = xn_offset * signs[0];
    const yt = zn_offset * signs[1]; // NIfTI Z is SI, which is local Y
    const zt = yn_offset * signs[2]; // NIfTI Y is AP, which is local Z
    
    // 3. Scale and shift to scene units
    const factor = registration.scale * scale;
    return new THREE.Vector3(
        xt * factor + registration.position[0],
        yt * factor + registration.position[1],
        zt * factor + registration.position[2]
    );
}
