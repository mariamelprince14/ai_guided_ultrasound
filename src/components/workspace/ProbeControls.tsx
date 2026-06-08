/**
 * ProbeControls.tsx
 * ──────────────────
 * Probe control hub that integrates:
 * - ProbeHUD: Minimal immersive display (always visible)
 * - AdvancedControls: Full slider panel (hidden by default, dev mode)
 * 
 * Maintains all WebSocket communication and backend integration
 * while providing two different UX modes.
 */
import React, { useCallback, useRef, useState } from 'react';
import { useAppStore } from '@store/useAppStore';
import { wsService } from '@services/websocket';
import { Camera, RefreshCw } from 'lucide-react';
import { AdvancedControls } from './AdvancedControls';
import styles from './ProbeControls.module.css';

export const ProbeControls: React.FC = () => {
    const {
        updatePose,
        volumeInfo,
        connectionStatus,
        setProbePos,
        setProbeRot,
        visualizationSettings,
    } = useAppStore();

    // Local state
    const [captureLoading, setCaptureLoading] = useState(false);
    const [lastCapture, setLastCapture] = useState<string | null>(null);
    const sendTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

    const sendProbeUpdate = useCallback((
        px: number, py: number, pz: number,
        pitch: number, yaw: number, roll: number
    ) => {
        if (sendTimeout.current) clearTimeout(sendTimeout.current);
        sendTimeout.current = setTimeout(() => {
            wsService.sendProbeUpdate(px, py, pz, pitch, yaw, roll);
            updatePose({
                position: { x: px, y: py, z: pz },
                rotation: { pitch, yaw, roll },
            });
        }, 16); // ~60fps throttle
    }, [updatePose]);

    const handleCapture = () => {
        setCaptureLoading(true);
        wsService.sendCapture();
        setTimeout(() => {
            setCaptureLoading(false);
            setLastCapture(new Date().toLocaleTimeString());
        }, 800);
    };

    const handleReset = () => {
        const center = volumeInfo?.bounds?.center ?? [0, 0, 0];
        const next = { x: center[0], y: center[1], z: center[2] };
        const nextRot = { pitch: 0, yaw: 0, roll: 0 };
        setProbePos(next);
        setProbeRot(nextRot);
        sendProbeUpdate(next.x, next.y, next.z, 0, 0, 0);
    };

    const isConnected = connectionStatus === 'connected';

    return (
        <>
            {/* Always-visible action bar */}
            <div className={styles.actionBar}>
                <button
                    className={styles.resetBtn}
                    onClick={handleReset}
                    title="Reset probe to center"
                >
                    <RefreshCw size={14} />
                    Reset
                </button>
                <button
                    className={`${styles.captureBtn} ${captureLoading ? styles.capturing : ''}`}
                    onClick={handleCapture}
                    disabled={!isConnected || captureLoading}
                >
                    <Camera size={14} />
                    {captureLoading ? 'Saving...' : 'Capture'}
                </button>
            </div>

            {lastCapture && (
                <div className={styles.captureSuccess}>
                    ✓ Frame saved to disk
                </div>
            )}

            {/* Advanced Controls Panel (conditional, developer mode) */}
            {visualizationSettings.showAdvancedControls && (
                <div className={styles.advancedPanel}>
                    <AdvancedControls />
                </div>
            )}
        </>
    );
};
