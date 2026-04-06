/**
 * FullTrainingPage.tsx
 * ─────────────────────
 * Main training workspace. Manages session lifecycle:
 *   1. Shows case selector if no session loaded
 *   2. Calls POST /api/session/create to load the CT volume
 *   3. Opens WebSocket to /ws/{sessionId}
 *   4. Forwards probe updates → WS → receives ultrasound frames
 */
import React, { useEffect, useState, useCallback } from 'react';
import { useAppStore } from '@store/useAppStore';
import { apiService } from '@services/api';
import { wsService } from '@services/websocket';
import { WorkspaceLayout } from '@components/workspace/WorkspaceLayout';
import { UltrasoundViewer } from '@components/workspace/UltrasoundViewer';
import { ProbeControls } from '@components/workspace/ProbeControls';
import { GuidancePanel } from '@components/workspace/GuidancePanel';
import { CaseSelector } from '@components/workspace/CaseSelector';
import type { WSMessage } from '@/types';
import styles from './TrainingPage.module.css';

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
        volumeInfo,
        resetSession,
    } = useAppStore();

    const [loadState, setLoadState] = useState<LoadState>('idle');
    const [loadError, setLoadError] = useState<string | null>(null);
    const [captureCount, setCaptureCount] = useState(0);

    // ── WebSocket message handler ───────────────────────────────────────────
    useEffect(() => {
        const unsubscribeMsg = wsService.onMessage((message: WSMessage) => {
            switch (message.type) {
                case 'ultrasoundFrame':
                    updateFrame(message.data.image);
                    break;
                case 'sessionEvent':
                    if (message.data.event === 'started') setSessionStatus('running');
                    if (message.data.event === 'paused') setSessionStatus('paused');
                    if (message.data.event === 'stopped') setSessionStatus('ended');
                    break;
                case 'captureResult':
                    if (message.data.success) setCaptureCount(n => n + 1);
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
    }, [updateFrame, setSessionStatus, setConnectionStatus]);

    // ── Load session ────────────────────────────────────────────────────────
    const handleLoadCase = useCallback(async () => {
        if (!selectedCaseId) return;
        setLoadState('loading');
        setLoadError(null);
        resetSession();

        try {
            const res = await apiService.createSession({
                mode: 'full',
                caseId: selectedCaseId,
                probeType: 'curvilinear',
                targetOrgans: [],
                difficulty: 'beginner',
            });
            setSessionId(res.sessionId);
            setVolumeInfo(res.volumeInfo);
            setSessionStatus('running');

            // Connect WebSocket
            wsService.disconnect();
            wsService.connect(res.sessionId);
            setLoadState('ready');
        } catch (err: unknown) {
            const msg = (err as { message?: string })?.message || 'Failed to load case';
            setLoadError(msg);
            setLoadState('error');
        }
    }, [selectedCaseId, resetSession, setSessionId, setVolumeInfo, setSessionStatus]);

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
                        onClick={handleLoadCase}
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
    const renderHeader = () => (
        <div className={styles.workspaceHeader}>
            <div className={styles.caseTag}>
                🩻 {selectedCaseId}
                {volumeInfo?.hasSegmentation && (
                    <span className={styles.segBadge}>SEG</span>
                )}
            </div>
            <div className={styles.volumeMeta}>
                {volumeInfo && (
                    <>
                        <span>{volumeInfo.shape.join(' × ')} voxels</span>
                        <span>·</span>
                        <span>{volumeInfo.voxelSpacing.map(v => v.toFixed(1)).join('×')} mm</span>
                    </>
                )}
            </div>
            <div className={styles.captureCount}>
                📷 {captureCount} captures
            </div>
        </div>
    );

    return (
        <div className={styles.trainingPage}>
            <WorkspaceLayout
                header={renderHeader()}
                leftPanel={
                    <ProbeControls />
                }
                centerPanel={
                    <div className={styles.viewerContainer}>
                        <UltrasoundViewer />
                    </div>
                }
                rightPanel={
                    <GuidancePanel />
                }
            />
        </div>
    );
};
