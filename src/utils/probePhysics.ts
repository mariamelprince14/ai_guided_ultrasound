/**
 * probePhysics.ts
 * ───────────────
 * Realistic ultrasound probe simulation including:
 * - Surface contact detection
 * - Pressure/penetration depth simulation
 * - Constrained movement along torso curvature
 * - Orientation-dependent scanning
 */

import type { SurfaceContact } from '@/types';

export interface RaycastResult {
    hitPoint: [number, number, number];
    surfaceNormal: [number, number, number];
    distance: number;
}

export interface ProbeState {
    position: [number, number, number];
    rotation: [number, number, number];
    pressure: number; // 0-1 normalized
}

/**
 * Compute surface contact when probe touches torso mesh.
 * 
 * In a real implementation, this would use Three.js raycasting
 * or actual collision detection with the torso geometry.
 * 
 * For now, simplified model:
 * - If probe is close enough to surface, mark as in-contact
 * - Compute surface normal (estimated or from mesh)
 * - Compute penetration depth based on pressure
 */
export function computeSurfaceContact(
    probePos: [number, number, number],
    torsoBounds: { center: [number, number, number]; size: [number, number, number] },
    pressure: number = 0
): SurfaceContact {
    const torsoCenter = torsoBounds.center;
    // Semi-axes of the ellipsoid
    const rx = torsoBounds.size[0] / 2;
    const ry = torsoBounds.size[1] / 2;
    const rz = torsoBounds.size[2] / 2;

    // Vector from center to probe
    const dx = probePos[0] - torsoCenter[0];
    const dy = probePos[1] - torsoCenter[1];
    const dz = probePos[2] - torsoCenter[2];

    // Distance in normalized ellipsoid space
    const normDist = Math.sqrt((dx/rx)**2 + (dy/ry)**2 + (dz/rz)**2);
    
    // Project point onto ellipsoid surface
    const surfacePoint: [number, number, number] = [
        torsoCenter[0] + dx / normDist,
        torsoCenter[1] + dy / normDist,
        torsoCenter[2] + dz / normDist
    ];

    // Normal to ellipsoid at surface point
    const nx = (2 * (surfacePoint[0] - torsoCenter[0])) / (rx * rx);
    const ny = (2 * (surfacePoint[1] - torsoCenter[1])) / (ry * ry);
    const nz = (2 * (surfacePoint[2] - torsoCenter[2])) / (rz * rz);
    const nLen = Math.sqrt(nx*nx + ny*ny + nz*nz);
    const normal: [number, number, number] = [nx/nLen, ny/nLen, nz/nLen];

    // Contact if probe is near surface point
    const distToSurface = Math.sqrt(
        (probePos[0]-surfacePoint[0])**2 + 
        (probePos[1]-surfacePoint[1])**2 + 
        (probePos[2]-surfacePoint[2])**2
    );
    const isInContact = distToSurface < 15;

    return {
        contactPoint: surfacePoint,
        contactNormal: normal,
        isInContact,
        penetrationDepth: pressure * 25,
        pressureLevel: pressure,
    };
}

/**
 * Constrain probe movement to follow torso surface.
 * 
 * When probe is in contact, movement is constrained to:
 * - Slide along surface (tangential movement)
 * - Limited penetration depth (normal movement)
 * - Tilt angle constraints
 */
export function constrainProbeMovement(
    desiredPos: [number, number, number],
    desiredRot: [number, number, number],
    contact: SurfaceContact,
    maxTiltAngle: number = 60
): { constrainedPos: [number, number, number]; constrainedRot: [number, number, number] } {
    if (!contact.isInContact) {
        // No contact, no constraints
        return {
            constrainedPos: desiredPos,
            constrainedRot: desiredRot,
        };
    }

    // Constrain tilt angle
    const pitch = desiredRot[0];
    const constrainedPitch = Math.max(-maxTiltAngle, Math.min(maxTiltAngle, pitch));

    // Position: keep probe at contact point surface
    const constrainedPos = contact.contactPoint;

    return {
        constrainedPos,
        constrainedRot: [constrainedPitch, desiredRot[1], desiredRot[2]],
    };
}

/**
 * Simulate slice generation from probe position/orientation and penetration depth.
 * 
 * The ultrasound slice origin is offset inward from the surface
 * by the penetration depth, simulating pressing into tissue.
 */
export function computeSliceOrigin(
    contact: SurfaceContact
): [number, number, number] {
    if (!contact.isInContact) {
        return contact.contactPoint;
    }

    // Move inward along surface normal by penetration depth
    const [nx, ny, nz] = contact.contactNormal;
    const depth = contact.penetrationDepth;

    return [
        contact.contactPoint[0] - nx * depth,
        contact.contactPoint[1] - ny * depth,
        contact.contactPoint[2] - nz * depth,
    ];
}

/**
 * Estimate probe pressure from Z position and contact state.
 * 
 * Simplified: pressure increases as probe is pushed deeper into body
 */
export function estimatePressure(
    currentZ: number,
    restingZ: number,
    maxPressure: number = 20
): number {
    const depression = Math.max(0, restingZ - currentZ);
    // Normalize: 0mm = 0 pressure, maxPressure mm = 1.0 pressure
    return Math.min(1.0, depression / maxPressure);
}

/**
 * Verify tilt angle is within realistic bounds for ultrasound scanning
 */
export function clampTiltAngle(angle: number, maxAngle: number = 60): number {
    return Math.max(-maxAngle, Math.min(maxAngle, angle));
}

/**
 * Check if probe orientation is valid for current contact state
 */
export function isValidProbeOrientation(
    rotation: [number, number, number],
    contact: SurfaceContact,
    maxTiltAngle: number = 60
): boolean {
    const [pitch] = rotation;

    // If in contact, tilt angle must be reasonable
    if (contact.isInContact) {
        return Math.abs(pitch) <= maxTiltAngle;
    }

    return true;
}
