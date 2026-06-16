/**
 * ProbeRaycasting.ts
 * ──────────────────
 * Utilities for realistic probe surface snapping and raycast-based interaction.
 * Implements:
 *   - Surface snapping (prevents probe penetration)
 *   - Surface normal alignment (probe perpendicular to skin)
 *   - Smooth damped motion (eliminates jitter)
 */

import * as THREE from 'three';

/**
 * Raycasting result with enhanced metadata
 */
export interface ProbeRaycastHit {
    point: THREE.Vector3;           // World-space intersection point
    normal: THREE.Vector3;          // Surface normal in world space
    localPoint: THREE.Vector3;      // Local to registration group
    distance: number;               // Distance from camera to hit
    isValidHit: boolean;            // Passes all constraint checks
    constraintReason?: string;      // Why hit was rejected (if invalid)
}

/**
 * Configuration for probe-torso interaction constraints
 */
export interface ProbeConstraints {
    /** Only allow hits on anterior (belly) surface */
    anteriorOnly: boolean;
    /** Vertical zone (torso local Y): [min, max] for abdominal cavity */
    verticalBounds: [number, number];
    /** Maximum penetration depth (mm) — used for soft constraint */
    maxPenetrationDepth: number;
    /** Minimum normal dot product for "front-facing" surface */
    minNormalDot: number;
}

/**
 * Default constraints for ultrasound probe placement
 */
export const DEFAULT_PROBE_CONSTRAINTS: ProbeConstraints = {
    anteriorOnly: false,              // Allow all torso surfaces (anterior, posterior, lateral)
    verticalBounds: [-3, 3],          // Full torso height coverage
    maxPenetrationDepth: 5,           // mm
    minNormalDot: -0.8,               // Allow all surface normals except pointing directly inward
};

/**
 * Perform raycast from screen coordinates and find torso surface intersection.
 * Returns detailed hit information with constraints applied.
 *
 * @param screenPos - Normalized screen coordinates ([-1, 1])
 * @param camera - THREE.js camera
 * @param raycaster - THREE.js raycaster (reused for performance)
 * @param torsoMesh - Torso mesh object
 * @param constraints - Interaction constraints
 * @returns ProbeRaycastHit with validation info, or null if no valid hit
 */
export function raycastProbeHit(
    screenPos: THREE.Vector2,
    camera: THREE.Camera,
    raycaster: THREE.Raycaster,
    torsoMesh: THREE.Object3D,
    constraints: ProbeConstraints = DEFAULT_PROBE_CONSTRAINTS
): ProbeRaycastHit | null {
    raycaster.setFromCamera(screenPos, camera);
    const hits = raycaster.intersectObject(torsoMesh, true);

    if (hits.length === 0) return null;

    // Process hits in order until we find a valid one
    for (const hit of hits) {
        const validation = validateTorsoHit(hit, torsoMesh, constraints);
        
        if (validation.isValid) {
            const localPoint = hit.point.clone();
            
            // Calculate world-space surface normal
            const worldNormal = calculateWorldNormal(hit, torsoMesh);

            return {
                point: hit.point,
                normal: worldNormal,
                localPoint,
                distance: hit.distance,
                isValidHit: true,
            };
        }
    }

    return null;
}

/**
 * Validate a raycast hit against probe placement constraints.
 * Checks: anterior surface, abdominal height, front-facing normal.
 */
function validateTorsoHit(
    hit: THREE.Intersection,
    _torsoMesh: THREE.Object3D,
    constraints: ProbeConstraints
): { isValid: boolean; reason?: string } {
    if (!hit.face) {
        return { isValid: false, reason: 'No face data' };
    }

    // Get face normal in local mesh space
    const meshLocalNorm = hit.face.normal.clone();

    // Check anterior surface (local Z > minNormalDot for mesh)
    if (constraints.anteriorOnly && meshLocalNorm.z < constraints.minNormalDot) {
        return { isValid: false, reason: 'Not anterior surface' };
    }

    // Check vertical height (abdominal zone)
    const localHit = hit.object.worldToLocal(hit.point.clone());
    const [yMin, yMax] = constraints.verticalBounds;
    if (localHit.y < yMin || localHit.y > yMax) {
        return { isValid: false, reason: `Outside vertical bounds [${yMin}, ${yMax}]` };
    }

    return { isValid: true };
}

/**
 * Calculate world-space surface normal from raycast hit.
 * Properly transforms mesh-local normal through object's transform matrix.
 */
function calculateWorldNormal(hit: THREE.Intersection, _torsoMesh: THREE.Object3D): THREE.Vector3 {
    if (!hit.face) {
        return new THREE.Vector3(0, 1, 0); // Fallback
    }

    // Get mesh-local normal
    const localNorm = hit.face.normal.clone();

    // Transform through object's matrix and camera view
    const worldNorm = localNorm.applyMatrix3(
        new THREE.Matrix3().getNormalMatrix(hit.object.matrixWorld)
    );

    // Normalize to unit vector
    return worldNorm.normalize();
}

/**
 * Smoothly interpolate probe position and normal using exponential damping.
 * Creates smooth, predictable motion without lag or overshoot.
 *
 * @param current - Current position/normal
 * @param target - Target position/normal
 * @param dampingFactor - Interpolation alpha [0, 1] — higher = faster response
 * @returns Interpolated value
 */
export function dampedLerp(
    current: { x: number; y: number; z: number },
    target: { x: number; y: number; z: number },
    dampingFactor: number
): { x: number; y: number; z: number } {
    return {
        x: current.x + (target.x - current.x) * dampingFactor,
        y: current.y + (target.y - current.y) * dampingFactor,
        z: current.z + (target.z - current.z) * dampingFactor,
    };
}

/**
 * Clamp probe position to volume bounds (safety constraint).
 * Prevents probe from flying off into infinity if user drags outside expected zone.
 */
export function clampProbeToVolume(
    pos: { x: number; y: number; z: number },
    volumeBounds: { min: [number, number, number]; max: [number, number, number] }
): { x: number; y: number; z: number } {
    return {
        x: Math.max(volumeBounds.min[0], Math.min(volumeBounds.max[0], pos.x)),
        y: Math.max(volumeBounds.min[1], Math.min(volumeBounds.max[1], pos.y)),
        z: Math.max(volumeBounds.min[2], Math.min(volumeBounds.max[2], pos.z)),
    };
}

/**
 * Build rotation matrix that aligns probe longitudinal axis with surface normal.
 * This makes the probe point perpendicular to the skin surface.
 *
 * Probe convention:
 *   - +Y axis = longitudinal (transducer pointing direction)
 *   - +X axis = lateral (probe width)
 *   - +Z axis = elevation (probe thickness)
 *
 * We want probe +Y to align with surface normal.
 */
export function buildNormalAlignedRotation(
    surfaceNormal: THREE.Vector3,
    _currentRotation?: { pitch: number; yaw: number; roll: number }
): THREE.Quaternion {
    // Normalize the surface normal
    const normal = surfaceNormal.clone().normalize();

    // Start with identity quaternion
    const quat = new THREE.Quaternion();

    // Build frame where Z points along normal (probe forward)
    // Y points "up" (perpendicular to normal and generally upward)
    // X points "right" (lateral direction)
    const zAxis = normal; // Probe points along normal

    // Find an up vector (generally should be ~world up)
    const upGuess = new THREE.Vector3(0, 0, 1);
    
    // If normal is too close to vertical, use different up guess
    if (Math.abs(zAxis.dot(upGuess)) > 0.9) {
        upGuess.set(1, 0, 0);
    }

    // Cross product to get right vector
    const xAxis = upGuess.clone().cross(zAxis).normalize();

    // Cross again to get orthogonal up
    const yAxis = zAxis.clone().cross(xAxis).normalize();

    // Build matrix from orthonormal basis (X, Y, Z columns)
    const mat = new THREE.Matrix4();
    mat.set(
        xAxis.x, yAxis.x, zAxis.x, 0,
        xAxis.y, yAxis.y, zAxis.y, 0,
        xAxis.z, yAxis.z, zAxis.z, 0,
        0,       0,       0,       1
    );

    // Convert matrix to quaternion
    quat.setFromRotationMatrix(mat);
    return quat;
}

/**
 * Detect if a point is too close to torso geometry (soft penetration check).
 * Useful for haptic feedback or visual warning.
 */
export function checkProbeProximity(
    probePoint: THREE.Vector3,
    torsoMesh: THREE.Object3D,
    proximityThreshold: number = 2 // mm
): { isTooClose: boolean; distance: number } {
    // This is a simplified check — for production, use OBB or distance field
    const bbox = new THREE.Box3().setFromObject(torsoMesh);
    const closestPoint = bbox.clampPoint(probePoint.clone(), new THREE.Vector3());
    const distance = probePoint.distanceTo(closestPoint);

    return { isTooClose: distance < proximityThreshold, distance };
}
