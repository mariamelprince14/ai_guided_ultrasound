import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '@store/useAppStore';
import { questionsDatabase } from '@constants/questionsData';
import type { 
    Question, 
    MultipleChoiceQuestion, 
    SelectPresentOrgansQuestion, 
    MatchingQuestion 
} from '@constants/questionsData';
import { 
    ScanEye, 
    CheckCircle2, 
    XCircle, 
    AlertCircle, 
    ArrowRight, 
    RotateCcw, 
    Home, 
    Award,
    Check,
    X,
    Lightbulb
} from 'lucide-react';
import styles from './TestMode.module.css';

export const IdentificationPage: React.FC = () => {
    const navigate = useNavigate();
    const { incrementCorrectAnswers, incrementTotalAttempts } = useAppStore();

    /* Test State */
    const [step, setStep] = useState<'intro' | 'test' | 'results'>('intro');
    const [shuffledQuestions, setShuffledQuestions] = useState<Question[]>([]);
    const [currentIdx, setCurrentIdx] = useState<number>(0);
    const [score, setScore] = useState<number>(0);
    
    /* Current Question Answer States */
    const [selectedMcAnswer, setSelectedMcAnswer] = useState<number | null>(null);
    const [selectedOrgans, setSelectedOrgans] = useState<string[]>([]);
    const [matchingAnswers, setMatchingAnswers] = useState<{ [key: string]: string }>({ A: '', B: '', C: '' });
    const [isSubmitted, setIsSubmitted] = useState<boolean>(false);
    
    /* Logging for review */
    const [userAnswersLog, setUserAnswersLog] = useState<any[]>([]);

    /* Initialize/Shuffle Questions */
    const startNewTest = () => {
        const rawPool = [...questionsDatabase.abdominal_anatomy_id];
        // Shuffle the 31 questions
        const shuffled = rawPool.sort(() => Math.random() - 0.5);
        // Take 20 questions
        setShuffledQuestions(shuffled.slice(0, 20));
        setCurrentIdx(0);
        setScore(0);
        setUserAnswersLog([]);
        resetQuestionState();
        setStep('test');
    };

    const resetQuestionState = () => {
        setSelectedMcAnswer(null);
        setSelectedOrgans([]);
        setMatchingAnswers({ A: '', B: '', C: '' });
        setIsSubmitted(false);
    };

    const currentQuestion = shuffledQuestions[currentIdx];

    const handleOrganToggle = (organ: string) => {
        if (isSubmitted) return;
        setSelectedOrgans(prev => 
            prev.includes(organ) 
                ? prev.filter(o => o !== organ) 
                : [...prev, organ]
        );
    };

    const handleMatchingSelect = (key: string, val: string) => {
        if (isSubmitted) return;
        setMatchingAnswers(prev => ({ ...prev, [key]: val }));
    };

    const handleSubmit = () => {
        if (!currentQuestion) return;

        let correct = false;
        let userAnswerDisplay = '';
        let correctAnswerDisplay = '';

        if (currentQuestion.type === 'multiple_choice') {
            if (selectedMcAnswer === null) return;
            correct = selectedMcAnswer === currentQuestion.correctIndex;
            userAnswerDisplay = currentQuestion.options[selectedMcAnswer];
            correctAnswerDisplay = currentQuestion.options[currentQuestion.correctIndex];
        } 
        else if (currentQuestion.type === 'select_present_organs') {
            if (selectedOrgans.length === 0) return;
            
            // Normalize arrays for checking correctness
            const userNorm = [...selectedOrgans].map(o => o.toLowerCase()).sort();
            const correctNorm = [...currentQuestion.correctOptions].map(o => o.toLowerCase()).sort();
            
            // Check if userNorm and correctNorm have exact same elements
            correct = userNorm.length === correctNorm.length && 
                      userNorm.every((val, index) => val === correctNorm[index]);

            userAnswerDisplay = selectedOrgans.join(', ');
            correctAnswerDisplay = currentQuestion.correctOptions.join(', ');
        } 
        else if (currentQuestion.type === 'matching') {
            const answers = matchingAnswers;
            if (!answers.A || !answers.B || !answers.C) return;

            correct = answers.A === currentQuestion.matches.A &&
                      answers.B === currentQuestion.matches.B &&
                      answers.C === currentQuestion.matches.C;

            userAnswerDisplay = `A-${answers.A}, B-${answers.B}, C-${answers.C}`;
            correctAnswerDisplay = `A-${currentQuestion.matches.A}, B-${currentQuestion.matches.B}, C-${currentQuestion.matches.C}`;
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
                userAnswer: userAnswerDisplay,
                correctAnswer: correctAnswerDisplay,
                matchingAnswers: currentQuestion.type === 'matching' ? { ...matchingAnswers } : undefined,
                selectedOrgans: currentQuestion.type === 'select_present_organs' ? [...selectedOrgans] : undefined
            }
        ]);
    };

    const handleNext = () => {
        if (currentIdx + 1 < shuffledQuestions.length) {
            const nextIndex = currentIdx + 1;
            setCurrentIdx(nextIndex);
            resetQuestionState();
        } else {
            setStep('results');
        }
    };

    const progressPercent = shuffledQuestions.length > 0 
        ? ((currentIdx + (isSubmitted ? 1 : 0)) / shuffledQuestions.length) * 100 
        : 0;

    const getGradeDetails = (scoreFraction: number) => {
        const percentage = scoreFraction * 100;
        if (percentage >= 90) {
            return {
                grade: 'Expert Anatomist',
                message: 'Incredible anatomical recognition! You demonstrated an exceptional grasp of abdominal organ boundaries, landmarks, and transducer engineering.',
                style: styles.textSuccess
            };
        } else if (percentage >= 70) {
            return {
                grade: 'Proficient',
                message: 'Superb job! You can accurately locate abdominal organs and identify standard ultrasound transducers and fields of view.',
                style: styles.textPrimary
            };
        } else {
            return {
                grade: 'Needs Practice',
                message: 'Good try! Anatomical orientation on gray-scale scans is challenging. Spend some more time in the interactive torso workspace to build your scanning memory.',
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
                            <ScanEye size={32} />
                        </div>
                        <h1 className={styles.introTitle}>Abdominal Anatomy ID</h1>
                        <p className={styles.introSubtitle}>
                            Master the spatial coordinates and sonographic appearances of abdominal organs, transducer footprints, and multi-organ scanning windows.
                        </p>
                    </div>

                    <div className={styles.sectionDivider} />

                    <div className={styles.objectivesSection}>
                        <h2 className={styles.sectionTitle}>Learning Objectives</h2>
                        <ul className={styles.objectivesList}>
                            <li className={styles.objectiveItem}>
                                <Check className={styles.checkIcon} size={16} />
                                <span>Correctly identify major abdominal organs (liver, pancreas, spleen, kidneys, and gallbladder) from arbitrary ultrasound orientations.</span>
                            </li>
                            <li className={styles.objectiveItem}>
                                <Check className={styles.checkIcon} size={16} />
                                <span>Recognize anatomical landmarks, vessels, and spaces (portal vein, renal sinus, diaphragm, Morrison's pouch, sludge-bile interface).</span>
                            </li>
                            <li className={styles.objectiveItem}>
                                <Check className={styles.checkIcon} size={16} />
                                <span>Associate Curvilinear, Linear, and Phased Array transducers with their respective ultrasound fields-of-view and clinical uses.</span>
                            </li>
                        </ul>
                    </div>

                    <div className={styles.testMeta}>
                        <div className={styles.metaItem}>
                            <Award size={16} />
                            <span>Total Questions: <strong>20</strong></span>
                        </div>
                        <div className={styles.metaItem}>
                            <Lightbulb size={16} />
                            <span>Format: <strong>Multiple Choice, Multi-select Checklist & Probe Matching</strong></span>
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
                            <h2 className={styles.headerTitle}>Abdominal Anatomy ID</h2>
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

                        {/* 1. Rendering: Multiple Choice */}
                        {currentQuestion.type === 'multiple_choice' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                <div className={styles.imageSection}>
                                    <div className={styles.singleImageWrapper}>
                                        <img 
                                            className={styles.singleImage}
                                            src={(currentQuestion as MultipleChoiceQuestion).image} 
                                            alt="Anatomy Scan"
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

                        {/* 2. Rendering: Select Present Organs (Checkbox Checklist) */}
                        {currentQuestion.type === 'select_present_organs' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                <div className={styles.imageSection}>
                                    <div className={styles.singleImageWrapper}>
                                        <img 
                                            className={styles.singleImage}
                                            src={(currentQuestion as SelectPresentOrgansQuestion).image} 
                                            alt="Multi-organ scan"
                                        />
                                    </div>
                                </div>
                                
                                <p className={styles.questionText} style={{ fontSize: '1rem', fontWeight: 'normal', color: 'var(--color-text-secondary)' }}>
                                    {(currentQuestion as SelectPresentOrgansQuestion).questionText}
                                </p>

                                <div className={styles.checkboxGrid}>
                                    {(currentQuestion as SelectPresentOrgansQuestion).options.map((opt, oIdx) => {
                                        const isChecked = selectedOrgans.includes(opt);
                                        const isCorrectOpt = (currentQuestion as SelectPresentOrgansQuestion).correctOptions.includes(opt);

                                        let optClass = '';
                                        if (isSubmitted) {
                                            if (isChecked && isCorrectOpt) optClass = styles.correctChecked;
                                            else if (isChecked && !isCorrectOpt) optClass = styles.incorrectChecked;
                                            else if (!isChecked && isCorrectOpt) optClass = styles.correctUnchecked;
                                        } else if (isChecked) {
                                            optClass = styles.checked;
                                        }

                                        return (
                                            <div
                                                key={oIdx}
                                                className={`${styles.checkboxItem} ${optClass} ${isSubmitted ? styles.submitted : ''}`}
                                                onClick={() => handleOrganToggle(opt)}
                                            >
                                                <input
                                                    type="checkbox"
                                                    className={styles.checkboxInput}
                                                    checked={isChecked}
                                                    onChange={() => {}} // toggling handled by parent card onClick
                                                    disabled={isSubmitted}
                                                />
                                                <span style={{ color: '#ffffff' }}>{opt}</span>
                                                {isSubmitted && isCorrectOpt && isChecked && <CheckCircle2 style={{ marginLeft: 'auto' }} size={16} color="var(--color-success)" />}
                                                {isSubmitted && !isCorrectOpt && isChecked && <XCircle style={{ marginLeft: 'auto' }} size={16} color="var(--color-error)" />}
                                                {isSubmitted && isCorrectOpt && !isChecked && <AlertCircle style={{ marginLeft: 'auto' }} size={16} color="var(--color-success)" />}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* 3. Rendering: Matching (Probe matching scan results) */}
                        {currentQuestion.type === 'matching' && (
                            <div className={styles.matchingLayout}>
                                <p className={styles.questionText} style={{ fontSize: '1rem', fontWeight: 'normal', color: 'var(--color-text-secondary)' }}>
                                    {(currentQuestion as MatchingQuestion).questionText}
                                </p>

                                <div className={styles.matchingImages}>
                                    {/* Left Top: Probes Reference Image */}
                                    <div className={styles.comparisonItem}>
                                        <span className={styles.imageLabel}>Transducers (A, B, C)</span>
                                        <div className={styles.singleImageWrapper}>
                                            <img 
                                                className={styles.singleImage}
                                                src={(currentQuestion as MatchingQuestion).probesImage} 
                                                alt="Transducers"
                                            />
                                        </div>
                                    </div>

                                    {/* Right Bottom: Scan results Reference Image */}
                                    <div className={styles.comparisonItem}>
                                        <span className={styles.imageLabel}>Scan Fields (1, 2, 3)</span>
                                        <div className={styles.singleImageWrapper}>
                                            <img 
                                                className={styles.singleImage}
                                                src={(currentQuestion as MatchingQuestion).resultsImage} 
                                                alt="Resulting Scans"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className={styles.matchingPillsSection}>
                                    <span className={styles.sectionTitle} style={{ fontSize: '0.8rem', marginBottom: '10px' }}>
                                        Establish matches:
                                    </span>
                                    {(currentQuestion as MatchingQuestion).pairs.map((pair) => {
                                        const userMatch = matchingAnswers[pair.key];
                                        const correctMatch = (currentQuestion as MatchingQuestion).matches[pair.key];
                                        const isCorrectMatch = userMatch === correctMatch;

                                        let selectClass = '';
                                        if (isSubmitted) {
                                            selectClass = isCorrectMatch ? styles.correct : styles.wrong;
                                        }

                                        return (
                                            <div key={pair.key} className={styles.matchingRow}>
                                                <span className={styles.matchingLabel}>{pair.label}</span>
                                                <select
                                                    className={`${styles.dropdownSelect} ${selectClass}`}
                                                    value={userMatch}
                                                    onChange={(e) => handleMatchingSelect(pair.key, e.target.value)}
                                                    disabled={isSubmitted}
                                                    style={{ maxWidth: '100%' }}
                                                >
                                                    <option value="">-- Matches Scan Shape --</option>
                                                    <option value="1">Image 1 (Rectangular)</option>
                                                    <option value="2">Image 2 (Diverging sector/trapezoid)</option>
                                                    <option value="3">Image 3 (Narrow sector)</option>
                                                </select>
                                            </div>
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
                                            <CheckCircle2 size={16} /> Match Verified
                                        </>
                                    ) : (
                                        <>
                                            <XCircle size={16} /> Incorrect Identification
                                        </>
                                    )}
                                </div>
                                <p className={styles.explanationText}>
                                    <strong>Anatomical / Technical Explanation:</strong> {currentQuestion.explanation}
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
                                            : currentQuestion.type === 'select_present_organs'
                                                ? selectedOrgans.length === 0
                                                : (!matchingAnswers.A || !matchingAnswers.B || !matchingAnswers.C)
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
                        <h1 className={styles.introTitle}>Anatomy Test Finished!</h1>
                        
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
                                            <strong>Your Response:</strong> {log.userAnswer}
                                        </p>
                                        
                                        {!log.isCorrect && (
                                            <>
                                                <p className={styles.reviewText}>
                                                    <strong>Correct Response:</strong> {log.correctAnswer}
                                                </p>
                                                <div className={`${styles.reviewExplanation} ${styles.wrong}`}>
                                                    <strong>Details:</strong> {q.explanation}
                                                </div>
                                            </>
                                        )}
                                        {log.isCorrect && (
                                            <div className={styles.reviewExplanation}>
                                                <strong>Details:</strong> {q.explanation}
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
