/**
 * PressureVisualization.tsx
 * ───────────────────────────
 * Real-time probe contact quality and stability visualization.
 *
 * Contact quality is derived from the tilt-angle between the probe's
 * forward axis and the torso surface normal (computed in DragController
 * via ProbeMetrics.computeContactQualityFromAngles, stored in Zustand).
 *
 * Probe stability is derived from a rolling position-variance window
 * (ProbeStabilityTracker in ProbeMetrics.ts).
 *
 * NO Math.random() — all values come from real physics.
 */

import React from 'react';
import { useAppStore } from '@store/useAppStore';
import styles from './PressureVisualization.module.css';

export interface PressureState {
    pressure: number;            // 0–100
    contactQuality: 'poor' | 'weak' | 'optimal' | 'excess';
    skinDeformation: number;     // visual feedback 0–1
    couplingVisual: boolean;     // gel/coupling visualization
}

// SVG arc helper — d attribute for a circular arc segment
function describeArc(cx: number, cy: number, r: number, startDeg: number, endDeg: number): string {
    const toRad = (d: number) => (d * Math.PI) / 180;
    const x1 = cx + r * Math.cos(toRad(startDeg));
    const y1 = cy + r * Math.sin(toRad(startDeg));
    const x2 = cx + r * Math.cos(toRad(endDeg));
    const y2 = cy + r * Math.sin(toRad(endDeg));
    const large = (endDeg - startDeg > 180) ? 1 : 0;
    return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
}

export const PressureVisualization: React.FC = () => {
    // ── Real physics from store (updated every frame by DragController) ────────
    const contactQuality      = useAppStore(s => s.contactQuality);       // 0–100
    const contactQualityLabel = useAppStore(s => s.contactQualityLabel);  // label
    const probeStability      = useAppStore(s => s.probeStability);       // 0–100

    const label    = contactQualityLabel;
    const pressure = Math.round(contactQuality);
    const stability = Math.round(probeStability);

    const getQualityColor = () => {
        switch (label) {
            case 'optimal': return 'var(--sim-contact-optimal)';
            case 'weak':    return 'var(--sim-contact-weak)';
            case 'excess':  return 'var(--sim-contact-excess)';
            default:        return 'var(--sim-accent-neutral)';
        }
    };

    const getQualityLabel = () => {
        switch (label) {
            case 'optimal': return 'Optimal Contact';
            case 'weak':    return 'Weak Contact';
            case 'excess':  return 'Excess Pressure';
            default:        return 'No Contact';
        }
    };

    const getHint = () => {
        switch (label) {
            case 'optimal': return '✓ Perfect contact for imaging';
            case 'weak':    return '↺ Tilt probe toward perpendicular';
            case 'excess':  return '↓ Reduce probe tilt angle';
            default:        return 'Place probe flat on skin surface';
        }
    };

    const getStabilityColor = () => {
        if (stability >= 85) return '#22c55e';
        if (stability >= 65) return '#84cc16';
        if (stability >= 40) return '#eab308';
        return '#ef4444';
    };

    // Arc: starts at top (−90°), sweeps clockwise proportional to pressure
    const arcStartDeg = -90;
    const arcSweep    = Math.max(0, Math.min(359.9, (pressure / 100) * 360));
    const arcPath     = arcSweep > 0.5 ? describeArc(100, 100, 80, arcStartDeg, arcStartDeg + arcSweep) : '';

    return (
        <div className={`${styles.container} ${styles[label]}`}>
            {/* ── Circular Contact Quality Gauge ─────────────────────── */}
            <div className={styles.gauge}>
                <svg className={styles.gaugeSvg} viewBox="0 0 200 200">
                    {/* Track */}
                    <circle cx="100" cy="100" r="80"
                        fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="10" />
                    {/* Quality arc */}
                    {arcPath && (
                        <path
                            d={arcPath}
                            fill="none"
                            stroke={getQualityColor()}
                            strokeWidth="10"
                            strokeLinecap="round"
                        />
                    )}
                    {/* Centre text */}
                    <text x="100" y="95"  textAnchor="middle"
                        fill="white" fontSize="28" fontWeight="700"
                        fontFamily="system-ui, sans-serif">
                        {pressure}
                    </text>
                    <text x="100" y="116" textAnchor="middle"
                        fill="rgba(255,255,255,0.45)" fontSize="11"
                        fontFamily="system-ui, sans-serif">
                        CONTACT %
                    </text>
                </svg>
            </div>

            {/* ── Status ─────────────────────────────────────────────── */}
            <div className={styles.status}>
                <div className={styles.statusIndicator}>
                    <div className={styles.indicator}
                        style={{ backgroundColor: getQualityColor() }} />
                    <span className={styles.statusLabel}>{getQualityLabel()}</span>
                </div>

                {/* Contact quality bar */}
                <div className={styles.qualityBar}>
                    <div
                        className={styles.qualityFill}
                        style={{
                            width: `${pressure}%`,
                            backgroundColor: getQualityColor(),
                            transition: 'width 0.12s linear, background-color 0.3s ease',
                        }}
                    />
                </div>

                {/* Probe stability mini-bar */}
                <div style={{
                    marginTop: '6px', fontSize: '11px',
                    color: 'rgba(255,255,255,0.55)',
                    display: 'flex', alignItems: 'center', gap: '6px',
                }}>
                    <span>Stability</span>
                    <div style={{
                        flex: 1, height: '4px',
                        background: 'rgba(255,255,255,0.1)',
                        borderRadius: '2px', overflow: 'hidden',
                    }}>
                        <div style={{
                            width: `${stability}%`,
                            height: '100%',
                            backgroundColor: getStabilityColor(),
                            transition: 'width 0.2s ease, background-color 0.3s ease',
                            borderRadius: '2px',
                        }} />
                    </div>
                    <span style={{ color: getStabilityColor(), fontWeight: 600, minWidth: '28px' }}>
                        {stability}%
                    </span>
                </div>

                {/* Actionable hint */}
                <div className={styles.hint}>{getHint()}</div>
            </div>

            {/* ── Skin Deformation Visual ─────────────────────────────── */}
            <div className={styles.skinDeformation}>
                <div
                    className={styles.deformationArea}
                    style={{
                        opacity: Math.min(pressure / 100, 1),
                        transform: `scale(${1 + pressure / 200})`,
                        backgroundColor: getQualityColor(),
                        transition: 'opacity 0.15s ease, transform 0.15s ease, background-color 0.3s ease',
                    }}
                />
            </div>
        </div>
    );
};
