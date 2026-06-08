/**
 * ProbeMetrics.ts
 * ───────────────
 * Physics-accurate, real-time probe performance metrics.
 *
 * Replaces the Math.random() placeholder contact quality with
 * a proper tilt-angle model, and adds a rolling-window stability
 * tracker that rewards slow, steady sweeps.
 *
 * All computations are pure functions or lightweight class
 * instances — no React hooks, no side effects.
 */

import * as THREE from 'three';

// ── Contact Quality ────────────────────────────────────────────────────────────

export type ContactLabel = 'poor' | 'weak' | 'optimal' | 'excess';

export interface ContactQualityResult {
    /** 0–100 linear score */
    score: number;
    /** Qualitative label */
    label: ContactLabel;
    /** Tilt angle between probe forward axis and surface normal (degrees) */
    tiltAngleDeg: number;
    /** Human-readable hint for the trainee */
    hint: string;
}

/**
 * Map the tilt angle between the probe's forward direction and the
 * surface normal to a 0–100 contact quality score.
 *
 * Clinical reality:
 *   • 0–10°  → perpendicular placement → best coupling → 90–100
 *   • 10–25° → slight heel/toe → good coupling → 65–90
 *   • 25–45° → noticeable tilt → reduced coupling → 35–65
 *   • 45–70° → probe edge lifting → poor coupling → 10–35
 *   • >70°   → probe nearly flat → no useful signal → 0–10
 *
 * @param probeForward  Unit vector pointing out of the probe face (world space)
 * @param surfaceNormal Unit vector of the torso surface at contact point (world space)
 */
export function computeContactQuality(
    probeForward: THREE.Vector3,
    surfaceNormal: THREE.Vector3,
): ContactQualityResult {
    // Clamp dot to [-1, 1] before acos to guard floating-point drift
    const dot = Math.min(1, Math.max(-1, probeForward.dot(surfaceNormal)));
    // Angle between probe forward and surface normal (0° = perfectly perpendicular)
    const tiltAngleDeg = (Math.acos(Math.abs(dot)) * 180) / Math.PI;

    let score: number;
    if (tiltAngleDeg <= 10) {
        // Perfect perpendicular — score 90–100
        score = 100 - tiltAngleDeg * 1.0;
    } else if (tiltAngleDeg <= 25) {
        // Slight tilt — score 65–90
        score = 90 - (tiltAngleDeg - 10) * (25 / 15);
    } else if (tiltAngleDeg <= 45) {
        // Moderate tilt — score 35–65
        score = 65 - (tiltAngleDeg - 25) * (30 / 20);
    } else if (tiltAngleDeg <= 70) {
        // Heavy tilt — score 10–35
        score = 35 - (tiltAngleDeg - 45) * (25 / 25);
    } else {
        // Nearly parallel to skin — score 0–10
        score = Math.max(0, 10 - (tiltAngleDeg - 70) * 0.5);
    }

    score = Math.min(100, Math.max(0, score));

    let label: ContactLabel;
    let hint: string;
    if (score >= 75) {
        label = 'optimal';
        hint = '✓ Perfect contact — maintain this angle';
    } else if (score >= 50) {
        label = 'weak';
        hint = '↺ Tilt probe toward perpendicular for better signal';
    } else if (score >= 25) {
        label = 'poor';
        hint = '⚠ Probe angle too steep — heel/toe effect reducing signal';
    } else {
        label = 'poor';
        hint = '✕ No useful contact — probe nearly parallel to skin';
    }

    return { score, label, tiltAngleDeg, hint };
}

/**
 * Convenience overload: compute contact quality from Euler rotation angles.
 * Assumes the probe forward vector is +Y in the probe's local frame, and
 * the baseline normal-aligned rotation is already baked into the probe matrix.
 *
 * @param pitchDeg  User pitch offset (degrees)
 * @param rollDeg   User roll offset (degrees)
 * @param surfaceNormal  World-space surface normal at contact point
 */
export function computeContactQualityFromAngles(
    pitchDeg: number,
    rollDeg: number,
    surfaceNormal: THREE.Vector3,
): ContactQualityResult {
    // The combined tilt is the angular magnitude of the pitch+roll vector
    const combinedTiltDeg = Math.sqrt(pitchDeg ** 2 + rollDeg ** 2);

    // Approximate a "probe forward" that is rotated away from surface normal
    // by the combined tilt angle.
    const tiltRad = (combinedTiltDeg * Math.PI) / 180;
    // Probe forward in surface-normal frame: rotated by tiltRad from normal
    const perpAxis = new THREE.Vector3(1, 0, 0); // arbitrary lateral axis
    const probeForward = surfaceNormal
        .clone()
        .applyAxisAngle(perpAxis, tiltRad)
        .normalize();

    return computeContactQuality(probeForward, surfaceNormal);
}

// ── Probe Stability Tracker ────────────────────────────────────────────────────

/**
 * Rolling-window probe stability tracker.
 *
 * Computes stability as 100 − (normalised position variance).
 *
 * Clinical reality:
 *   • Slow, controlled sweeps → low variance → high stability (90–100)
 *   • Fast, jerky movements  → high variance → low stability (<50)
 *   • Holding still          → zero variance  → 100 stability
 *
 * Usage:
 *   const tracker = new ProbeStabilityTracker(60);   // 1-second window at 60fps
 *   tracker.push(probePos);                           // call every frame
 *   const { score, label } = tracker.compute();
 */
export class ProbeStabilityTracker {
    private readonly windowSize: number;
    private readonly buffer: Array<{ x: number; y: number; z: number }>;
    private head = 0;
    private count = 0;

    /** Max combined std-dev (scene units) that maps to 0% stability */
    private static readonly MAX_STDDEV = 2.5;

    constructor(windowSize = 60) {
        this.windowSize = windowSize;
        this.buffer = new Array(windowSize).fill({ x: 0, y: 0, z: 0 });
    }

    /** Add the current probe position to the rolling window. */
    push(pos: { x: number; y: number; z: number }): void {
        this.buffer[this.head] = { ...pos };
        this.head = (this.head + 1) % this.windowSize;
        if (this.count < this.windowSize) this.count++;
    }

    /** Compute current stability score (0–100) and label. */
    compute(): { score: number; label: 'shaky' | 'unstable' | 'stable' | 'rock-solid' } {
        if (this.count < 4) return { score: 100, label: 'rock-solid' };

        // Compute mean
        let mx = 0, my = 0, mz = 0;
        for (let i = 0; i < this.count; i++) {
            const s = this.buffer[i];
            mx += s.x; my += s.y; mz += s.z;
        }
        mx /= this.count; my /= this.count; mz /= this.count;

        // Compute variance
        let vx = 0, vy = 0, vz = 0;
        for (let i = 0; i < this.count; i++) {
            const s = this.buffer[i];
            vx += (s.x - mx) ** 2;
            vy += (s.y - my) ** 2;
            vz += (s.z - mz) ** 2;
        }
        vx /= this.count; vy /= this.count; vz /= this.count;

        // Combined std-dev (magnitude of individual per-axis std-devs)
        const stddev = Math.sqrt(vx + vy + vz);

        // Map to 0–100 (lower stddev = higher stability)
        const raw = 1 - Math.min(1, stddev / ProbeStabilityTracker.MAX_STDDEV);
        // Apply a mild power curve so small improvements near 100 are harder to gain
        const score = Math.round(Math.min(100, Math.max(0, raw ** 0.6 * 100)));

        let label: 'shaky' | 'unstable' | 'stable' | 'rock-solid';
        if (score >= 85)      label = 'rock-solid';
        else if (score >= 65) label = 'stable';
        else if (score >= 40) label = 'unstable';
        else                  label = 'shaky';

        return { score, label };
    }

    /** Reset the window (call on session start or reset). */
    reset(): void {
        this.head = 0;
        this.count = 0;
    }
}

// ── Dead-Zone Filter ───────────────────────────────────────────────────────────

/**
 * Returns true if the pointer delta exceeds the dead-zone threshold.
 * Prevents micro-jitter from high-sensitivity mice.
 *
 * @param dx            Horizontal pixel delta since last event
 * @param dy            Vertical pixel delta since last event
 * @param thresholdPx   Dead-zone radius in pixels (default 2px)
 */
export function exceedsDeadZone(dx: number, dy: number, thresholdPx = 2): boolean {
    return dx * dx + dy * dy > thresholdPx * thresholdPx;
}

// ── Adaptive Smoothing Factor ──────────────────────────────────────────────────

/**
 * Computes a frame-rate-independent, speed-adaptive LERP factor.
 *
 * Fast movements: lower alpha → more inertia → prevents overshoot.
 * Slow movements: higher alpha → snappier response → no sluggishness.
 *
 * @param speedPxPerFrame   Pointer speed in pixels/frame
 * @param baseFactor        Target alpha for slow movement (default 0.22)
 * @param minFactor         Minimum alpha for very fast movement (default 0.08)
 */
export function adaptiveSmoothFactor(
    speedPxPerFrame: number,
    baseFactor = 0.22,
    minFactor = 0.08,
): number {
    // Exponential decay: at 0px/frame → baseFactor; at 30px/frame → minFactor
    const t = Math.min(1, speedPxPerFrame / 30);
    return baseFactor + (minFactor - baseFactor) * t;
}

// ── Probe Forward Vector ───────────────────────────────────────────────────────

/**
 * Extract the probe's forward (+Z) direction from its world matrix.
 * Used to compare against the surface normal for contact quality.
 */
export function extractProbeForward(worldMatrix: THREE.Matrix4): THREE.Vector3 {
    return new THREE.Vector3().setFromMatrixColumn(worldMatrix, 2).normalize();
}
