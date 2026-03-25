import React from 'react';
import { Card } from '@components/ui/Card';
import { useAppStore } from '@store/useAppStore';
import {
    Brain,
    ChevronRight,
    CheckCircle2,
    Circle,
    Trophy,
    Target,
    Activity
} from 'lucide-react';
import styles from './GuidancePanel.module.css';

export const GuidancePanel: React.FC = () => {
    const { currentFeedback, metrics } = useAppStore();

    if (!currentFeedback) {
        return (
            <Card title={<span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Brain size={18} color="var(--color-primary-500)" /> AI Guidance</span>}>
                <div className={styles.emptyState}>
                    <p className="text-muted">Awaiting stream for guidance...</p>
                </div>
            </Card>
        );
    }

    return (
        <div className={styles.container}>
            <Card title={<span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Brain size={18} color="var(--color-primary-500)" /> AI Guidance</span>}>
                <div className={styles.guidanceSection}>
                    <h4 className={styles.sectionTitle}>Instruction</h4>
                    <ul className={styles.stepsList}>
                        {currentFeedback.guidanceSteps.map((step: string, index: number) => (
                            <li key={index} className={styles.stepItem}>
                                <span className={styles.stepIcon}>
                                    <ChevronRight size={16} />
                                </span>
                                <span>{step}</span>
                            </li>
                        ))}
                    </ul>

                    <div className={styles.justification}>
                        <h5 className={styles.smallTitle}>Justification</h5>
                        <p className={styles.justificationText}>{currentFeedback.justification}</p>
                    </div>
                </div>
            </Card>

            <Card title="Progress Checklist">
                <div className={styles.checklist}>
                    {Object.entries(currentFeedback.progressChecklist).map(([key, value]) => (
                        <div key={key} className={styles.checkItem}>
                            <span className={value ? styles.checkIcon : styles.uncheckIcon}>
                                {value ? <CheckCircle2 size={18} /> : <Circle size={18} />}
                            </span>
                            <span className={value ? styles.checkLabelDone : styles.checkLabel}>
                                {key.replace(/([A-Z])/g, ' $1').replace(/^./, (str) => str.toUpperCase())}
                            </span>
                        </div>
                    ))}
                </div>
            </Card>

            <Card title="Session Statistics">
                <div className={styles.statsGrid}>
                    <div className={styles.statItem}>
                        <Trophy size={16} className={styles.statIcon} />
                        <span className={styles.statLabel}>Best Score</span>
                        <span className={styles.statValue}>{metrics.bestQualityScore}%</span>
                    </div>
                    <div className={styles.statItem}>
                        <Activity size={16} className={styles.statIcon} />
                        <span className={styles.statLabel}>Attempts</span>
                        <span className={styles.statValue}>{metrics.totalAttempts}</span>
                    </div>
                    <div className={styles.statItem}>
                        <Target size={16} className={styles.statIcon} />
                        <span className={styles.statLabel}>Correct</span>
                        <span className={styles.statValue}>{metrics.correctAnswers}</span>
                    </div>
                </div>
            </Card>
        </div>
    );
};
