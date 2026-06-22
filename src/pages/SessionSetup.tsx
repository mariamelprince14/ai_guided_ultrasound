import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '@store/useAppStore';
import { apiService } from '@services/api';
import { wsService } from '@services/websocket';
import { Card } from '@components/ui/Card';
import { Button } from '@components/ui/Button';
import { HomepageNavbar } from '@components/layout/HomepageNavbar';
import { SignInModal } from '@components/ui/SignInModal';
import { SignUpModal } from '@components/ui/SignUpModal';
import {
    Settings,
    Database,
    Radio,
    Dna,
    Gauge,
    Tag,
    ListTodo,
    Play,
    Info,
    Activity
} from 'lucide-react';
import { validateSessionConfig } from '@utils/validation';
import { ABDOMINAL_ORGANS } from '../constants/organs';
import type { ProbeType, Difficulty, SessionConfig } from '@/types';
import { CaseSelector } from '@components/workspace/CaseSelector';
import styles from './SessionSetup.module.css';

const availableOrgans = ABDOMINAL_ORGANS.map((o: string) => o.toLowerCase());

export const SessionSetup: React.FC = () => {
    const navigate = useNavigate();
    const { 
        selectedMode, setConfig, setSessionId, setSessionStatus, setConnectionStatus,
        cases, selectedCaseId, setSelectedCaseId, setVolumeInfo
    } = useAppStore();

    const [probeType, setProbeType] = useState<ProbeType>('curvilinear');
    const [targetOrgans, setTargetOrgans] = useState<string[]>([]);
    const [difficulty, setDifficulty] = useState<Difficulty>('beginner');
    const [sessionLabel, setSessionLabel] = useState('');
    const [errors, setErrors] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    // Sign In / Sign Up Modals state
    const [showSignIn, setShowSignIn] = useState(false);
    const [showSignUp, setShowSignUp] = useState(false);

    const handleOrganToggle = (organ: string) => {
        setTargetOrgans((prev) =>
            prev.includes(organ)
                ? prev.filter((o) => o !== organ)
                : [...prev, organ]
        );
    };

    const handleStartSession = async () => {
        if (!selectedMode || !selectedCaseId) {
            setErrors(['Please complete all required fields']);
            return;
        }

        const config: Partial<SessionConfig> = {
            mode: selectedMode,
            caseId: selectedCaseId,
            probeType,
            targetOrgans,
            difficulty,
            sessionLabel: sessionLabel || undefined,
        };

        const validationErrors = validateSessionConfig(config);
        if (validationErrors.length > 0) {
            setErrors(validationErrors.map((e) => e.message));
            return;
        }

        setIsLoading(true);
        setErrors([]);

        try {
            const response = await apiService.createSession(config as SessionConfig);

            setConfig(config as SessionConfig);
            setSessionId(response.sessionId);
            setVolumeInfo(response.volumeInfo);
            setSessionStatus('running');

            // Connect WebSocket
            wsService.disconnect();
            wsService.connect(response.sessionId);
            wsService.onConnection((status) => {
                if (status === 'connected') setConnectionStatus('connected');
                else if (status === 'disconnected') setConnectionStatus('reconnecting');
                else setConnectionStatus('offline');
            });

            navigate('/workspace');
        } catch (error) {
            console.error('Failed to create session:', error);
            setErrors(['Failed to create session. Please try again.']);
        } finally {
            setIsLoading(false);
        }
    };

    const selectedCase = cases.find(c => c.id === selectedCaseId);

    return (
        <div className={styles.homepage}>
            {/* Background glassmorphism blobs */}
            <div className={styles.glassBlob1} />
            <div className={styles.glassBlob2} />
            <div className={styles.glassBlob3} />

            <HomepageNavbar 
                onSignInClick={() => {
                    setShowSignUp(false);
                    setShowSignIn(true);
                }} 
                onSignUpClick={() => {
                    setShowSignIn(false);
                    setShowSignUp(true);
                }} 
            />

            <div className={styles.container}>
                <div className={styles.header}>
                    <h1 className={styles.title}>
                        <span className={styles.titleLine}>Session Setup</span>
                    </h1>
                    <p className={styles.subtitle}>
                        Configure your training session parameters
                    </p>
                </div>

                <div className={styles.grid}>
                    <div className={styles.formSection}>
                        {/* CT Volume Selection */}
                        <Card className={styles.setupCard} title={<span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Database size={18} /> CT Volume Selection</span>}>
                            <div className={styles.formGroup}>
                                <CaseSelector 
                                    onSelect={(id) => setSelectedCaseId(id)}
                                />
                            </div>

                            {selectedCase && (
                                <div className={styles.metadata}>
                                    <h4>
                                        <Info size={14} style={{ marginRight: '6px' }} />
                                        Volume Metadata
                                    </h4>
                                    <div className={styles.metadataGrid}>
                                        <div>
                                            <span className={styles.metadataLabel}>Volume ID:</span>
                                            <span>{selectedCase.id}</span>
                                        </div>
                                        <div>
                                            <span className={styles.metadataLabel}>Name:</span>
                                            <span>{selectedCase.name}</span>
                                        </div>
                                        <div>
                                            <span className={styles.metadataLabel}>Segmentation:</span>
                                            <span>{selectedCase.has_segmentation ? 'Available' : 'None'}</span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </Card>

                        {/* Probe Type */}
                        <Card className={styles.setupCard} title={<span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Radio size={18} /> Probe Type</span>}>
                            <div className={styles.radioGroup}>
                                <label className={styles.radioLabel}>
                                    <input
                                        type="radio"
                                        name="probeType"
                                        value="linear"
                                        checked={probeType === 'linear'}
                                        onChange={() => setProbeType('linear')}
                                    />
                                    <span>Linear</span>
                                </label>
                                <label className={styles.radioLabel}>
                                    <input
                                        type="radio"
                                        name="probeType"
                                        value="curvilinear"
                                        checked={probeType === 'curvilinear'}
                                        onChange={() => setProbeType('curvilinear')}
                                    />
                                    <span>Curvilinear</span>
                                </label>
                            </div>
                        </Card>

                        {/* Target Organs */}
                        <Card className={styles.setupCard} title={<span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Dna size={18} /> Abdominal Target Organ(s)</span>}>
                            <p className={styles.hint}>
                                Select organs that will influence guidance objectives
                            </p>
                            <div className={styles.chipGroup}>
                                {availableOrgans.map((organ: string) => (
                                    <button
                                        key={organ}
                                        className={`${styles.chip} ${targetOrgans.includes(organ) ? styles.chipSelected : ''
                                            }`}
                                        onClick={() => handleOrganToggle(organ)}
                                    >
                                        {organ}
                                    </button>
                                ))}
                            </div>
                        </Card>

                        {/* Difficulty Level */}
                        <Card className={styles.setupCard} title={<span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Gauge size={18} /> Difficulty Level</span>}>
                            <div className={styles.radioGroup}>
                                <label className={styles.radioLabel}>
                                    <input
                                        type="radio"
                                        name="difficulty"
                                        value="beginner"
                                        checked={difficulty === 'beginner'}
                                        onChange={() => setDifficulty('beginner')}
                                    />
                                    <span>
                                        <strong>Beginner</strong> - Relaxed thresholds, more hints
                                    </span>
                                </label>
                                <label className={styles.radioLabel}>
                                    <input
                                        type="radio"
                                        name="difficulty"
                                        value="intermediate"
                                        checked={difficulty === 'intermediate'}
                                        onChange={() => setDifficulty('intermediate')}
                                    />
                                    <span>
                                        <strong>Intermediate</strong> - Moderate thresholds
                                    </span>
                                </label>
                                <label className={styles.radioLabel}>
                                    <input
                                        type="radio"
                                        name="difficulty"
                                        value="advanced"
                                        checked={difficulty === 'advanced'}
                                        onChange={() => setDifficulty('advanced')}
                                    />
                                    <span>
                                        <strong>Advanced</strong> - Strict thresholds, reduced hints
                                    </span>
                                </label>
                            </div>
                        </Card>

                        {/* Session Label */}
                        <Card className={styles.setupCard} title={<span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Tag size={18} /> Session Label (Optional)</span>}>
                            <input
                                type="text"
                                className={styles.input}
                                placeholder="e.g., Practice Session 1"
                                value={sessionLabel}
                                onChange={(e) => setSessionLabel(e.target.value)}
                            />
                        </Card>
                    </div>

                    {/* Preview Summary */}
                    <div className={styles.summarySection}>
                        <Card title={<span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><ListTodo size={18} /> Setup Summary</span>} className={`${styles.setupCard} ${styles.stickyCard}`}>
                            <div className={styles.summaryContent}>
                                <div className={styles.summaryItem}>
                                    <span className={styles.summaryLabel}>Mode:</span>
                                    <span className={styles.summaryValue}>
                                        {selectedMode || 'Not selected'}
                                    </span>
                                </div>
                                <div className={styles.summaryItem}>
                                    <span className={styles.summaryLabel}>CT Volume:</span>
                                    <span className={styles.summaryValue}>
                                        {selectedCase?.name || 'Not selected'}
                                    </span>
                                </div>
                                <div className={styles.summaryItem}>
                                    <span className={styles.summaryLabel}>Probe Type:</span>
                                    <span className={styles.summaryValue}>{probeType}</span>
                                </div>
                                <div className={styles.summaryItem}>
                                    <span className={styles.summaryLabel}>Abdominal Organs:</span>
                                    <span className={styles.summaryValue}>
                                        {targetOrgans.length > 0
                                            ? targetOrgans.join(', ')
                                            : 'None selected'}
                                    </span>
                                </div>
                                <div className={styles.summaryItem}>
                                    <span className={styles.summaryLabel}>Difficulty:</span>
                                    <span className={styles.summaryValue}>{difficulty}</span>
                                </div>
                                {sessionLabel && (
                                    <div className={styles.summaryItem}>
                                        <span className={styles.summaryLabel}>Label:</span>
                                        <span className={styles.summaryValue}>{sessionLabel}</span>
                                    </div>
                                )}
                            </div>

                            {errors.length > 0 && (
                                <div className={styles.errors}>
                                    {errors.map((error, index) => (
                                        <div key={index} className={styles.error}>
                                            {error}
                                        </div>
                                    ))}
                                </div>
                            )}

                            <Button
                                variant="primary"
                                size="large"
                                fullWidth
                                onClick={handleStartSession}
                                disabled={isLoading || !selectedCaseId || targetOrgans.length === 0}
                            >
                                <span style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
                                    {isLoading ? <Activity size={20} className={styles.spin} /> : <Play size={20} fill="currentColor" />}
                                    {isLoading ? 'Starting Session...' : 'Start Session'}
                                </span>
                            </Button>
                        </Card>
                    </div>
                </div>
            </div>

            {/* Sign In / Sign Up Modals */}
            <SignInModal
                isOpen={showSignIn}
                onClose={() => setShowSignIn(false)}
                onSwitchToSignUp={() => {
                    setShowSignIn(false);
                    setShowSignUp(true);
                }}
            />
            <SignUpModal
                isOpen={showSignUp}
                onClose={() => setShowSignUp(false)}
                onSwitchToSignIn={() => {
                    setShowSignUp(false);
                    setShowSignIn(true);
                }}
            />
        </div>
    );
};
