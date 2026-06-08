/**
 * Volume35SimulatorLayout.tsx — Professional Clinical Workstation Layout
 */
import React, { useState, useCallback, useEffect } from 'react';
import styles from './Volume35SimulatorLayout.module.css';
import { PanelLeftClose, PanelLeftOpen, Camera, Snowflake, Eye, EyeOff, RotateCcw, Square, TrendingUp, Activity } from 'lucide-react';
import { useAppStore } from '@store/useAppStore';

type TrainingMode = 'beginner' | 'intermediate' | 'advanced';
type ProbeType = 'curvilinear' | 'linear';
type SidebarTab = 'guide' | 'session' | 'probe';

interface Volume35SimulatorLayoutProps {
    volumeViewer: React.ReactNode;
    ultrasoundMonitor: React.ReactNode;
    metrics?: React.ReactNode;
    trainingMode: TrainingMode;
    onModeChange: (mode: TrainingMode) => void;
    probeType: ProbeType;
    onProbeTypeChange: (type: ProbeType) => void;
    isInContact: boolean;
    pressureLevel: number;
    probeAngle: { pitch: number; yaw: number; roll: number };
    elapsedTime?: number;
    scanQuality?: number;
    organCoverage?: number;
    onFreeze?: () => void;
    onSnapshot?: () => void;
    onReset?: () => void;
    onEndSession?: () => void;
    isFrozen?: boolean;
    guidanceVisible?: boolean;
    onToggleGuidance?: () => void;
    anatomyHintActive?: boolean;
    onToggleAnatomyHint?: () => void;
    snapshotCount: number;
}

const GUIDANCE: Record<TrainingMode, { title: string; steps: string[]; tip: string }> = {
    beginner: {
        title: 'Right Kidney — Longitudinal',
        steps: [
            'Place probe in right mid-axillary line, between 10th–11th ribs.',
            'Tilt probe 15° anteriorly to use liver as acoustic window.',
            'Fan slowly until kidney long axis appears on the monitor.',
            'Sweep to identify both upper and lower renal poles.',
        ],
        tip: 'The liver provides an excellent acoustic window for right kidney visualization.',
    },
    intermediate: {
        title: 'Refining Technique',
        steps: [
            'Confirm full kidney length in long axis — both poles visible.',
            'Rotate probe 90° for transverse view. Assess AP diameter.',
            'Optimize gain to differentiate cortex from medulla.',
        ],
        tip: 'Normal adult kidney length: 9–12 cm. Medullary pyramids should be hypoechoic.',
    },
    advanced: {
        title: 'Clinical Assessment',
        steps: [
            'Complete renal survey. Document any collecting system dilatation.',
            'Assess perinephric space for fluid collection or mass.',
        ],
        tip: 'Evaluate for hydronephrosis by grading the pelvicalyceal system dilatation.',
    },
};

const MODE_COLORS: Record<TrainingMode, string> = {
    beginner: '#22c55e',
    intermediate: '#3b82f6',
    advanced: '#64748b',
};

const fmtTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${String(sec).padStart(2, '0')}`;
};

// ─── Guide Tab ────────────────────────────────────────────────────────────────
const GuideTab: React.FC<{ mode: TrainingMode }> = ({ mode }) => {
    const g = GUIDANCE[mode];
    const color = MODE_COLORS[mode];
    return (
        <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
            <div className={styles.guidanceTitle}>{g.title}</div>
            <div>
                {g.steps.map((step, i) => (
                    <div key={i} className={styles.guidanceStep}>
                        <span className={styles.stepNum} style={{ color }}>{String(i + 1).padStart(2, '0')}</span>
                        <span>{step}</span>
                    </div>
                ))}
            </div>
            <div className={styles.tipBox} style={{ borderLeftColor: color }}>
                <div className={styles.tipLabel} style={{ color }}>CLINICAL TIP</div>
                <div className={styles.tipText}>"{g.tip}"</div>
            </div>
        </div>
    );
};

// ─── Session Tab ──────────────────────────────────────────────────────────────
const SessionTab: React.FC<{
    mode: TrainingMode;
    onModeChange: (m: TrainingMode) => void;
    probeType: ProbeType;
    onProbeTypeChange: (t: ProbeType) => void;
}> = ({ mode, onModeChange, probeType, onProbeTypeChange }) => {
    const modes: { key: TrainingMode; label: string; desc: string }[] = [
        { key: 'beginner', label: 'Beginner', desc: 'Full anatomy + guidance' },
        { key: 'intermediate', label: 'Intermediate', desc: 'Minimal guidance' },
        { key: 'advanced', label: 'Advanced', desc: 'No hints — full exam' },
    ];
    return (
        <div>
            <div className={styles.sessionSection}>
                <div className={styles.sessionLabel}>TRAINING MODE</div>
                <div className={styles.modeGrid}>
                    {modes.map(({ key, label, desc }) => (
                        <button
                            key={key}
                            className={`${styles.modeBtn} ${mode === key ? styles.modeBtnActive : ''}`}
                            onClick={() => onModeChange(key)}
                            style={mode === key ? { borderColor: MODE_COLORS[key] + '66', color: '#f8fafc' } : {}}
                        >
                            <div>
                                <div>{label}</div>
                                <div style={{ fontSize: 9, color: '#475569', marginTop: 2 }}>{desc}</div>
                            </div>
                            <div className={styles.modeIndicator} style={{ background: mode === key ? MODE_COLORS[key] : '#1e293b' }} />
                        </button>
                    ))}
                </div>
            </div>
            <div className={styles.divider} />
            <div className={styles.sessionSection}>
                <div className={styles.sessionLabel}>PROBE TYPE</div>
                <div className={styles.probeGrid}>
                    {(['curvilinear', 'linear'] as ProbeType[]).map((t) => (
                        <button
                            key={t}
                            className={`${styles.probeBtn} ${probeType === t ? styles.probeBtnActive : ''}`}
                            onClick={() => onProbeTypeChange(t)}
                        >
                            {t === 'curvilinear' ? 'Curvilinear' : 'Linear'}
                        </button>
                    ))}
                </div>
                <div style={{ marginTop: '8px', fontSize: '10px', color: '#475569', lineHeight: '1.4' }}>
                    {probeType === 'curvilinear' ? 'C5-2 · 55 mm footprint · 3.5–5 MHz' : 'L12-5 · 42 mm footprint · 8–12 MHz'}
                </div>
            </div>
        </div>
    );
};

// ─── Probe Tab ────────────────────────────────────────────────────────────────
const ProbeTab: React.FC<{
    isInContact: boolean;
    pressureLevel: number;
    probeAngle: { pitch: number; yaw: number; roll: number };
}> = ({ isInContact, pressureLevel, probeAngle }) => {
    const { imagingSettings, updateImagingSettings } = useAppStore();
    return (
        <div>
            <div className={styles.sessionSection}>
                <div className={styles.sessionLabel}>SURFACE CONTACT</div>
                <div className={`${styles.contactBadge} ${isInContact ? styles.contactActive : styles.contactInactive}`}>
                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: isInContact ? '#22c55e' : '#475569', boxShadow: isInContact ? '0 0 8px rgba(34,197,94,0.8)' : 'none' }} />
                    {isInContact ? 'IN CONTACT' : 'NO CONTACT'}
                </div>
            </div>
            <div className={styles.divider} />
            <div className={styles.sessionSection}>
                <div className={styles.sessionLabel}>CONTACT PRESSURE</div>
                <div className={styles.probeMetric}>
                    <div className={styles.probeMetricValue}>
                        {Math.round(pressureLevel * 100)}
                        <span className={styles.probeMetricUnit}>%</span>
                    </div>
                </div>
                <div style={{ height: 4, background: 'rgba(255,255,255,0.05)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pressureLevel * 100}%`, background: pressureLevel > 0.7 ? '#ef4444' : pressureLevel > 0.4 ? '#f59e0b' : '#22c55e', borderRadius: 2, transition: 'width 0.2s ease' }} />
                </div>
            </div>
            <div className={styles.divider} />
            <div className={styles.sessionSection}>
                <div className={styles.sessionLabel}>PROBE ORIENTATION</div>
                {[{ label: 'Tilt (Pitch)', value: probeAngle.pitch }, { label: 'Rotation (Yaw)', value: probeAngle.yaw }, { label: 'Roll', value: probeAngle.roll }].map(({ label, value }) => (
                    <div key={label} className={styles.probeMetric} style={{ marginBottom: 10 }}>
                        <div className={styles.probeMetricLabel}>{label}</div>
                        <div className={styles.probeMetricValue}>{value.toFixed(1)}<span className={styles.probeMetricUnit}>°</span></div>
                    </div>
                ))}
            </div>
            <div className={styles.divider} />
            <div className={styles.sessionSection}>
                <div className={styles.sessionLabel}>US PARAMETERS</div>
                {[
                    { key: 'gain', label: 'Gain', min: 0, max: 100, unit: '%', step: 5 },
                    { key: 'depth', label: 'Depth', min: 4, max: 25, unit: 'cm', step: 1 },
                    { key: 'frequency', label: 'Frequency', min: 1, max: 15, unit: 'MHz', step: 0.5 },
                ].map(({ key, label, min, max, unit, step }) => {
                    const val = (imagingSettings as any)[key] as number;
                    return (
                        <div key={key} style={{ marginBottom: 12 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#475569', marginBottom: 4 }}>
                                <span>{label}</span>
                                <span style={{ color: '#94a3b8', fontFamily: 'monospace' }}>{typeof val === 'number' ? val.toFixed(step < 1 ? 1 : 0) : val} {unit}</span>
                            </div>
                            <input
                                type="range" min={min} max={max} step={step}
                                value={val}
                                onChange={e => updateImagingSettings({ [key]: parseFloat(e.target.value) })}
                                style={{ width: '100%', accentColor: '#3b82f6', cursor: 'pointer' }}
                            />
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

// ─── Professional Top Parameters Bar ─────────────────────────────────────────
const ProfessionalTopBar: React.FC<{
    isInContact: boolean;
    pressureLevel: number;
    scanQuality: number;
    organCoverage: number;
    elapsedTime: number;
    trainingMode: TrainingMode;
    isFrozen: boolean;
    guidanceVisible: boolean;
    onFreeze: () => void;
    onSnapshot: () => void;
    onReset: () => void;
    onEndSession: () => void;
    onToggleGuidance: () => void;
    anatomyHintActive: boolean;
    onToggleAnatomyHint: () => void;
    onModeChange: (m: TrainingMode) => void;
    snapshotCount: number;
}> = ({
    isInContact, pressureLevel, scanQuality, organCoverage,
    elapsedTime, trainingMode, isFrozen, guidanceVisible,
    onFreeze, onSnapshot, onReset, onEndSession, onToggleGuidance, 
    anatomyHintActive, onToggleAnatomyHint,
    onModeChange, snapshotCount,
}) => {
    const { imagingSettings, connectionStatus } = useAppStore();
    const qualityColor = scanQuality >= 80 ? '#22c55e' : scanQuality >= 50 ? '#f59e0b' : '#ef4444';

    return (
        <div className={styles.professionalTopBar}>
            {/* Brand */}
            <div className={styles.topBarBrand}>
                <div className={styles.topBarLogo}>US</div>
                <div>
                    <div className={styles.topBarTitle}>SonoSim Pro</div>
                    <div className={styles.topBarSub}>Abdominal Training</div>
                </div>
            </div>

            <div className={styles.topBarDivider} />

            {/* Session Info */}
            <div className={styles.topBarGroup}>
                <div className={styles.topBarLabel}>SESSION</div>
                <div className={styles.topBarTimer}>{fmtTime(elapsedTime)}</div>
                <div className={styles.topBarConnDot} style={{ background: connectionStatus === 'connected' ? '#22c55e' : '#ef4444' }} />
            </div>

            <div className={styles.topBarDivider} />

            {/* US Parameters */}
            <div className={styles.topBarGroup}>
                <div className={styles.topBarLabel}>US PARAMS</div>
                <div className={styles.topBarParamRow}>
                    <span className={styles.topBarParam}><span className={styles.topBarParamLabel}>D</span>{imagingSettings.depth}cm</span>
                    <span className={styles.topBarParam}><span className={styles.topBarParamLabel}>G</span>{imagingSettings.gain}%</span>
                    <span className={styles.topBarParam}><span className={styles.topBarParamLabel}>F</span>{imagingSettings.frequency.toFixed(1)}MHz</span>
                    <span className={styles.topBarParam}><span className={styles.topBarParamLabel}>DR</span>{imagingSettings.dynamicRange}</span>
                </div>
            </div>

            <div className={styles.topBarDivider} />

            {/* Probe Status */}
            <div className={styles.topBarGroup}>
                <div className={styles.topBarLabel}>PROBE</div>
                <div className={styles.topBarParamRow}>
                    <span className={styles.topBarContactDot} style={{ background: isInContact ? '#22c55e' : '#475569', boxShadow: isInContact ? '0 0 6px #22c55e' : 'none' }} />
                    <span style={{ fontSize: 10, color: isInContact ? '#22c55e' : '#475569', fontWeight: 600 }}>{isInContact ? 'CONTACT' : 'NO CONTACT'}</span>
                    <span className={styles.topBarParam}>
                        <span className={styles.topBarParamLabel}>P</span>
                        <span style={{ color: pressureLevel > 0.7 ? '#ef4444' : pressureLevel > 0.4 ? '#f59e0b' : '#94a3b8' }}>{Math.round(pressureLevel * 100)}%</span>
                    </span>
                </div>
            </div>

            <div className={styles.topBarDivider} />

            {/* Quality Scores */}
            <div className={styles.topBarGroup}>
                <div className={styles.topBarLabel}>PERFORMANCE</div>
                <div className={styles.topBarParamRow}>
                    <span className={styles.topBarParam} style={{ color: qualityColor }}>
                        <TrendingUp size={9} style={{ marginRight: 2 }} />{scanQuality}%
                    </span>
                    <span className={styles.topBarParam}>
                        <Activity size={9} style={{ marginRight: 2 }} />{organCoverage}%
                    </span>
                </div>
            </div>

            <div className={styles.topBarDivider} />

            {/* Mode Switcher */}
            <div className={styles.topBarGroup}>
                <div className={styles.topBarLabel}>MODE</div>
                <div className={styles.topBarModes}>
                    {(['beginner', 'intermediate', 'advanced'] as TrainingMode[]).map(m => (
                        <button
                            key={m}
                            className={`${styles.topBarModeBtn} ${trainingMode === m ? styles.topBarModeBtnActive : ''}`}
                            style={trainingMode === m ? { color: MODE_COLORS[m], borderColor: MODE_COLORS[m] + '55' } : {}}
                            onClick={() => onModeChange(m)}
                        >
                            {m.charAt(0).toUpperCase() + m.slice(1, 4)}
                        </button>
                    ))}
                </div>
            </div>

            <div className={styles.topBarDivider} />

            {/* Action Buttons */}
            <div className={styles.topBarActions}>
                <button
                    className={`${styles.topBarActionBtn} ${isFrozen ? styles.topBarActionBtnActive : ''}`}
                    onClick={onFreeze}
                    title={isFrozen ? 'Unfreeze' : 'Freeze Frame'}
                >
                    <Snowflake size={13} />
                    <span>{isFrozen ? 'UNFREEZE' : 'FREEZE'}</span>
                </button>
                <button
                    className={styles.topBarActionBtn}
                    onClick={onSnapshot}
                    title="Take Snapshot"
                >
                    <Camera size={13} />
                    <span>SNAP{snapshotCount > 0 ? ` (${snapshotCount})` : ''}</span>
                </button>
                <button
                    className={`${styles.topBarActionBtn} ${guidanceVisible ? styles.topBarActionBtnGreen : ''}`}
                    onClick={onToggleGuidance}
                    title="Toggle Guidance Overlays"
                >
                    {guidanceVisible ? <Eye size={13} /> : <EyeOff size={13} />}
                    <span>GUIDE</span>
                </button>
                <button
                    className={`${styles.topBarActionBtn} ${anatomyHintActive ? styles.topBarActionBtnGreen : ''}`}
                    onClick={onToggleAnatomyHint}
                    title="Toggle Anatomy Reveal Sphere"
                >
                    <Activity size={13} />
                    <span>ANATOMY</span>
                </button>
                <button
                    className={styles.topBarActionBtn}
                    onClick={onReset}
                    title="Reset Probe"
                >
                    <RotateCcw size={13} />
                    <span>RESET</span>
                </button>
                <button
                    className={styles.topBarEndBtn}
                    onClick={onEndSession}
                    title="End Session"
                >
                    <Square size={13} fill="currentColor" />
                    <span>END</span>
                </button>
            </div>
        </div>
    );
};

// ─── Session End Modal ────────────────────────────────────────────────────────
const SessionEndModal: React.FC<{
    elapsedTime: number;
    scanQuality: number;
    organCoverage: number;
    snapshotCount: number;
    mode: TrainingMode;
    onClose: () => void;
    onRestart: () => void;
}> = ({ elapsedTime, scanQuality, organCoverage, snapshotCount, mode, onClose, onRestart }) => {
    const grade = scanQuality >= 85 ? 'Excellent' : scanQuality >= 65 ? 'Good' : scanQuality >= 45 ? 'Fair' : 'Needs Practice';
    const gradeColor = scanQuality >= 85 ? '#22c55e' : scanQuality >= 65 ? '#3b82f6' : scanQuality >= 45 ? '#f59e0b' : '#ef4444';
    return (
        <div className={styles.modalOverlay}>
            <div className={styles.modalCard}>
                <div className={styles.modalHeader}>
                    <div className={styles.modalTitle}>Session Complete</div>
                    <div className={styles.modalSub}>{mode.charAt(0).toUpperCase() + mode.slice(1)} Training · {fmtTime(elapsedTime)}</div>
                </div>
                <div className={styles.modalGrade} style={{ color: gradeColor }}>{grade}</div>
                <div className={styles.modalMetrics}>
                    {[
                        { label: 'Scan Quality', value: `${scanQuality}%` },
                        { label: 'Organ Coverage', value: `${organCoverage}%` },
                        { label: 'Snapshots Taken', value: String(snapshotCount) },
                        { label: 'Duration', value: fmtTime(elapsedTime) },
                    ].map(({ label, value }) => (
                        <div key={label} className={styles.modalMetricRow}>
                            <span className={styles.modalMetricLabel}>{label}</span>
                            <span className={styles.modalMetricValue}>{value}</span>
                        </div>
                    ))}
                </div>
                <div className={styles.modalSuggestions}>
                    <div className={styles.modalSugTitle}>Improvement Tips</div>
                    {scanQuality < 80 && <div className={styles.modalSugItem}>• Maintain steadier probe contact for higher image quality</div>}
                    {organCoverage < 70 && <div className={styles.modalSugItem}>• Scan more systematically — both renal poles must be visualized</div>}
                    {mode === 'beginner' && <div className={styles.modalSugItem}>• Ready to try Intermediate mode? Reduce reliance on guidance overlays</div>}
                    <div className={styles.modalSugItem}>• Practice subcostal approach with liver window for better kidney access</div>
                </div>
                <div className={styles.modalActions}>
                    <button className={styles.modalBtnSecondary} onClick={onRestart}>New Session</button>
                    <button className={styles.modalBtnPrimary} onClick={onClose}>Close</button>
                </div>
            </div>
        </div>
    );
};

// ─── Main Layout ──────────────────────────────────────────────────────────────
export const Volume35SimulatorLayout: React.FC<Volume35SimulatorLayoutProps> = ({
    volumeViewer, ultrasoundMonitor, metrics,
    trainingMode, onModeChange, probeType, onProbeTypeChange,
    isInContact, pressureLevel, probeAngle,
    elapsedTime = 0, scanQuality = 0, organCoverage = 0,
    onFreeze, onSnapshot, onReset, onEndSession,
    isFrozen = false, guidanceVisible = true, onToggleGuidance,
    anatomyHintActive = false, onToggleAnatomyHint,
}) => {
    const [sidebarOpen, setSidebarOpen] = useState(trainingMode !== 'advanced');
    const [activeTab, setActiveTab] = useState<SidebarTab>('guide');
    const [showEndModal, setShowEndModal] = useState(false);
    const [snapshotCount, setSnapshotCount] = useState(0);
    const { snapshots } = useAppStore();

    useEffect(() => { setSnapshotCount(snapshots.length); }, [snapshots.length]);

    const handleSnapshot = useCallback(() => {
        onSnapshot?.();
    }, [onSnapshot]);

    const handleEndSession = useCallback(() => {
        setShowEndModal(true);
    }, []);

    const tabs: { key: SidebarTab; label: string }[] = [
        { key: 'guide', label: 'GUIDE' },
        { key: 'session', label: 'SESSION' },
        { key: 'probe', label: 'PROBE' },
    ];

    return (
        <div className={styles.simulatorContainer}>
            {/* Professional Top Bar */}
            <ProfessionalTopBar
                isInContact={isInContact}
                pressureLevel={pressureLevel}
                scanQuality={scanQuality}
                organCoverage={organCoverage}
                elapsedTime={elapsedTime}
                trainingMode={trainingMode}
                isFrozen={isFrozen}
                guidanceVisible={guidanceVisible}
                onFreeze={() => onFreeze?.()}
                onSnapshot={handleSnapshot}
                onReset={() => onReset?.()}
                onEndSession={handleEndSession}
                onToggleGuidance={() => onToggleGuidance?.()}
                anatomyHintActive={anatomyHintActive}
                onToggleAnatomyHint={() => onToggleAnatomyHint?.()}
                onModeChange={onModeChange}
                snapshotCount={snapshotCount}
            />

            {/* Main Body */}
            <div className={styles.simulatorBody}>
                {/* CENTER: Primary 3D workspace */}
                <main className={styles.centerWorkspace}>
                    {!sidebarOpen && (
                        <button className={styles.sidebarToggle} onClick={() => setSidebarOpen(true)} title="Show Panel">
                            <PanelLeftOpen size={18} />
                        </button>
                    )}
                    <aside className={`${styles.leftSidebar} ${!sidebarOpen ? styles.collapsed : ''}`}>
                        <div className={styles.glassPanel}>
                            <nav className={styles.tabNav}>
                                {tabs.map(({ key, label }) => (
                                    <button key={key} className={`${styles.tabBtn} ${activeTab === key ? styles.activeTab : ''}`} onClick={() => setActiveTab(key)}>{label}</button>
                                ))}
                            </nav>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '6px 12px 0', flexShrink: 0 }}>
                                <button onClick={() => setSidebarOpen(false)} style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', padding: '4px' }} title="Collapse panel">
                                    <PanelLeftClose size={16} />
                                </button>
                            </div>
                            <div className={styles.tabContent}>
                                {activeTab === 'guide' && <GuideTab mode={trainingMode} />}
                                {activeTab === 'session' && <SessionTab mode={trainingMode} onModeChange={onModeChange} probeType={probeType} onProbeTypeChange={onProbeTypeChange} />}
                                {activeTab === 'probe' && <ProbeTab isInContact={isInContact} pressureLevel={pressureLevel} probeAngle={probeAngle} />}
                            </div>
                        </div>
                    </aside>
                    <div className={styles.viewerContainer}>{volumeViewer}</div>
                </main>

                {/* RIGHT: Professional ultrasound monitor */}
                <aside className={styles.rightPanel}>
                    {ultrasoundMonitor}
                    {metrics}
                </aside>
            </div>

            {/* Session End Modal */}
            {showEndModal && (
                <SessionEndModal
                    elapsedTime={elapsedTime}
                    scanQuality={scanQuality}
                    organCoverage={organCoverage}
                    snapshotCount={snapshotCount}
                    mode={trainingMode}
                    onClose={() => { setShowEndModal(false); onEndSession?.(); }}
                    onRestart={() => { setShowEndModal(false); onReset?.(); }}
                />
            )}
        </div>
    );
};

export { ProfessionalUltrasoundMonitor, MinimalMetricsDisplay } from './Volume35SimulatorLayoutParts';
export default Volume35SimulatorLayout;
