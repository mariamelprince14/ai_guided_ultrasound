import React from 'react';
import { Card } from '@components/ui/Card';
import { Button } from '@components/ui/Button';
import { useAppStore } from '@store/useAppStore';
import { Search, Lightbulb, CheckCircle2, AlertCircle, RefreshCw, Dna } from 'lucide-react';
import { ABDOMINAL_ORGANS } from '@constants/organs';
import styles from './IdentificationMode.module.css';

export const IdentificationMode: React.FC = () => {
    const { incrementCorrectAnswers, incrementTotalAttempts, config } = useAppStore();
    const [feedback, setFeedback] = React.useState<{ correct: boolean, msg: string } | null>(null);

    const targets = [...ABDOMINAL_ORGANS];

    const handleIdentify = (id: string) => {
        const isCorrect = id === "Liver"; // Mock target
        setFeedback({
            correct: isCorrect,
            msg: isCorrect ? "Correct! This is the Liver." : `Incorrect. This is not the ${id}.`
        });
        incrementTotalAttempts();
        if (isCorrect) incrementCorrectAnswers();
    };

    return (
        <Card
            title={<span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Search size={18} color="var(--color-primary-500)" /> Identification Training</span>}
            subtitle="Recognize anatomical structures"
        >
            <div className={styles.content}>
                <p className={styles.instruction}>Identify the organ highlighted in the current view:</p>

                <div className={styles.targetGrid}>
                    {targets.map(target => (
                        <button
                            key={target}
                            className={styles.targetButton}
                            onClick={() => handleIdentify(target)}
                            disabled={!!feedback}
                        >
                            <span style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
                                <Dna size={14} className={styles.targetIcon} />
                                {target}
                            </span>
                        </button>
                    ))}
                </div>

                {feedback && (
                    <div className={feedback.correct ? styles.correct : styles.wrong}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {feedback.correct ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                            {feedback.msg}
                        </div>
                        <Button variant="secondary" size="small" className={styles.next} onClick={() => setFeedback(null)}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <RefreshCw size={14} /> Try Next View
                            </span>
                        </Button>
                    </div>
                )}

                {config?.difficulty === 'beginner' && !feedback && (
                    <Button variant="secondary" size="small" className={styles.hint}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Lightbulb size={14} /> Get Hint
                        </span>
                    </Button>
                )}
            </div>
        </Card>
    );
};
