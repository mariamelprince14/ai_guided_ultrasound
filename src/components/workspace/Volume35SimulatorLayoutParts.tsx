/**
 * Volume35SimulatorLayoutParts.tsx
 * Professional Ultrasound Monitor + Minimal Metrics Display
 */
import React from 'react';
import styles from './Volume35SimulatorLayout.module.css';

// ─── Professional Ultrasound Monitor ─────────────────────────────────────────
interface ProfessionalUltrasoundMonitorProps {
    currentFrame: string | null;
    imagingSettings: {
        gain: number;
        depth: number;
        frequency: number;
        dynamicRange: number;
    };
    scanInfo: {
        probeType: 'curvilinear' | 'linear';
        scanPlane: string;
        timeStamp: string;
    };
    isFrozen?: boolean;
}

export const ProfessionalUltrasoundMonitor: React.FC<ProfessionalUltrasoundMonitorProps> = ({
    currentFrame, imagingSettings, scanInfo, isFrozen = false,
}) => {
    const probeLabel = scanInfo.probeType === 'curvilinear' ? 'C5-2' : 'L12-5';
    const depthSteps = [0, 3, 6, 9, 12, 15].filter(d => d <= imagingSettings.depth);

    return (
        <div className={styles.ultrasoundMonitor}>
            {/* Clinical header */}
            <div className={styles.monitorHeader}>
                <div>
                    <div className={styles.systemName}>SonoSim V35{isFrozen ? ' ❄' : ''}</div>
                    <div style={{ fontSize: '9px', color: '#334155', marginTop: '2px' }}>
                        {probeLabel} · {scanInfo.scanPlane}
                    </div>
                </div>
                <div className={styles.monitorTimestamp}>{scanInfo.timeStamp}</div>
            </div>

            {/* Main display area */}
            <div className={styles.displayArea}>
                <div className={styles.scanlines} />

                {currentFrame ? (
                    <img
                        src={currentFrame}
                        alt="Ultrasound"
                        className={styles.ultrasoundImage}
                        style={isFrozen ? { filter: 'contrast(1.08) brightness(1.05) saturate(0.8)' } : undefined}
                    />
                ) : (
                    <div className={styles.noSignalOverlay}>
                        <div className={styles.noSignalText}>NO SIGNAL</div>
                        <div className={styles.noSignalSub}>ESTABLISH PROBE CONTACT</div>
                    </div>
                )}

                {/* Frozen indicator */}
                {isFrozen && (
                    <div style={{
                        position: 'absolute',
                        top: 10,
                        right: 40,
                        background: 'rgba(59,130,246,0.2)',
                        border: '1px solid rgba(59,130,246,0.5)',
                        color: '#60a5fa',
                        fontSize: 9,
                        fontWeight: 800,
                        letterSpacing: 1,
                        padding: '3px 8px',
                        borderRadius: 4,
                    }}>FROZEN</div>
                )}

                {/* Clinical image overlay */}
                <div className={styles.imageOverlay}>
                    <div>{probeLabel} {imagingSettings.frequency.toFixed(1)} MHz</div>
                    <div>G {imagingSettings.gain}%</div>
                </div>

                {/* Depth ruler */}
                <div className={styles.depthRuler}>
                    {depthSteps.map((d) => (
                        <div key={d} className={styles.depthTick}>
                            <div className={styles.depthTickLine} />
                            <div className={styles.depthTickLabel}>{d}</div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Settings bar */}
            <div className={styles.settingsBar}>
                <SettingItem label="GAIN"  value={`${imagingSettings.gain}%`} />
                <SettingItem label="DEPTH" value={`${imagingSettings.depth} cm`} />
                <SettingItem label="DR"    value={String(imagingSettings.dynamicRange)} />
            </div>
        </div>
    );
};

const SettingItem: React.FC<{ label: string; value: string }> = ({ label, value }) => (
    <div className={styles.settingItem}>
        <div className={styles.settingLabel}>{label}</div>
        <div className={styles.settingValue}>{value}</div>
    </div>
);

// ─── Minimal Metrics Display ──────────────────────────────────────────────────
interface MinimalMetricsProps {
    elapsedTime: number;
    scanQuality: number;
    probeStability: number;
    organCoverage: number;
}

export const MinimalMetricsDisplay: React.FC<MinimalMetricsProps> = ({
    elapsedTime, scanQuality, probeStability, organCoverage,
}) => {
    const fmtTime = (s: number) => {
        const m = Math.floor(s / 60);
        const sec = s % 60;
        return `${m}:${String(sec).padStart(2, '0')}`;
    };
    const barColor = (v: number) => v >= 80 ? '#22c55e' : v >= 50 ? '#f59e0b' : '#ef4444';
    const rows = [
        { label: 'Scan Quality',    value: scanQuality },
        { label: 'Probe Stability', value: probeStability },
        { label: 'Organ Coverage',  value: organCoverage },
    ];

    return (
        <div className={styles.metricsPanel}>
            <div className={styles.metricsPanelHeader}>
                <span className={styles.metricsPanelTitle}>SESSION METRICS</span>
                <span className={styles.metricsTime}>{fmtTime(elapsedTime)}</span>
            </div>
            {rows.map(({ label, value }) => (
                <div key={label} className={styles.metricItem}>
                    <div className={styles.metricHeader}>
                        <span>{label}</span>
                        <span style={{ color: barColor(Math.round(value)), fontWeight: 700 }}>{Math.round(value)}%</span>
                    </div>
                    <div className={styles.progressBar}>
                        <div className={styles.progressFill} style={{ width: `${value}%`, background: barColor(Math.round(value)) }} />
                    </div>
                </div>
            ))}
        </div>
    );
};
