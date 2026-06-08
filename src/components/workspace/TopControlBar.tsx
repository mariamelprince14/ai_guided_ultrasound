/**
 * TopControlBar.tsx
 * ─────────────────
 * Professional top-bar control system. Replaces the bulky side panel
 * with a minimal, simulator-grade dropdown and toggle interface.
 */

import React from 'react';
import { useAppStore } from '@store/useAppStore';
import { ChevronDown, Eye, HelpCircle, Settings, RefreshCw, Camera } from 'lucide-react';
import { wsService } from '@services/websocket';
import styles from './TopControlBar.module.css';

export const TopControlBar: React.FC = () => {
    const {
        visualizationSettings,
        setVisualizationMode,
        toggleGuidance,
        toggleAnatomyHint,
        anatomyHintActive,
        updatePose,
        volumeInfo,
        setProbePos,
        setProbeRot,
        connectionStatus,
    } = useAppStore();

    const [captureLoading, setCaptureLoading] = React.useState(false);

    const modes = [
        { id: 'beginner', label: 'Beginner Training', desc: 'Full anatomical guidance' },
        { id: 'intermediate', label: 'Intermediate Practice', desc: 'Clinical view with hints' },
        { id: 'advanced', label: 'Advanced Assessment', desc: 'Unguided clinical sim' }
    ] as const;

    const handleReset = () => {
        const center = volumeInfo?.bounds?.center ?? [0, 0, 0];
        const next = { x: center[0], y: center[1], z: center[2] };
        const nextRot = { pitch: 0, yaw: 0, roll: 0 };
        setProbePos(next);
        setProbeRot(nextRot);
        wsService.sendProbeUpdate(next.x, next.y, next.z, 0, 0, 0);
        updatePose({ position: next, rotation: nextRot });
    };

    const handleCapture = () => {
        setCaptureLoading(true);
        wsService.sendCapture();
        setTimeout(() => setCaptureLoading(false), 1000);
    };

    const currentMode = modes.find(m => m.id === visualizationSettings.mode) || modes[0];

    return (
        <div className={styles.container}>
            {/* 1. Mode Dropdown */}
            <div className={styles.dropdownGroup}>
                <div className={styles.dropdownTrigger}>
                    <span className={styles.label}>Training Mode:</span>
                    <button className={styles.dropdownBtn}>
                        {currentMode.label}
                        <ChevronDown size={14} className={styles.chevron} />
                    </button>
                </div>
                <div className={styles.dropdownMenu}>
                    {modes.map((mode) => (
                        <button
                            key={mode.id}
                            className={`${styles.menuItem} ${visualizationSettings.mode === mode.id ? styles.active : ''}`}
                            onClick={() => setVisualizationMode(mode.id)}
                        >
                            <div className={styles.menuItemTitle}>{mode.label}</div>
                            <div className={styles.menuItemDesc}>{mode.desc}</div>
                        </button>
                    ))}
                </div>
            </div>

            <div className={styles.divider} />

            {/* 2. Toggle Switches */}
            <div className={styles.toggleGroup}>
                {(visualizationSettings.mode === 'beginner' || visualizationSettings.mode === 'intermediate') && (
                    <button 
                        className={`${styles.toggleBtn} ${visualizationSettings.showGuidance ? styles.active : ''}`}
                        onClick={toggleGuidance}
                        title="Toggle Guidance Overlay"
                    >
                        <Eye size={16} />
                        <span>Guidance</span>
                    </button>
                )}

                {visualizationSettings.mode === 'intermediate' && (
                    <button 
                        className={`${styles.toggleBtn} ${anatomyHintActive ? styles.active : ''}`}
                        onClick={toggleAnatomyHint}
                        title="Toggle Anatomy Hint (Temporary Reveal)"
                    >
                        <HelpCircle size={16} />
                        <span>Anatomy Hint</span>
                    </button>
                )}
            </div>

            <div className={styles.spacer} />

            {/* 3. Global Actions */}
            <div className={styles.actionGroup}>
                <button 
                    className={styles.resetBtn} 
                    onClick={handleReset}
                    title="Reset Probe to Center"
                >
                    <RefreshCw size={14} />
                    <span>Reset</span>
                </button>

                <button 
                    className={`${styles.captureBtn} ${captureLoading ? styles.loading : ''}`}
                    onClick={handleCapture}
                    disabled={connectionStatus !== 'connected' || captureLoading}
                >
                    <Camera size={14} />
                    {captureLoading ? 'Saving...' : 'Capture Snapshot'}
                </button>

                <div className={styles.divider} />

                <button className={styles.actionIconBtn} title="Simulator Settings">
                    <Settings size={18} />
                </button>
            </div>
        </div>
    );
};
