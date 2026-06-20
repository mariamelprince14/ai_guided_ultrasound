/**
 * TopControlBar.tsx
 * ─────────────────
 * Professional top-bar control system. Replaces the bulky side panel
 * with a minimal, simulator-grade dropdown and toggle interface.
 */

import React, { useState, useEffect } from 'react';
import { useAppStore } from '@store/useAppStore';
import { ChevronDown, Eye, HelpCircle, Settings, RefreshCw, Camera, Smartphone, X } from 'lucide-react';
import { wsService } from '@services/websocket';
import { apiService } from '@services/api';
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
    const [showPhoneModal, setShowPhoneModal] = useState(false);
    const sessionId = useAppStore((s) => s.sessionId);
    const [lanIp, setLanIp] = useState<string>('');

    useEffect(() => {
        if (showPhoneModal) {
            apiService.getNetworkInfo()
                .then(info => {
                    if (info && info.lanIp) {
                        setLanIp(info.lanIp);
                    }
                })
                .catch(err => {
                    console.error('Failed to fetch network info:', err);
                });
        }
    }, [showPhoneModal]);

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

                <button
                    className={`${styles.toggleBtn} ${styles.phoneBtn}`}
                    onClick={() => setShowPhoneModal(true)}
                    title="Connect Phone as Probe"
                >
                    <Smartphone size={16} />
                    <span>Phone</span>
                </button>
            </div>

            {/* Phone QR Modal */}
            {showPhoneModal && (
                <div className={styles.phoneModalOverlay} onClick={() => setShowPhoneModal(false)}>
                    <div className={styles.phoneModal} onClick={(e) => e.stopPropagation()}>
                        <div className={styles.phoneModalHeader}>
                            <h3>📱 Connect Phone as Probe</h3>
                            <button className={styles.phoneModalClose} onClick={() => setShowPhoneModal(false)}>
                                <X size={18} />
                            </button>
                        </div>
                        <div className={styles.phoneModalBody}>
                            <p className={styles.phoneModalDesc}>
                                Scan this QR code with your phone to use it as a physical probe controller.
                            </p>
                            {sessionId && (
                                <>
                                    <img
                                        className={styles.qrCode}
                                        src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(
                                            `http://${lanIp || window.location.hostname}:8000/phone/phone_controller.html?session=${sessionId}`
                                        )}`}
                                        alt="QR Code"
                                        width={200}
                                        height={200}
                                    />
                                    <div className={styles.sessionIdDisplay}>
                                        <span className={styles.sessionLabel}>Session ID</span>
                                        <code className={styles.sessionCode}>{sessionId}</code>
                                    </div>
                                    <p className={styles.phoneModalHint}>
                                        Make sure your phone is on the same WiFi network.
                                    </p>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
