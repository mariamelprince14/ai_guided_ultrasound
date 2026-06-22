/**
 * Volume35TrainingSession.tsx
 * ────────────────────────────
 * Orchestrates the complete Volume 35 experience.
 */
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useAppStore } from '@store/useAppStore';
import { wsService } from '@services/websocket';
import type { WSMessage } from '@/types';
import {
    Volume35SimulatorLayout,
    ProfessionalUltrasoundMonitor,
    MinimalMetricsDisplay,
} from './Volume35SimulatorLayout';
import { ModeTransitionOverlay } from './Volume35TrainingModes';
import styles from './Volume35TrainingSession.module.css';

type LoadState = 'idle' | 'loading' | 'ready' | 'error';
type TrainingMode = 'beginner' | 'intermediate' | 'advanced';
type ProbeType = 'curvilinear' | 'linear';

interface Volume35SessionProps {
    volumeViewer: React.ReactNode;
    caseId: string;
}

// ─── Feedback Messages ────────────────────────────────────────────────────────
const GUIDANCE_MESSAGES = [
    'Move probe superiorly toward the costal margin.',
    'Rotate clockwise 15° for better kidney alignment.',
    'Increase depth to 15 cm — kidney may be deeper.',
    'Reduce pressure slightly — image distortion detected.',
    'Fan probe anteriorly to use liver as acoustic window.',
    'Excellent contact — maintain current position.',
    'Tilt probe medially to capture lower renal pole.',
    'Good alignment — sweep slowly to assess full kidney length.',
];

export const Volume35TrainingSession: React.FC<Volume35SessionProps> = ({ volumeViewer, caseId }) => {
    const isVolume35 = caseId === 'test35';

    const {
        sessionId,
        visualizationSettings,
        setVisualizationMode,
        imagingSettings,
        currentFrame,
        probeRot,
        probePhysics,
        status: sessionStatus,
        addSnapshot,
        toggleGuidance,
        anatomyHintActive,
        toggleAnatomyHint,
        currentFeedback,
    } = useAppStore();

    const [loadState]                        = useState<LoadState>(sessionId ? 'ready' : 'error');
    const [probeType, setProbeType]          = useState<ProbeType>('curvilinear');
    const [showTransition, setShowTransition] = useState(false);
    const [scanQuality,    setScanQuality]   = useState(0);
    const [probeStability, setProbeStability] = useState(80);
    const [organCoverage,  setOrganCoverage] = useState(0);
    const [elapsedTime,    setElapsedTime]   = useState(0);
    const [isFrozen,       setIsFrozen]      = useState(false);
    const [feedbackMsg,    setFeedbackMsg]   = useState('Position probe on right mid-axillary line to begin.');
    const [feedbackIdx,    setFeedbackIdx]   = useState(0);

    const stabilityHistRef = useRef<number[]>([]);
    const currentMode = (visualizationSettings.mode || 'beginner') as TrainingMode;

    // ── Quality Metrics ───────────────────────────────────────────────────────
    const updateQualityMetrics = useCallback(() => {
        if (isFrozen) return;
        const contact = probePhysics.surfaceContact.isInContact ? 100 : 0;
        stabilityHistRef.current.push(contact);
        if (stabilityHistRef.current.length > 20) stabilityHistRef.current.shift();
        const stability = stabilityHistRef.current.length > 0
            ? Math.round(stabilityHistRef.current.reduce((a, b) => a + b, 0) / stabilityHistRef.current.length)
            : 80;
        
        setProbeStability(stability);
        
        // Only set fallback simulated metrics if there is no live AI feedback yet
        if (!currentFeedback) {
            setScanQuality(Math.min(100, Math.round(contact * 0.6 + stability * 0.4)));
            setOrganCoverage(prev => {
                const delta = probePhysics.surfaceContact.isInContact ? Math.random() * 1.5 : 0;
                return Math.min(100, parseFloat((prev + delta).toFixed(1)));
            });
        }
    }, [probePhysics, isFrozen, currentFeedback]);

    // ── Update metrics/suggestions from AI Feedback ───────────────────────────
    useEffect(() => {
        if (!currentFeedback) return;
        
        // Scan Quality from deep learning quality score
        setScanQuality(Math.round(currentFeedback.qualityScore));
        
        // Live Suggested Recommendation from PPO Guidance Agent
        if (currentFeedback.guidanceSteps && currentFeedback.guidanceSteps.length > 0) {
            setFeedbackMsg(currentFeedback.guidanceSteps[0]);
        } else if (currentFeedback.justification) {
            setFeedbackMsg(currentFeedback.justification);
        }
        
        // Organ Coverage (Dynamic calculation based on progressChecklist)
        if (currentFeedback.progressChecklist) {
            const totalChecks = Object.keys(currentFeedback.progressChecklist).length;
            const checked = Object.values(currentFeedback.progressChecklist).filter(Boolean).length;
            if (totalChecks > 0) {
                setOrganCoverage(Math.round((checked / totalChecks) * 100));
            }
        }
    }, [currentFeedback]);

    // ── Voice Guidance for Volume 35 ──────────────────────────────────────────
    useEffect(() => {
        if (sessionStatus === 'running' && visualizationSettings.showGuidance && currentMode !== 'advanced' && feedbackMsg) {
            const speak = (text: string) => {
                window.speechSynthesis.cancel();
                const utterance = new SpeechSynthesisUtterance(text);
                utterance.rate = 1.0;
                utterance.pitch = 1.0;
                utterance.volume = 0.8;
                window.speechSynthesis.speak(utterance);
            };
            
            if (!feedbackMsg.startsWith('Snapshot saved') && !feedbackMsg.startsWith('Probe reset')) {
                speak(feedbackMsg);
            }
        }
    }, [feedbackMsg, sessionStatus, visualizationSettings.showGuidance, currentMode]);

    // ── Dynamic Guidance Feedback (fallback if no AI feedback) ─────────────────
    useEffect(() => {
        if (!isVolume35 || sessionStatus !== 'running' || currentFeedback) return;
        const id = setInterval(() => {
            setFeedbackMsg(GUIDANCE_MESSAGES[feedbackIdx % GUIDANCE_MESSAGES.length]);
            setFeedbackIdx(i => i + 1);
        }, 4500);
        return () => clearInterval(id);
    }, [sessionStatus, isVolume35, feedbackIdx, currentFeedback]);

    // ── Mode Change ───────────────────────────────────────────────────────────
    const handleModeChange = useCallback((mode: TrainingMode) => {
        setVisualizationMode(mode);
        setShowTransition(true);
        setTimeout(() => setShowTransition(false), 1500);
    }, [setVisualizationMode]);

    // ── Probe Type Change ─────────────────────────────────────────────────────
    const handleProbeTypeChange = useCallback((type: ProbeType) => {
        setProbeType(type);
        useAppStore.setState({
            imagingSettings: {
                ...imagingSettings,
                frequency: type === 'curvilinear' ? 3.5 : 10,
                depth:     type === 'curvilinear' ? 18  : 8,
            },
        });
    }, [imagingSettings]);

    // ── Freeze ────────────────────────────────────────────────────────────────
    const handleFreeze = useCallback(() => {
        setIsFrozen(f => !f);
    }, []);

    // ── Snapshot ──────────────────────────────────────────────────────────────
    const handleSnapshot = useCallback(() => {
        if (!currentFrame) return;
        addSnapshot({
            id: `snap-${Date.now()}`,
            image: currentFrame,
            timestamp: Date.now(),
            label: `Scan ${new Date().toLocaleTimeString()}`,
            pose: { position: { x: 0, y: 0, z: 0 }, rotation: probeRot },
            qualityScore: scanQuality,
        });
        // Flash feedback
        setFeedbackMsg('Snapshot saved — ' + new Date().toLocaleTimeString());
        setTimeout(() => setFeedbackMsg(GUIDANCE_MESSAGES[feedbackIdx % GUIDANCE_MESSAGES.length]), 3000);
    }, [currentFrame, addSnapshot, probeRot, scanQuality, feedbackIdx]);

    // ── Reset Probe ───────────────────────────────────────────────────────────
    const handleReset = useCallback(() => {
        useAppStore.setState({
            probePos: { x: 0, y: 100, z: 0 },
            probeRot: { pitch: 20, yaw: 0, roll: 0 },
        });
        setOrganCoverage(0);
        setScanQuality(0);
        setElapsedTime(0);
        stabilityHistRef.current = [];
        setFeedbackMsg('Probe reset — position on right mid-axillary line to begin.');
    }, []);

    // ── WS Message Handler ────────────────────────────────────────────────────
    useEffect(() => {
        if (!isVolume35 || !sessionId) return;
        const unsub = wsService.onMessage((msg: WSMessage) => {
            if (msg.type === 'ultrasoundFrame') updateQualityMetrics();
            if (msg.type === 'sessionEvent' && msg.data.event === 'started') {
                setShowTransition(true);
                setTimeout(() => setShowTransition(false), 1800);
            }
        });
        return () => unsub();
    }, [sessionId, isVolume35, updateQualityMetrics]);

    // ── Session Timer ─────────────────────────────────────────────────────────
    useEffect(() => {
        if (!isVolume35 || sessionStatus !== 'running' || isFrozen) return;
        const id = setInterval(() => setElapsedTime(t => t + 1), 1000);
        return () => clearInterval(id);
    }, [sessionStatus, isVolume35, isFrozen]);

    if (!isVolume35) return null;

    const scanInfo = {
        probeType,
        scanPlane: probeRot.roll > 45 ? 'TRANSVERSE' : 'LONGITUDINAL',
        timeStamp: new Date().toLocaleTimeString('en-US', { hour12: false }),
    };

    return (
        <div className={styles.volume35Session}>
            <ModeTransitionOverlay mode={currentMode} visible={showTransition} />

            {/* Dynamic guidance feedback strip */}
            {visualizationSettings.showGuidance && (
                <div className={styles.guidanceFeed}>
                    <span className={styles.guidanceDot} />
                    <span className={styles.guidanceText}>{feedbackMsg}</span>
                </div>
            )}

            <Volume35SimulatorLayout
                volumeViewer={volumeViewer}
                ultrasoundMonitor={
                    <ProfessionalUltrasoundMonitor
                        currentFrame={isFrozen ? currentFrame : currentFrame}
                        imagingSettings={imagingSettings}
                        scanInfo={scanInfo}
                        isFrozen={isFrozen}
                    />
                }
                metrics={
                    <MinimalMetricsDisplay
                        elapsedTime={elapsedTime}
                        scanQuality={scanQuality}
                        probeStability={probeStability}
                        organCoverage={organCoverage}
                    />
                }
                trainingMode={currentMode}
                onModeChange={handleModeChange}
                probeType={probeType}
                onProbeTypeChange={handleProbeTypeChange}
                isInContact={probePhysics.surfaceContact.isInContact}
                pressureLevel={probePhysics.surfaceContact.pressureLevel}
                probeAngle={probeRot}
                elapsedTime={elapsedTime}
                scanQuality={scanQuality}
                organCoverage={organCoverage}
                onFreeze={handleFreeze}
                onSnapshot={handleSnapshot}
                onReset={handleReset}
                onEndSession={() => { window.location.href = '/'; }}
                isFrozen={isFrozen}
                guidanceVisible={visualizationSettings.showGuidance}
                onToggleGuidance={toggleGuidance}
                anatomyHintActive={anatomyHintActive}
                onToggleAnatomyHint={toggleAnatomyHint}
            />

            {loadState === 'error' && (
                <div className={styles.errorMessage}>
                    Volume 35 session could not be initialized. Check backend connection.
                </div>
            )}
        </div>
    );
};

export default Volume35TrainingSession;
