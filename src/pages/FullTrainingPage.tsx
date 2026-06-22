/**
 * FullTrainingPage.tsx
 * ─────────────────────
 * Main training workspace. Manages session lifecycle:
 *   1. Shows case selector if no session loaded
 *   2. Calls POST /api/session/create to load the CT volume
 *   3. Opens WebSocket to /ws/{sessionId}
 *   4. Forwards probe updates → WS → receives ultrasound frames
 *
 * Layout:
 *   CENTER → VolumeViewer (3D torso + probe + anatomy)
 *   RIGHT  → UltrasoundViewer (live imaging monitor) + AICoachingPanel
 *   BOTTOM → SessionMetricsDisplay
 */
import React, { useEffect, useState, useCallback } from 'react';
import { useAppStore } from '@store/useAppStore';
import { apiService } from '@services/api';
import { wsService } from '@services/websocket';
import { SimulatorLayout } from '@components/workspace/SimulatorLayout';
import { UltrasoundViewer } from '@components/workspace/UltrasoundViewer';
import { VolumeViewer } from '@components/workspace/VolumeViewer';
import { CaseSelector } from '@components/workspace/CaseSelector';
import { SessionMetricsDisplay } from '@components/workspace/SessionMetricsDisplay';
import type { WSMessage } from '@/types';
import styles from './TrainingPage.module.css';
import '@styles/simulator-theme.css';

type LoadState = 'idle' | 'loading' | 'ready' | 'error' | 'setup';

export const FullTrainingPage: React.FC = () => {
    const {
        selectedCaseId,
        setSelectedCaseId,
        setSessionId,
        setSessionStatus,
        setConnectionStatus,
        updateFrame,
        setVolumeInfo,
        resetSession,
        fetchVolumeData,
        setProbePos,
        setProbeRot,
        updatePose,
        loadVolumeAlignment,
        visualizationSettings,
        updateFeedback,
    } = useAppStore();

    const [loadState, setLoadState] = useState<LoadState>('idle');
    const [isSwitching, setIsSwitching] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);

    // ── WebSocket message handler ───────────────────────────────────────────
    useEffect(() => {
        const unsubscribeMsg = wsService.onMessage((message: WSMessage) => {
            switch (message.type) {
                case 'ultrasoundFrame':
                case 'rawUltrasoundFrame':
                    updateFrame(
                        message.data.image,
                        message.data.sliceIdx != null
                            ? { sliceIdx: message.data.sliceIdx, maxSlices: message.data.maxSlices }
                            : undefined
                    );
                    break;
                case 'aiFeedback':
                    updateFeedback(message.data);
                    break;
                case 'sessionEvent':
                    if (message.data.event === 'started') setSessionStatus('running');
                    if (message.data.event === 'paused') setSessionStatus('paused');
                    if (message.data.event === 'stopped') setSessionStatus('ended');
                    break;
                case 'captureResult':
                    break;
            }
        });

        const unsubscribeConn = wsService.onConnection((status) => {
            if (status === 'connected') setConnectionStatus('connected');
            else if (status === 'disconnected') setConnectionStatus('reconnecting');
            else setConnectionStatus('offline');
        });

        return () => {
            unsubscribeMsg();
            unsubscribeConn();
        };
    }, [updateFrame, setSessionStatus, setConnectionStatus, updateFeedback]);

    // ── Load session ────────────────────────────────────────────────────────
    const handleLoadCase = useCallback(async (caseIdOverride?: string) => {
        const idToLoad = caseIdOverride || selectedCaseId;
        if (!idToLoad) return;
        
        const isInitial = loadState !== 'ready';
        if (isInitial) setLoadState('loading');
        else setIsSwitching(true);

        setLoadError(null);
        
        try {
            // 1. Disconnect and cleanup
            wsService.disconnect();
            resetSession();

            // 2. Create new session
            const res = await apiService.createSession({
                mode: 'full',
                caseId: idToLoad,
                probeType: 'curvilinear',
                targetOrgans: [],
                difficulty: 'beginner',
                visualizationMode: visualizationSettings.mode,
                enableProbePhysics: true,
            });

            // 3. Update state
            setSessionId(res.sessionId);
            setVolumeInfo(res.volumeInfo);
            setSelectedCaseId(idToLoad);
            
            // Initialize probe — for Volume35 start at right kidney anterior surface zone
            const isVol35 = idToLoad === 'test35';
            const initialPos = isVol35 ? {
                x: res.volumeInfo.bounds.center[0] + 60,  // right side (+X)
                y: res.volumeInfo.bounds.center[1],       // mid-height (kidney level)
                z: res.volumeInfo.bounds.center[2] + 80,  // anterior surface (+Z)
            } : {
                x: res.volumeInfo.bounds.center[0],
                y: res.volumeInfo.bounds.center[1],
                z: res.volumeInfo.bounds.center[2],
            };
            const initialRot = { pitch: 15, yaw: 0, roll: 0 };
            
            setProbePos(initialPos);
            setProbeRot(initialRot);
            updatePose({ position: initialPos, rotation: initialRot });

            setSessionStatus('running');
            fetchVolumeData(idToLoad);
            loadVolumeAlignment(idToLoad);

            // 4. Connect WebSocket
            wsService.connect(res.sessionId);
            
            if (isInitial) setLoadState('ready');
        } catch (err: unknown) {
            const msg = (err as { message?: string })?.message || 'Failed to load case';
            setLoadError(msg);
            if (isInitial) setLoadState('error');
        } finally {
            setIsSwitching(false);
        }
    }, [selectedCaseId, loadState, resetSession, setSessionId, setVolumeInfo, setSelectedCaseId, setSessionStatus, fetchVolumeData, setProbePos, setProbeRot, updatePose, loadVolumeAlignment, visualizationSettings.mode]);

    // ── Cleanup on unmount ──────────────────────────────────────────────────
    useEffect(() => {
        return () => {
            wsService.disconnect();
        };
    }, []);

    // ── Render: pre-session setup ────────────────────────────────────────────
    if (loadState === 'idle' || loadState === 'error') {
        return (
            <div className={styles.setupScreen}>
                <div className={styles.setupCard}>
                    <h2 className={styles.setupTitle}>
                        <span className={styles.setupIcon}>🩻</span>
                        Load CT Volume
                    </h2>
                    <p className={styles.setupDesc}>
                        Select a CT case from the dataset. The volume will be loaded into
                        memory for real-time ultrasound slice simulation.
                    </p>

                    <CaseSelector
                        onSelect={(id) => setSelectedCaseId(id)}
                        className={styles.caseSelector}
                    />

                    {loadError && (
                        <div className={styles.loadError}>
                            <span>⚠ {loadError}</span>
                            <p className={styles.loadErrorHint}>
                                Make sure the backend is running: <code>backend\start.bat</code>
                            </p>
                        </div>
                    )}

                    <button
                        className={styles.loadButton}
                        onClick={() => handleLoadCase()}
                        disabled={!selectedCaseId}
                    >
                        Load Case & Start Training
                    </button>
                </div>
            </div>
        );
    }

    // ── Render: loading ──────────────────────────────────────────────────────
    if ((loadState as string) === 'loading') {
        return (
            <div className={styles.loadingScreen}>
                <div className={styles.loadingCard}>
                    <div className={styles.loadingSpinner} />
                    <p className={styles.loadingText}>Loading CT volume...</p>
                    <p className={styles.loadingSubtext}>
                        Case <strong>{selectedCaseId}</strong> — first load may take a few seconds
                    </p>
                </div>
            </div>
        );
    }

    // ── Render: training workspace ───────────────────────────────────────────
    return (
        <div className={`${styles.trainingPage} ${isSwitching ? styles.isSwitching : ''}`}>
            {isSwitching && (
                <div className={styles.loadingOverlay}>
                    <div className={styles.loadingCard}>
                        <div className={styles.loadingSpinner} />
                        <p>Switching Anatomy...</p>
                    </div>
                </div>
            )}

            <SimulatorLayout
                viewport={
                    /* CENTER: Large immersive 3D simulation */
                    <VolumeViewer />
                }
                rightPanel={
                    /* RIGHT: Live ultrasound imaging monitor */
                    <UltrasoundViewer />
                }
                bottomBar={<SessionMetricsDisplay />}
            />
        </div>
    );
};
