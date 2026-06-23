import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '@store/useAppStore';
import { questionsDatabase } from '@constants/questionsData';
import type { Question, MultipleChoiceQuestion, NormalVsAbnormalQuestion } from '@constants/questionsData';
import { 
    ClipboardCheck, 
    CheckCircle2, 
    XCircle, 
    AlertCircle, 
    ArrowRight, 
    RotateCcw, 
    Home, 
    Award,
    Check,
    X,
    Eye
} from 'lucide-react';
import styles from './TestMode.module.css';

export const AssessmentPage: React.FC = () => {
    const navigate = useNavigate();
    const { incrementCorrectAnswers, incrementTotalAttempts } = useAppStore();

    /* Test State */
    const [step, setStep] = useState<'intro' | 'test' | 'results'>('intro');
    const [shuffledQuestions, setShuffledQuestions] = useState<Question[]>([]);
    const [currentIdx, setCurrentIdx] = useState<number>(0);
    const [score, setScore] = useState<number>(0);
    
    /* Current Question Answer States */
    const [selectedMcAnswer, setSelectedMcAnswer] = useState<number | null>(null);
    const [selectedNormalAbnormal, setSelectedNormalAbnormal] = useState<{ left: string; right: string }>({ left: '', right: '' });
    const [isNormalLeft, setIsNormalLeft] = useState<boolean>(true); // Shuffle normal vs abnormal position
    const [isSubmitted, setIsSubmitted] = useState<boolean>(false);
    
    /* Logging for review */
    const [userAnswersLog, setUserAnswersLog] = useState<any[]>([]);

    /* Initialize/Shuffle Questions */
    const startNewTest = () => {
        const rawPool = [...questionsDatabase.clinical_case_assessment];
        // Shuffle helper
        const shuffled = rawPool.sort(() => Math.random() - 0.5);
        // Take 20 questions (there are exactly 20 in the database)
        setShuffledQuestions(shuffled.slice(0, 20));
        setCurrentIdx(0);
        setScore(0);
        setUserAnswersLog([]);
        resetQuestionState(shuffled[0]);
        setStep('test');
    };

    const resetQuestionState = (question: Question) => {
        setSelectedMcAnswer(null);
        setSelectedNormalAbnormal({ left: '', right: '' });
        setIsSubmitted(false);
        // Randomize normal left/right for normal_vs_abnormal questions
        if (question && question.type === 'normal_vs_abnormal') {
            setIsNormalLeft(Math.random() > 0.5);
        }
    };

    const currentQuestion = shuffledQuestions[currentIdx];

    const handleSubmit = () => {
        if (!currentQuestion) return;

        let correct = false;
        let userAnswersDisplay = '';
        let correctAnswersDisplay = '';

        if (currentQuestion.type === 'multiple_choice') {
            if (selectedMcAnswer === null) return;
            correct = selectedMcAnswer === currentQuestion.correctIndex;
            userAnswersDisplay = currentQuestion.options[selectedMcAnswer];
            correctAnswersDisplay = currentQuestion.options[currentQuestion.correctIndex];
        } else if (currentQuestion.type === 'normal_vs_abnormal') {
            const { left, right } = selectedNormalAbnormal;
            if (!left || !right) return;

            const expectedLeft = isNormalLeft ? 'normal' : 'abnormal';
            const expectedRight = isNormalLeft ? 'abnormal' : 'normal';

            correct = left === expectedLeft && right === expectedRight;
            userAnswersDisplay = `Left: ${left.toUpperCase()}, Right: ${right.toUpperCase()}`;
            correctAnswersDisplay = `Left: ${expectedLeft.toUpperCase()}, Right: ${expectedRight.toUpperCase()}`;
        }

        setIsSubmitted(true);
        incrementTotalAttempts();

        if (correct) {
            setScore(prev => prev + 1);
            incrementCorrectAnswers();
        }

        setUserAnswersLog(prev => [
            ...prev,
            {
                question: currentQuestion,
                isCorrect: correct,
                userAnswer: userAnswersDisplay,
                correctAnswer: correctAnswersDisplay,
                isNormalLeft: currentQuestion.type === 'normal_vs_abnormal' ? isNormalLeft : undefined
            }
        ]);
    };

    const handleNext = () => {
        if (currentIdx + 1 < shuffledQuestions.length) {
            const nextIndex = currentIdx + 1;
            setCurrentIdx(nextIndex);
            resetQuestionState(shuffledQuestions[nextIndex]);
        } else {
            setStep('results');
        }
    };

    const progressPercent = shuffledQuestions.length > 0 
        ? ((currentIdx + (isSubmitted ? 1 : 0)) / shuffledQuestions.length) * 100 
        : 0;

    /* Get supportive message based on percentage score */
    const getGradeDetails = (scoreFraction: number) => {
        const percentage = scoreFraction * 100;
        if (percentage >= 90) {
            return {
                grade: 'Outstanding',
                message: 'Excellent clinical diagnostic skills! You have successfully mastered this module\'s objectives and demonstrated superb pathological pattern recognition.',
                style: styles.textSuccess
            };
        } else if (percentage >= 70) {
            return {
                grade: 'Competent',
                message: 'Great job! You have a solid grasp of abdominal pathologies and can reliably distinguish normal variations from abnormal clinical cases.',
                style: styles.textPrimary
            };
        } else {
            return {
                grade: 'Needs Review',
                message: 'Good effort! Ultrasound requires high visual familiarity. We recommend reviewing the dataset images and detailed explanations to further build your confidence.',
                style: styles.textError
            };
        }
    };

    return (
        <div className={styles.container}>
            {/* ───────── Step 1: Intro Page ───────── */}
            {step === 'intro' && (
                <div className={styles.introCard}>
                    <div className={styles.introHeader}>
                        <div className={styles.iconWrapper}>
                            <ClipboardCheck size={32} />
                        </div>
                        <h1 className={styles.introTitle}>Clinical Case Assessment</h1>
                        <p className={styles.introSubtitle}>
                            Test your clinical diagnostic skills by evaluating real abdominal ultrasound scans, distinguishing normal from abnormal anatomy, and identifying common pathologies.
                        </p>
                    </div>

                    <div className={styles.sectionDivider} />

                    <div className={styles.objectivesSection}>
                        <h2 className={styles.sectionTitle}>Learning Objectives</h2>
                        <ul className={styles.objectivesList}>
                            <li className={styles.objectiveItem}>
                                <Check className={styles.checkIcon} size={16} />
                                <span>Distinguish normal ultrasound features of the liver, gallbladder, and kidneys from abnormal pathologies.</span>
                            </li>
                            <li className={styles.objectiveItem}>
                                <Check className={styles.checkIcon} size={16} />
                                <span>Identify common abnormality patterns including fatty liver (steatosis), cirrhosis, cysts, calculi (stones), sludge, and hydronephrosis.</span>
                            </li>
                            <li className={styles.objectiveItem}>
                                <Check className={styles.checkIcon} size={16} />
                                <span>Correlate clinical patient cases (symptoms and lab values) with corresponding sonographic findings.</span>
                            </li>
                        </ul>
                    </div>

                    <div className={styles.testMeta}>
                        <div className={styles.metaItem}>
                            <Award size={16} />
                            <span>Total Questions: <strong>20</strong></span>
                        </div>
                        <div className={styles.metaItem}>
                            <Eye size={16} />
                            <span>Format: <strong>Normal/Abnormal Dropdowns & Multiple Choice</strong></span>
                        </div>
                    </div>

                    <div className={styles.sectionDivider} />

                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                        <button className={styles.btnPrimary} onClick={startNewTest}>
                            Start Test <ArrowRight size={16} />
                        </button>
                    </div>
                </div>
            )}

            {/* ───────── Step 2: Active Test ───────── */}
            {step === 'test' && currentQuestion && (
                <div className={styles.testLayout}>
                    {/* Progress Bar & Header */}
                    <div className={styles.testHeader}>
                        <div className={styles.headerTop}>
                            <h2 className={styles.headerTitle}>Clinical Case Assessment</h2>
                            <div className={styles.headerStats}>
                                <span className={styles.statBadge}>
                                    Question {currentIdx + 1} of {shuffledQuestions.length}
                                </span>
                                <span className={styles.statBadge}>
                                    Score: {score}
                                </span>
                            </div>
                        </div>
                        <div className={styles.progressBarOuter}>
                            <div 
                                className={styles.progressBarInner} 
                                style={{ width: `${progressPercent}%` }}
                            />
                        </div>
                    </div>

                    {/* Question Card */}
                    <div className={styles.questionCard}>
                        <h3 className={styles.questionText}>
                            {currentIdx + 1}. {currentQuestion.title}
                        </h3>

                        {/* Rendering: Normal vs Abnormal Side-by-Side Dropdowns */}
                        {currentQuestion.type === 'normal_vs_abnormal' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                <p className={styles.reviewText} style={{ color: 'var(--color-text-secondary)' }}>
                                    Compare the two scans below. Choose "Normal" or "Abnormal" for each image:
                                </p>
                                <div className={styles.comparisonGrid}>
                                    {/* Left Image Column */}
                                    <div className={styles.comparisonItem}>
                                        <span className={styles.imageLabel}>Ultrasound Scan A</span>
                                        <div className={styles.singleImageWrapper}>
                                            <img 
                                                className={styles.singleImage}
                                                src={isNormalLeft ? (currentQuestion as NormalVsAbnormalQuestion).images.normal : (currentQuestion as NormalVsAbnormalQuestion).images.abnormal} 
                                                alt="Scan A"
                                            />
                                        </div>
                                        <select
                                            className={`${styles.dropdownSelect} ${
                                                isSubmitted 
                                                    ? (selectedNormalAbnormal.left === (isNormalLeft ? 'normal' : 'abnormal') ? styles.correct : styles.wrong) 
                                                    : ''
                                            }`}
                                            value={selectedNormalAbnormal.left}
                                            onChange={(e) => !isSubmitted && setSelectedNormalAbnormal(prev => ({ ...prev, left: e.target.value }))}
                                            disabled={isSubmitted}
                                        >
                                            <option value="">-- Select Status --</option>
                                            <option value="normal">Normal</option>
                                            <option value="abnormal">Abnormal</option>
                                        </select>
                                    </div>

                                    {/* Right Image Column */}
                                    <div className={styles.comparisonItem}>
                                        <span className={styles.imageLabel}>Ultrasound Scan B</span>
                                        <div className={styles.singleImageWrapper}>
                                            <img 
                                                className={styles.singleImage}
                                                src={isNormalLeft ? (currentQuestion as NormalVsAbnormalQuestion).images.abnormal : (currentQuestion as NormalVsAbnormalQuestion).images.normal} 
                                                alt="Scan B"
                                            />
                                        </div>
                                        <select
                                            className={`${styles.dropdownSelect} ${
                                                isSubmitted 
                                                    ? (selectedNormalAbnormal.right === (isNormalLeft ? 'abnormal' : 'normal') ? styles.correct : styles.wrong) 
                                                    : ''
                                            }`}
                                            value={selectedNormalAbnormal.right}
                                            onChange={(e) => !isSubmitted && setSelectedNormalAbnormal(prev => ({ ...prev, right: e.target.value }))}
                                            disabled={isSubmitted}
                                        >
                                            <option value="">-- Select Status --</option>
                                            <option value="normal">Normal</option>
                                            <option value="abnormal">Abnormal</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Rendering: Multiple Choice Question */}
                        {currentQuestion.type === 'multiple_choice' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                <div className={styles.imageSection}>
                                    <div className={styles.singleImageWrapper}>
                                        <img 
                                            className={styles.singleImage}
                                            src={(currentQuestion as MultipleChoiceQuestion).image} 
                                            alt="Diagnostic Scan"
                                        />
                                    </div>
                                </div>
                                
                                <p className={styles.questionText} style={{ fontSize: '1rem', fontWeight: 'normal', color: 'var(--color-text-secondary)' }}>
                                    {(currentQuestion as MultipleChoiceQuestion).questionText}
                                </p>

                                <div className={styles.choiceList}>
                                    {(currentQuestion as MultipleChoiceQuestion).options.map((opt, oIdx) => {
                                        const letters = ['A', 'B', 'C', 'D'];
                                        const isSelected = selectedMcAnswer === oIdx;
                                        const isCorrectOpt = oIdx === (currentQuestion as MultipleChoiceQuestion).correctIndex;

                                        let optClass = '';
                                        if (isSubmitted) {
                                            if (isCorrectOpt) optClass = styles.correct;
                                            else if (isSelected) optClass = styles.wrong;
                                        } else if (isSelected) {
                                            optClass = styles.selected;
                                        }

                                        return (
                                            <button
                                                key={oIdx}
                                                className={`${styles.choiceItem} ${optClass}`}
                                                onClick={() => !isSubmitted && setSelectedMcAnswer(oIdx)}
                                                disabled={isSubmitted}
                                            >
                                                <span className={styles.choiceLetter}>{letters[oIdx]}</span>
                                                <span className={styles.choiceText}>{opt}</span>
                                                {isSubmitted && isCorrectOpt && <CheckCircle2 className={styles.choiceIcon} size={18} color="var(--color-success)" />}
                                                {isSubmitted && isSelected && !isCorrectOpt && <XCircle className={styles.choiceIcon} size={18} color="var(--color-error)" />}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Feedback & Actions */}
                        {isSubmitted ? (
                            <div className={`${styles.feedbackBox} ${
                                userAnswersLog[currentIdx]?.isCorrect ? styles.correct : styles.wrong
                            }`}>
                                <div className={`${styles.feedbackStatus} ${
                                    userAnswersLog[currentIdx]?.isCorrect ? styles.correct : styles.wrong
                                }`}>
                                    {userAnswersLog[currentIdx]?.isCorrect ? (
                                        <>
                                            <CheckCircle2 size={16} /> Correct Diagnosis
                                        </>
                                    ) : (
                                        <>
                                            <XCircle size={16} /> Incorrect Diagnosis
                                        </>
                                    )}
                                </div>
                                <p className={styles.explanationText}>
                                    <strong>Sonographic Findings & Explanation:</strong> {currentQuestion.explanation}
                                </p>
                                <div className={styles.actionSection}>
                                    <button className={styles.btnPrimary} onClick={handleNext}>
                                        {currentIdx + 1 === shuffledQuestions.length ? 'Show Results' : 'Next Question'} <ArrowRight size={16} />
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className={styles.actionSection}>
                                <button 
                                    className={styles.btnSuccess} 
                                    onClick={handleSubmit}
                                    disabled={
                                        currentQuestion.type === 'multiple_choice' 
                                            ? selectedMcAnswer === null 
                                            : (!selectedNormalAbnormal.left || !selectedNormalAbnormal.right)
                                    }
                                >
                                    Submit Answer
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ───────── Step 3: Results Page ───────── */}
            {step === 'results' && (
                <div className={styles.introCard} style={{ textAlign: 'left' }}>
                    <div className={styles.resultsHeader} style={{ textAlign: 'center' }}>
                        <div className={styles.iconWrapper}>
                            <Award size={32} />
                        </div>
                        <h1 className={styles.introTitle}>Test Completed!</h1>
                        
                        <div className={styles.resultsScoreSection}>
                            <h2 className={styles.resultsGrade}>
                                {getGradeDetails(score / shuffledQuestions.length).grade}
                            </h2>
                            <p className={styles.resultsFraction}>
                                Score: <strong>{score}</strong> / {shuffledQuestions.length} ({Math.round((score / shuffledQuestions.length) * 100)}%)
                            </p>
                        </div>

                        <p className={styles.friendlyMessage}>
                            {getGradeDetails(score / shuffledQuestions.length).message}
                        </p>
                    </div>

                    <div className={styles.sectionDivider} />

                    {/* Review Incorrect/All Answers */}
                    <div className={styles.reviewSection}>
                        <h2 className={styles.reviewTitle}>Question Review</h2>
                        <div className={styles.reviewList}>
                            {userAnswersLog.map((log, index) => {
                                const q = log.question;
                                return (
                                    <div key={index} className={styles.reviewCard}>
                                        <div className={styles.reviewCardHeader}>
                                            <h4 className={styles.reviewQTitle}>
                                                Question {index + 1}: {q.title}
                                            </h4>
                                            <span className={`${styles.statusIndicator} ${log.isCorrect ? styles.correct : styles.wrong}`}>
                                                {log.isCorrect ? (
                                                    <><Check size={12} /> Correct</>
                                                ) : (
                                                    <><X size={12} /> Incorrect</>
                                                )}
                                            </span>
                                        </div>

                                        <p className={styles.reviewText}>
                                            <strong>Your Answer:</strong> {log.userAnswer}
                                        </p>
                                        
                                        {!log.isCorrect && (
                                            <>
                                                <p className={styles.reviewText}>
                                                    <strong>Correct Answer:</strong> {log.correctAnswer}
                                                </p>
                                                <div className={`${styles.reviewExplanation} ${styles.wrong}`}>
                                                    <strong>Reasoning:</strong> {q.explanation}
                                                </div>
                                            </>
                                        )}
                                        {log.isCorrect && (
                                            <div className={styles.reviewExplanation}>
                                                <strong>Reasoning:</strong> {q.explanation}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div className={styles.sectionDivider} />

                    {/* Shuffled restart prompt */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px' }}>
                        <p className={styles.reviewText} style={{ fontWeight: 'bold', color: '#ffffff' }}>
                            Would you like to try a new test with shuffled questions?
                        </p>
                        <div className={styles.actionRow}>
                            <button className={styles.btnSuccess} onClick={startNewTest}>
                                <RotateCcw size={16} /> Yes, Try Shuffled
                            </button>
                            <button className={styles.btnSecondary} onClick={() => navigate('/')}>
                                <Home size={16} /> No, Return Home
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
