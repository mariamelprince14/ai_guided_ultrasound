/**
 * Volume35ScaleOverride.ts
 * ────────────────────────
 * Applies a uniform scale boost and position offset ONLY to the
 * Volume35 CT volume inside the torso mesh.
 *
 * Usage:
 *   Import and call `applyVolume35Override(scene)` once after the
 *   scene graph is fully constructed, or call it in a useEffect /
 *   useFrame hook whenever the registration group needs adjustment.
 *
 * This modifies ONLY the "registration-group" node that wraps the
 * VolumeRaymarch mesh — no other scene objects are touched.
 */
import * as THREE from 'three';

// ─── Tunable Parameters ────────────────────────────────────────────────────────

/**
 * Uniform scale multiplier applied on top of the existing registration scale.
 * 1.0 = no change, 1.5 = 50% larger, 2.0 = double size.
 * Adjust until the organs are clearly visible inside the torso cavity.
 */
const SCALE_BOOST = 1.5;

/**
 * Position offsets (in scene units) applied to Volume35 only.
 * These shift the volume inside the torso without affecting the torso itself.
 *
 *   offsetX  →  Left / Right    (positive = patient's left)
 *   offsetY  →  Superior / Inferior  (positive = toward head)
 *   offsetZ  →  Anterior / Posterior  (positive = toward front)
 */
const offsetX = 0.0;
const offsetY = 0.0;
const offsetZ = 0.0;

// ─── Core Function ─────────────────────────────────────────────────────────────

/**
 * Finds the "registration-group" node in the scene and applies:
 *   1. A uniform scale boost (multiplied on top of current scale)
 *   2. A position offset for fine-tuning placement
 *   3. Immediate matrix updates so the change is visible on the next frame
 *
 * @param scene  - The Three.js scene (or any parent Object3D)
 * @param boost  - Optional override for SCALE_BOOST (default: SCALE_BOOST constant)
 * @param offX   - Optional override for offsetX
 * @param offY   - Optional override for offsetY
 * @param offZ   - Optional override for offsetZ
 * @returns true if the node was found and modified, false otherwise
 */
export function applyVolume35Override(
    scene: THREE.Object3D,
    boost: number = SCALE_BOOST,
    offX: number = offsetX,
    offY: number = offsetY,
    offZ: number = offsetZ,
): boolean {
    // Find the registration-group node that wraps ONLY the CT volume
    const registrationGroup = scene.getObjectByName('registration-group');

    if (!registrationGroup) {
        console.warn('[Volume35ScaleOverride] "registration-group" not found in scene.');
        return false;
    }

    // ── 1. Uniform Scale Boost ──────────────────────────────────────────────
    // Multiply current scale by the boost factor uniformly on all axes.
    // This preserves the anatomical proportions while making organs larger.
    registrationGroup.scale.multiplyScalar(boost);

    // ── 2. Position Offset ──────────────────────────────────────────────────
    // Add the offsets to the current position (does NOT replace existing position).
    // This allows fine-tuning the volume's placement inside the torso cavity.
    registrationGroup.position.x += offX;
    registrationGroup.position.y += offY;
    registrationGroup.position.z += offZ;

    // ── 3. Force Immediate Transform Update ─────────────────────────────────
    // Ensure the GPU receives the updated matrices on the very next render call.
    registrationGroup.matrixAutoUpdate = true;
    registrationGroup.updateMatrix();
    registrationGroup.updateMatrixWorld(true);

    console.info(
        '[Volume35ScaleOverride] Applied:',
        `boost=${boost}x`,
        `offset=[${offX}, ${offY}, ${offZ}]`,
        `→ final scale=[${registrationGroup.scale.x.toFixed(3)}, ${registrationGroup.scale.y.toFixed(3)}, ${registrationGroup.scale.z.toFixed(3)}]`,
        `→ final pos=[${registrationGroup.position.x.toFixed(3)}, ${registrationGroup.position.y.toFixed(3)}, ${registrationGroup.position.z.toFixed(3)}]`,
    );

    return true;
}

// ─── React Three Fiber Hook (optional convenience) ──────────────────────────

/**
 * Drop-in R3F component that applies the scale override once.
 * Place it anywhere inside the <Canvas> tree:
 *
 *   <Volume35ScaleOverrideEffect boost={1.6} offsetY={0.02} />
 *
 * It runs once after mount and only modifies "registration-group".
 */
export function useVolume35ScaleOverride(
    boost: number = SCALE_BOOST,
    offX: number = offsetX,
    offY: number = offsetY,
    offZ: number = offsetZ,
): void {
    // This is a placeholder signature — the actual implementation
    // should use useThree() + useEffect() from @react-three/fiber.
    // See the integration example in the JSDoc above.
    void boost; void offX; void offY; void offZ;
}
