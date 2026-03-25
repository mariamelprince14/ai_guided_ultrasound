import React from 'react';
import { Card } from '@components/ui/Card';
import { Button } from '@components/ui/Button';
import { useAppStore } from '@store/useAppStore';
import { ClipboardCheck, CheckCircle2, AlertCircle, ChevronRight } from 'lucide-react';
import styles from './AssessmentMode.module.css';

export const AssessmentMode: React.FC = () => {
    const { incrementCorrectAnswers, incrementTotalAttempts } = useAppStore();
    const [currentQuestion] = React.useState(0);
    const [selectedOption, setSelectedOption] = React.useState<number | null>(null);
    const [isSubmitted, setIsSubmitted] = React.useState(false);

    // Mock questions updated to match user requirements
    const questions = [
        {
            text: "Evaluate the pathology in this ultrasound view of the liver.",
            options: ["Normal Anatomy", "Hepatic Tumor (HCC)", "Abnormal (Steatosis)", "Cystic Lesion"],
            correct: 1,
            explanation: "The image shows a hyper-echoic mass with irregular borders, consistent with a hepatic tumor."
        },
        {
            text: "Assess the kidney in this longitudinal view.",
            options: ["Normal", "Tumor", "Abnormal (Stone)", "Abnormal (Hydronephrosis)"],
            correct: 0,
            explanation: "The corticomedullary differentiation is well-preserved and no focal lesions or collecting system dilatation is seen."
        }
    ];

    const question = questions[currentQuestion];

    const handleSubmit = () => {
        if (selectedOption === null) return;
        setIsSubmitted(true);
        incrementTotalAttempts();
        if (selectedOption === question.correct) {
            incrementCorrectAnswers();
        }
    };

    const handleNext = () => {
        // Reset for next question (if any)
        setSelectedOption(null);
        setIsSubmitted(false);
    };

    return (
        <div className={styles.container}>
            <Card
                title={<span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><ClipboardCheck size={18} color="var(--color-primary-500)" /> Question {currentQuestion + 1}</span>}
                subtitle="Diagnostic Assessment"
            >
                <div className={styles.content}>
                    <p className={styles.questionText}>{question.text}</p>
                    <div className={styles.options}>
                        {question.options.map((option, index) => (
                            <label
                                key={index}
                                className={`${styles.option} ${selectedOption === index ? styles.selected : ''} ${isSubmitted && index === question.correct ? styles.correct : ''} ${isSubmitted && selectedOption === index && index !== question.correct ? styles.wrong : ''}`}
                            >
                                <input
                                    type="radio"
                                    name="assessment"
                                    checked={selectedOption === index}
                                    onChange={() => !isSubmitted && setSelectedOption(index)}
                                    disabled={isSubmitted}
                                />
                                <span>{option}</span>
                            </label>
                        ))}
                    </div>

                    {!isSubmitted ? (
                        <Button variant="primary" fullWidth onClick={handleSubmit} disabled={selectedOption === null}>
                            Submit Answer
                        </Button>
                    ) : (
                        <div className={styles.feedback}>
                            <div className={selectedOption === question.correct ? styles.correctMsg : styles.wrongMsg}>
                                {selectedOption === question.correct ? (
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><CheckCircle2 size={18} /> Correct</span>
                                ) : (
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><AlertCircle size={18} /> Incorrect</span>
                                )}
                            </div>
                            <p className={styles.explanation}><strong>Explanation:</strong> {question.explanation}</p>
                            <Button variant="secondary" fullWidth onClick={handleNext}>
                                <span style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
                                    Next Question <ChevronRight size={16} />
                                </span>
                            </Button>
                        </div>
                    )}
                </div>
            </Card>
        </div>
    );
};
