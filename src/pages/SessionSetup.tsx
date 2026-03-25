import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '@store/useAppStore';
import { apiService } from '@services/api';
import { wsService } from '@services/websocket';
import { Card } from '@components/ui/Card';
import { Button } from '@components/ui/Button';
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
import type { CTVolume, ProbeType, Difficulty, SessionConfig } from '@/types';
import styles from './SessionSetup.module.css';

// Mock CT volumes (replace with API call in production)
const mockCTVolumes: CTVolume[] = Array.from({ length: 40 }, (_, i) => ({
    id: `ct-${(i + 1).toString().padStart(3, '0')}`,
    name: `CT Abdomen Volume ${i + 1}`,
    voxelSpacing: [0.5 + Math.random() * 0.2, 0.5 + Math.random() * 0.2, 1.0 + Math.random() * 0.5],
    sliceCount: 150 + Math.floor(Math.random() * 150),
    availableOrgans: [...ABDOMINAL_ORGANS]
        .map((o: string) => o.toLowerCase())
        .sort(() => 0.5 - Math.random())
        .slice(0, 3 + Math.floor(Math.random() * 4)),
}));

const availableOrgans = ABDOMINAL_ORGANS.map((o: string) => o.toLowerCase());

export const SessionSetup: React.FC = () => {
    const navigate = useNavigate();
    const { selectedMode, setConfig, setSessionId, setSessionStatus, setConnectionStatus } =
        useAppStore();

    const [ctVolume, setCTVolume] = useState<CTVolume | null>(null);
    const [probeType, setProbeType] = useState<ProbeType>('curvilinear');
    const [targetOrgans, setTargetOrgans] = useState<string[]>([]);
    const [difficulty, setDifficulty] = useState<Difficulty>('beginner');
    const [sessionLabel, setSessionLabel] = useState('');
    const [errors, setErrors] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const handleOrganToggle = (organ: string) => {
        setTargetOrgans((prev) =>
            prev.includes(organ)
                ? prev.filter((o) => o !== organ)
                : [...prev, organ]
        );
    };

    const handleStartSession = async () => {
        if (!selectedMode || !ctVolume) {
            setErrors(['Please complete all required fields']);
            return;
        }

        const config: Partial<SessionConfig> = {
            mode: selectedMode,
            ctVolume,
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
            setSessionStatus('running');

            // Connect WebSocket
            wsService.connect(response.wsUrl);
            wsService.onConnectionStatus((status) => {
                setConnectionStatus(status);
            });

            navigate('/workspace');
        } catch (error) {
            console.error('Failed to create session:', error);
            setErrors(['Failed to create session. Please try again.']);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <h1 style={{ display: 'flex', alignItems: 'center', gap: '12px', justifyContent: 'center' }}>
                    <Settings color="var(--color-primary-500)" /> Session Setup
                </h1>
                <p className="text-muted">
                    Configure your training session parameters
                </p>
            </div>

            <div className={styles.grid}>
                <div className={styles.formSection}>
                    {/* CT Volume Selection */}
                    <Card title={<span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Database size={18} /> CT Volume Selection</span>}>
                        <div className={styles.formGroup}>
                            <label className={styles.label}>Select Volume *</label>
                            <select
                                className={styles.select}
                                value={ctVolume?.id || ''}
                                onChange={(e) => {
                                    const selected = mockCTVolumes.find((v) => v.id === e.target.value);
                                    setCTVolume(selected || null);
                                }}
                            >
                                <option value="">-- Select a CT volume --</option>
                                {mockCTVolumes.map((volume) => (
                                    <option key={volume.id} value={volume.id}>
                                        {volume.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {ctVolume && (
                            <div className={styles.metadata}>
                                <h4>
                                    <Info size={14} style={{ marginRight: '6px' }} />
                                    Volume Metadata
                                </h4>
                                <div className={styles.metadataGrid}>
                                    <div>
                                        <span className={styles.metadataLabel}>Volume ID:</span>
                                        <span>{ctVolume.id}</span>
                                    </div>
                                    <div>
                                        <span className={styles.metadataLabel}>Voxel Spacing:</span>
                                        <span>{ctVolume.voxelSpacing.join(' × ')} mm</span>
                                    </div>
                                    <div>
                                        <span className={styles.metadataLabel}>Slice Count:</span>
                                        <span>{ctVolume.sliceCount}</span>
                                    </div>
                                    <div>
                                        <span className={styles.metadataLabel}>Available Organs:</span>
                                        <span>{ctVolume.availableOrgans.join(', ')}</span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </Card>

                    {/* Probe Type */}
                    <Card title={<span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Radio size={18} /> Probe Type</span>}>
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
                    <Card title={<span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Dna size={18} /> Abdominal Target Organ(s)</span>}>
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
                    <Card title={<span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Gauge size={18} /> Difficulty Level</span>}>
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
                    <Card title={<span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Tag size={18} /> Session Label (Optional)</span>}>
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
                    <Card title={<span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><ListTodo size={18} /> Setup Summary</span>} className={styles.stickyCard}>
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
                                    {ctVolume?.name || 'Not selected'}
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
                            disabled={isLoading || !ctVolume || targetOrgans.length === 0}
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
    );
};
