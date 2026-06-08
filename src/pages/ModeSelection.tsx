import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '@store/useAppStore';
import { Button } from '@components/ui/Button';
import {
    Monitor,
    ClipboardCheck,
    ScanEye,
    ArrowRight,
    AlertTriangle,
    CheckCircle2,
    Settings
} from 'lucide-react';
import type { TrainingMode } from '@/types';
import clsx from 'clsx';
import styles from './ModeSelection.module.css';

interface ModeCardData {
    mode: TrainingMode;
    icon: React.ReactNode;
    title: string;
    description: string;
    whatYouDo: string;
    expectedOutputs: string[];
}

const modeCards: ModeCardData[] = [
    {
        mode: 'full',
        icon: <Monitor size={48} color="var(--color-primary-500)" />,
        title: 'Abdominal Training Mode',
        description:
            'Real-time ultrasound simulation of abdominal organs with AI-guided probe manipulation.',
        whatYouDo:
            'Manipulate a virtual probe to acquire optimal ultrasound views of abdominal target organs.',
        expectedOutputs: [
            'Real-time quality scores',
            'AI-guided probe positioning',
            'View recognition feedback',
            'Performance metrics',
        ],
    },
    {
        mode: 'assessment',
        icon: <ClipboardCheck size={48} color="var(--color-primary-500)" />,
        title: 'Clinical Case Assessment',
        description:
            'Simulated abdominal ultrasound cases with abnormality detection and diagnostic questions.',
        whatYouDo:
            'Answer multiple-choice questions about ultrasound images to test your diagnostic knowledge.',
        expectedOutputs: [
            'Correct/incorrect feedback',
            'Detailed explanations',
            'Score tracking',
            'Knowledge assessment',
        ],
    },
    {
        mode: 'identification',
        icon: <ScanEye size={48} color="var(--color-primary-500)" />,
        title: 'Abdominal Anatomy ID',
        description: 'Recognition training for abdominal organs and anatomical views.',
        whatYouDo:
            'Identify organs, anatomical views, and probe types from ultrasound images.',
        expectedOutputs: [
            'Instant feedback',
            'Recognition accuracy',
            'Hints for beginners',
            'Skill progression',
        ],
    },
];

export const ModeSelection: React.FC = () => {
    const navigate = useNavigate();
    const { selectedMode, setSelectedMode } = useAppStore();

    const handleModeSelect = (mode: TrainingMode) => {
        setSelectedMode(mode);
    };

    const handleContinue = () => {
        if (selectedMode) {
            navigate('/setup');
        }
    };

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <h1 className={styles.title}>AI-Guided Ultrasound Training System</h1>
                <p className={styles.subtitle}>
                    Real-time scanning optimization and skill transfer (training-only)
                </p>
                <div className={styles.disclaimer}>
                    <AlertTriangle size={16} /> Training system only. No diagnostic decision support.
                </div>
            </div>

            <div className={styles.modesGrid}>
                {modeCards.map((card) => (
                    <div
                        key={card.mode}
                        onClick={() => handleModeSelect(card.mode)}
                        className={clsx(
                            styles.modeCard,
                            selectedMode === card.mode && styles.selected
                        )}
                    >
                        <div className={styles.cardIcon}>{card.icon}</div>
                        <h3 className={styles.cardTitle}>{card.title}</h3>
                        <p className={styles.cardDescription}>{card.description}</p>

                        <div className={styles.cardSection}>
                            <h4 className={styles.sectionTitle}>Training Focus</h4>
                            <p className={styles.sectionText}>{card.whatYouDo}</p>
                        </div>

                        <div className={styles.cardSection}>
                            <h4 className={styles.sectionTitle}>Learning Outcomes</h4>
                            <ul className={styles.outputList}>
                                {card.expectedOutputs.map((output, index) => (
                                    <li key={index}>
                                        <CheckCircle2 size={14} className={styles.outputIcon} />
                                        {output}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                ))}
            </div>

            <div className={styles.footer}>
                <Button
                    variant="primary"
                    size="large"
                    onClick={handleContinue}
                    disabled={!selectedMode}
                    fullWidth
                    style={{
                        padding: '1.25rem',
                        fontSize: '1.1rem',
                        fontWeight: '600',
                        borderRadius: '16px',
                        boxShadow: selectedMode ? '0 10px 20px rgba(61, 134, 204, 0.3)' : 'none'
                    }}
                >
                    <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        Initialize Training Session <ArrowRight size={20} />
                    </span>
                </Button>
                
                <div 
                    className={styles.devLink}
                    onClick={() => navigate('/registration')}
                >
                    <Settings size={14} />
                    Calibration & System Registration
                </div>
            </div>
        </div>
    );
};
