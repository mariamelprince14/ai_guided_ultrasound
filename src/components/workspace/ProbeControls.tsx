/**
 * ProbeControls.tsx
 * ──────────────────
 * Virtual probe control panel.
 * Sends probe pose updates via WebSocket to the backend,
 * which re-slices the CT volume and streams back the ultrasound frame.
 *
 * Controls:
 *   - X/Y/Z position sliders (clamps to volume bounds)
 *   - Pitch / Yaw / Roll rotation sliders
 *   - Window/Level sliders (rendering)
 *   - Segmentation overlay toggle
 *   - Capture button
 *   - Case switcher
 */
import React, { useCallback, useRef, useState } from 'react';
import { useAppStore } from '@store/useAppStore';
import { wsService } from '@services/websocket';
import { Camera, RefreshCw, Sliders, Eye, EyeOff } from 'lucide-react';
import styles from './ProbeControls.module.css';

interface SliderRowProps {
    label: string;
    value: number;
    min: number;
    max: number;
    step: number;
    unit?: string;
    onChange: (v: number) => void;
    color?: string;
}

const SliderRow: React.FC<SliderRowProps> = ({
    label, value, min, max, step, unit = '', onChange, color
}) => (
    <div className={styles.sliderRow}>
        <div className={styles.sliderHeader}>
            <span className={styles.sliderLabel}>{label}</span>
            <span className={styles.sliderValue} style={{ color: color || 'inherit' }}>
                {value.toFixed(1)}{unit}
            </span>
        </div>
        <input
            type="range"
            className={styles.slider}
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={e => onChange(parseFloat(e.target.value))}
            style={{ '--slider-color': color || 'var(--color-accent, #4f8ef7)' } as React.CSSProperties}
        />
        <div className={styles.sliderRange}>
            <span>{min}{unit}</span>
            <span>{max}{unit}</span>
        </div>
    </div>
);

export const ProbeControls: React.FC = () => {
    const {
        updatePose,
        renderSettings,
        updateRenderSettings,
        volumeInfo,
        connectionStatus,
    } = useAppStore();

    // Local state (update store + send WS on commit)
    const [pos, setPos] = useState({ x: 0, y: 0, z: 0 });
    const [rot, setRot] = useState({ pitch: 0, yaw: 0, roll: 0 });
    const [captureLoading, setCaptureLoading] = useState(false);
    const [lastCapture, setLastCapture] = useState<string | null>(null);
    const sendTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Derived volume bounds (for slider range)
    const bounds = volumeInfo?.bounds ?? {
        min: [-150, -150, -150],
        max: [150, 150, 150],
        center: [0, 0, 0],
    };

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

    const handlePos = (axis: 'x' | 'y' | 'z', val: number) => {
        const next = { ...pos, [axis]: val };
        setPos(next);
        sendProbeUpdate(next.x, next.y, next.z, rot.pitch, rot.yaw, rot.roll);
    };

    const handleRot = (axis: 'pitch' | 'yaw' | 'roll', val: number) => {
        const next = { ...rot, [axis]: val };
        setRot(next);
        sendProbeUpdate(pos.x, pos.y, pos.z, next.pitch, next.yaw, next.roll);
    };

    const handleWL = (wl: number) => {
        updateRenderSettings({ wl });
        wsService.sendSettingsUpdate({ wl });
    };

    const handleWW = (ww: number) => {
        updateRenderSettings({ ww });
        wsService.sendSettingsUpdate({ ww });
    };

    const toggleSeg = () => {
        const showSeg = !renderSettings.showSeg;
        updateRenderSettings({ showSeg });
        wsService.sendSettingsUpdate({ showSeg });
    };

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
        setPos(next);
        setRot(nextRot);
        sendProbeUpdate(next.x, next.y, next.z, 0, 0, 0);
    };

    const isConnected = connectionStatus === 'connected';

    return (
        <div className={styles.container}>
            {/* Header */}
            <div className={styles.header}>
                <div className={styles.headerLeft}>
                    <Sliders size={14} />
                    <span>Probe Controls</span>
                </div>
                <div className={`${styles.connBadge} ${isConnected ? styles.connOnline : styles.connOffline}`}>
                    <span className={styles.connDot} />
                    {isConnected ? 'Live' : connectionStatus}
                </div>
            </div>

            {/* Position Section */}
            <div className={styles.section}>
                <div className={styles.sectionTitle}>Position (mm)</div>
                <SliderRow
                    label="X (Left/Right)"
                    value={pos.x}
                    min={bounds.min[0]}
                    max={bounds.max[0]}
                    step={1}
                    unit="mm"
                    color="#f97316"
                    onChange={v => handlePos('x', v)}
                />
                <SliderRow
                    label="Y (Anterior/Posterior)"
                    value={pos.y}
                    min={bounds.min[1]}
                    max={bounds.max[1]}
                    step={1}
                    unit="mm"
                    color="#4ade80"
                    onChange={v => handlePos('y', v)}
                />
                <SliderRow
                    label="Z (Superior/Inferior)"
                    value={pos.z}
                    min={bounds.min[2]}
                    max={bounds.max[2]}
                    step={1}
                    unit="mm"
                    color="#60a5fa"
                    onChange={v => handlePos('z', v)}
                />
            </div>

            {/* Rotation Section */}
            <div className={styles.section}>
                <div className={styles.sectionTitle}>Orientation (°)</div>
                <SliderRow
                    label="Pitch (Tilt)"
                    value={rot.pitch}
                    min={-90}
                    max={90}
                    step={1}
                    unit="°"
                    color="#f97316"
                    onChange={v => handleRot('pitch', v)}
                />
                <SliderRow
                    label="Yaw (Rotate)"
                    value={rot.yaw}
                    min={-90}
                    max={90}
                    step={1}
                    unit="°"
                    color="#4ade80"
                    onChange={v => handleRot('yaw', v)}
                />
                <SliderRow
                    label="Roll (In-plane)"
                    value={rot.roll}
                    min={-90}
                    max={90}
                    step={1}
                    unit="°"
                    color="#60a5fa"
                    onChange={v => handleRot('roll', v)}
                />
            </div>

            {/* Rendering Section */}
            <div className={styles.section}>
                <div className={styles.sectionTitle}>Window / Level</div>
                <SliderRow
                    label="Window Level (HU)"
                    value={renderSettings.wl}
                    min={-1000}
                    max={2000}
                    step={10}
                    unit=" HU"
                    onChange={handleWL}
                />
                <SliderRow
                    label="Window Width (HU)"
                    value={renderSettings.ww}
                    min={50}
                    max={3000}
                    step={50}
                    unit=" HU"
                    onChange={handleWW}
                />
            </div>

            {/* Segmentation Toggle */}
            {volumeInfo?.hasSegmentation && (
                <button
                    className={`${styles.segToggle} ${renderSettings.showSeg ? styles.segOn : ''}`}
                    onClick={toggleSeg}
                >
                    {renderSettings.showSeg ? <Eye size={14} /> : <EyeOff size={14} />}
                    {renderSettings.showSeg ? 'Hide Segmentation' : 'Show Segmentation'}
                </button>
            )}

            {/* Action Buttons */}
            <div className={styles.actions}>
                <button
                    className={styles.resetBtn}
                    onClick={handleReset}
                    title="Reset probe to center of volume"
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
                    ✓ Saved at {lastCapture}
                </div>
            )}
        </div>
    );
};
