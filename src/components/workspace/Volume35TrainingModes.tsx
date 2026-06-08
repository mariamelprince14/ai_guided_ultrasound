/**
 * Volume35TrainingModes.tsx
 * ──────────────────────────
 * VOLUME 35 ONLY — Three distinct educational HUDs + mode configs.
 *
 * BEGINNER  — Compact guided HUD with anatomy overlay toggle button
 * INTERMEDIATE — Performance metrics (3 bars, color-coded)
 * ADVANCED  — Minimal: timer + scan plane, top-right corner only
 */

import React from 'react';
import { useAppStore } from '@store/useAppStore';

// ─── Beginner Mode HUD ────────────────────────────────────────────────────────

export const BeginnerModeHUD: React.FC<{
    instructions: string[];
    tip: string;
}> = ({ instructions, tip }) => {
    const { anatomyHintActive, toggleAnatomyHint } = useAppStore();

    return (
        <div style={{
            position: 'absolute',
            left: '20px',
            bottom: '90px',
            width: '256px',
            background: 'rgba(10, 18, 35, 0.88)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(34, 197, 94, 0.3)',
            borderRadius: '12px',
            padding: '18px 20px',
            color: '#f8fafc',
            fontFamily: "'Inter', system-ui, sans-serif",
            zIndex: 200,
            boxShadow: '0 4px 24px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.04)',
        }}>
            {/* Mode badge */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                <div style={{
                    width: 8, height: 8, borderRadius: '50%',
                    background: '#22c55e',
                    boxShadow: '0 0 8px rgba(34,197,94,0.7)',
                }} />
                <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '1.2px', color: '#22c55e' }}>
                    BEGINNER GUIDANCE
                </span>
            </div>

            {/* Steps */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
                {instructions.map((step, i) => (
                    <div key={i} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                        <span style={{
                            fontSize: '10px', fontWeight: 800, color: '#22c55e',
                            minWidth: '18px', lineHeight: '1.6',
                        }}>
                            {String(i + 1).padStart(2, '0')}
                        </span>
                        <span style={{ fontSize: '12px', lineHeight: '1.55', color: '#cbd5e1' }}>
                            {step}
                        </span>
                    </div>
                ))}
            </div>

            {/* Clinical tip */}
            <div style={{
                padding: '10px 12px',
                background: 'rgba(34, 197, 94, 0.08)',
                borderLeft: '2px solid #22c55e',
                borderRadius: '4px',
                marginBottom: '14px',
            }}>
                <div style={{ fontSize: '9px', fontWeight: 800, color: '#22c55e', marginBottom: '4px', letterSpacing: '1px' }}>
                    CLINICAL TIP
                </div>
                <div style={{ fontSize: '11px', fontStyle: 'italic', color: '#94a3b8', lineHeight: '1.4' }}>
                    {tip}
                </div>
            </div>

            {/* Anatomy overlay toggle */}
            <button
                onClick={toggleAnatomyHint}
                style={{
                    width: '100%',
                    padding: '9px 12px',
                    background: anatomyHintActive
                        ? 'rgba(34, 197, 94, 0.18)'
                        : 'rgba(255, 255, 255, 0.04)',
                    border: anatomyHintActive
                        ? '1px solid rgba(34, 197, 94, 0.5)'
                        : '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px',
                    color: anatomyHintActive ? '#22c55e' : '#64748b',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    letterSpacing: '0.5px',
                    transition: 'all 0.2s ease',
                    textAlign: 'left',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                }}
            >
                <span style={{ fontSize: '14px' }}>{anatomyHintActive ? '◉' : '○'}</span>
                Anatomy Overlay
            </button>
        </div>
    );
};

// ─── Intermediate Mode HUD ────────────────────────────────────────────────────

interface IntermediateMetrics {
    probeStability: number;
    contactQuality: number;
    organCoverage: number;
}

export const IntermediateModeHUD: React.FC<{ metrics: IntermediateMetrics }> = ({ metrics }) => {
    const metricList = [
        { label: 'Probe Stability', value: metrics.probeStability },
        { label: 'Contact Quality', value: metrics.contactQuality },
        { label: 'Organ Coverage',  value: metrics.organCoverage },
    ];

    const barColor = (v: number) =>
        v >= 80 ? '#22c55e' : v >= 50 ? '#f59e0b' : '#ef4444';

    return (
        <div style={{
            position: 'absolute',
            left: '20px',
            bottom: '90px',
            width: '228px',
            background: 'rgba(10, 18, 35, 0.85)',
            backdropFilter: 'blur(14px)',
            border: '1px solid rgba(59, 130, 246, 0.25)',
            borderRadius: '12px',
            padding: '16px 18px',
            color: '#f1f5f9',
            fontFamily: "'Inter', system-ui, sans-serif",
            zIndex: 200,
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#3b82f6' }} />
                <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '1.2px', color: '#3b82f6' }}>
                    SCAN METRICS
                </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {metricList.map(({ label, value }) => (
                    <div key={label}>
                        <div style={{
                            display: 'flex', justifyContent: 'space-between',
                            fontSize: '11px', color: '#94a3b8', marginBottom: '6px',
                        }}>
                            <span>{label}</span>
                            <span style={{ color: barColor(value), fontWeight: 700 }}>{value}%</span>
                        </div>
                        <div style={{
                            height: '4px',
                            background: 'rgba(255,255,255,0.07)',
                            borderRadius: '2px',
                            overflow: 'hidden',
                        }}>
                            <div style={{
                                height: '100%',
                                width: `${value}%`,
                                background: barColor(value),
                                borderRadius: '2px',
                                transition: 'width 0.5s ease, background 0.3s ease',
                            }} />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

// ─── Advanced Mode HUD ────────────────────────────────────────────────────────

export const AdvancedModeHUD: React.FC<{ time: string; scanPlane: string }> = ({ time, scanPlane }) => (
    <div style={{
        position: 'absolute',
        right: '16px',
        top: '16px',
        padding: '10px 14px',
        background: 'rgba(10, 18, 35, 0.6)',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: '8px',
        color: '#64748b',
        fontFamily: 'monospace',
        fontSize: '11px',
        zIndex: 200,
        textAlign: 'right',
        lineHeight: '1.5',
    }}>
        <div style={{ fontSize: '9px', letterSpacing: '1px', marginBottom: '2px', opacity: 0.6 }}>
            {scanPlane}
        </div>
        <div style={{ color: '#94a3b8', fontSize: '14px', fontWeight: 600 }}>{time}</div>
    </div>
);

// ─── Beginner 3D Guidance (3D scene component — scan zones) ───────────────────
// NOTE: Most 3D overlays are now in Volume35TorsoOverlays.tsx.
// This component only renders items that need registration-group coordinates.

export const BeginnerModeGuidance: React.FC<{
    probePosition: [number, number, number];
    scale: number;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
}> = (_props) => {
    return null;
};

export const IntermediateModeGuidance: React.FC<{ scale: number }> = () => null;

// ─── Mode Transition Overlay ──────────────────────────────────────────────────

const MODE_DESCRIPTIONS: Record<string, { label: string; desc: string; color: string }> = {
    beginner: {
        label: 'BEGINNER',
        desc: 'Guided scanning with placement assistance',
        color: '#22c55e',
    },
    intermediate: {
        label: 'INTERMEDIATE',
        desc: 'Independent scanning with performance feedback',
        color: '#3b82f6',
    },
    advanced: {
        label: 'ADVANCED',
        desc: 'Clinical simulation — no assistance',
        color: '#64748b',
    },
};

export const ModeTransitionOverlay: React.FC<{ mode: string; visible: boolean }> = ({ mode, visible }) => {
    if (!visible) return null;
    const cfg = MODE_DESCRIPTIONS[mode] || MODE_DESCRIPTIONS.beginner;

    return (
        <div style={{
            position: 'fixed', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(2, 6, 23, 0.82)',
            backdropFilter: 'blur(12px)',
            zIndex: 9999,
            animation: 'fadeIn 0.25s ease-out',
        }}>
            <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '10px', color: cfg.color, fontWeight: 700, letterSpacing: '4px', marginBottom: '12px' }}>
                    INITIALIZING
                </div>
                <div style={{ fontSize: '44px', fontWeight: 800, color: '#f8fafc', letterSpacing: '-1px', marginBottom: '12px' }}>
                    {cfg.label}
                </div>
                <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '24px' }}>
                    {cfg.desc}
                </div>
                <div style={{
                    height: '2px', width: '180px', background: 'rgba(255,255,255,0.08)',
                    margin: '0 auto', position: 'relative', overflow: 'hidden', borderRadius: '2px',
                }}>
                    <div style={{
                        position: 'absolute', height: '100%', width: '45%',
                        background: cfg.color,
                        animation: 'loadingBar 0.9s infinite linear',
                        borderRadius: '2px',
                    }} />
                </div>
            </div>
        </div>
    );
};

// ─── Mode Configuration ───────────────────────────────────────────────────────

// eslint-disable-next-line react-refresh/only-export-components
export const TRAINING_MODE_CONFIGS = {
    beginner: {
        id: 'beginner',
        name: 'Beginner',
        description: 'Heavily guided learning with placement assistance',
        torsoOpacity: 1.0,
        volumeOpacity: 0.5,
        showGuidance: true,
        showAnatomyLabels: true,
        correctiveFeedback: true,
    },
    intermediate: {
        id: 'intermediate',
        name: 'Intermediate',
        description: 'Reduced guidance with performance tracking',
        torsoOpacity: 1.0,
        volumeOpacity: 0.65,
        showGuidance: false,
        showAnatomyLabels: false,
        correctiveFeedback: false,
    },
    advanced: {
        id: 'advanced',
        name: 'Advanced',
        description: 'Pure clinical simulation without assistance',
        torsoOpacity: 1.0,
        volumeOpacity: 0.75,
        showGuidance: false,
        showAnatomyLabels: false,
        correctiveFeedback: false,
    },
};

// eslint-disable-next-line react-refresh/only-export-components
export const ModeComponents = {
    BeginnerModeGuidance,
    BeginnerModeHUD,
    IntermediateModeGuidance,
    IntermediateModeHUD,
    AdvancedModeHUD,
    ModeTransitionOverlay,
    TRAINING_MODE_CONFIGS,
};
