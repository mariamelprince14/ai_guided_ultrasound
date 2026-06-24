import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '@store/useAppStore';
import { questionsDatabase } from '@constants/questionsData';
import type { 
    Question, 
    MultipleChoiceQuestion, 
    NormalVsAbnormalQuestion,
    SelectPresentOrgansQuestion,
    MatchingQuestion
} from '@constants/questionsData';
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
    Eye,
    ScanEye,
    Lightbulb
} from 'lucide-react';
import styles from './TestMode.module.css';

export const AssessmentPage: React.FC = () => {
    const navigate = useNavigate();
    const { incrementCorrectAnswers, incrementTotalAttempts, setSelectedMode } = useAppStore();

    /* Test State */
    const [step, setStep] = useState<'intro' | 'test' | 'results'>('intro');
    const [shuffledQuestions, setShuffledQuestions] = useState<Question[]>([]);
    const [currentIdx, setCurrentIdx] = useState<number>(0);
    const [score, setScore] = useState<number>(0);
    const [attemptCount, setAttemptCount] = useState<number>(() => {
        const saved = localStorage.getItem('theoretical_attempt_count');
        return saved ? parseInt(saved, 10) : 1;
    });
    
    /* Current Question Answer States */
    const [selectedMcAnswer, setSelectedMcAnswer] = useState<number | null>(null);
    const [selectedNormalAbnormal, setSelectedNormalAbnormal] = useState<{ left: string; right: string }>({ left: '', right: '' });
    const [isNormalLeft, setIsNormalLeft] = useState<boolean>(true); // Shuffle normal vs abnormal position
    const [selectedOrgans, setSelectedOrgans] = useState<string[]>([]);
    const [matchingAnswers, setMatchingAnswers] = useState<{ [key: string]: string }>({ A: '', B: '', C: '' });
    const [isSubmitted, setIsSubmitted] = useState<boolean>(false);
    const [showExitConfirm, setShowExitConfirm] = useState<boolean>(false);
    
    /* Logging for review */
    const [userAnswersLog, setUserAnswersLog] = useState<any[]>([]);

    /* Initialize/Shuffle Questions */
    const startNewTest = () => {
        const currentAttempt = parseInt(localStorage.getItem('theoretical_attempt_count') || '1', 10);
        
        const rawPool = [
            ...(questionsDatabase.clinical_case_assessment || []),
            ...(questionsDatabase.abdominal_anatomy_id || [])
        ];

        // The 4 specific questions for the first attempt guided sequence
        const firstAttemptFixedIds = ['sec1_q1', 'sec1_q2', 'sec4_q1', 'sec3_q11'];

        let selectedQuestions: Question[] = [];

        if (currentAttempt === 1) {
            // First 2: normality vs abnormality, then organ detection, then probe type matching
            const q1 = rawPool.find(q => q.id === 'sec1_q1');
            const q2 = rawPool.find(q => q.id === 'sec1_q2');
            const q3 = rawPool.find(q => q.id === 'sec4_q1');
            const q4 = rawPool.find(q => q.id === 'sec3_q11');

            // Shuffle the remaining 16 questions from the rest of the pool
            const remainingPool = rawPool.filter(q => !firstAttemptFixedIds.includes(q.id));
            const shuffledRemaining = [...remainingPool].sort(() => Math.random() - 0.5);
            
            if (q1 && q2 && q3 && q4) {
                selectedQuestions = [q1, q2, q3, q4, ...shuffledRemaining.slice(0, 16)];
            } else {
                selectedQuestions = rawPool.sort(() => Math.random() - 0.5).slice(0, 20);
            }
        } else {
            // Second time (or later): shuffle and show different questions other than these 4
            const remainingPool = rawPool.filter(q => !firstAttemptFixedIds.includes(q.id));
            const shuffledRemaining = [...remainingPool].sort(() => Math.random() - 0.5);
            selectedQuestions = shuffledRemaining.slice(0, 20);
        }

        setShuffledQuestions(selectedQuestions);
        setCurrentIdx(0);
        setScore(0);
        setUserAnswersLog([]);
        resetQuestionState(selectedQuestions[0]);
        setStep('test');

        // Increment the attempt count in state and localStorage for the next time
        const nextAttempt = currentAttempt + 1;
        setAttemptCount(nextAttempt);
        localStorage.setItem('theoretical_attempt_count', nextAttempt.toString());
    };

    const handleResetAttempts = () => {
        localStorage.setItem('theoretical_attempt_count', '1');
        setAttemptCount(1);
    };

    const resetQuestionState = (question: Question) => {
        setSelectedMcAnswer(null);
        setSelectedNormalAbnormal({ left: '', right: '' });
        setSelectedOrgans([]);
        setMatchingAnswers({ A: '', B: '', C: '' });
        setIsSubmitted(false);
        // Randomize normal left/right for normal_vs_abnormal questions
        if (question && question.type === 'normal_vs_abnormal') {
            setIsNormalLeft(Math.random() > 0.5);
        }
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
        } else if (currentQuestion.type === 'select_present_organs') {
            if (selectedOrgans.length === 0) return;
            const userNorm = [...selectedOrgans].map(o => o.toLowerCase()).sort();
            const correctNorm = [...currentQuestion.correctOptions].map(o => o.toLowerCase()).sort();
            correct = userNorm.length === correctNorm.length && 
                      userNorm.every((val, index) => val === correctNorm[index]);
            userAnswersDisplay = selectedOrgans.join(', ');
            correctAnswersDisplay = currentQuestion.correctOptions.join(', ');
        } else if (currentQuestion.type === 'matching') {
            const answers = matchingAnswers;
            if (!answers.A || !answers.B || !answers.C) return;
            correct = answers.A === currentQuestion.matches.A &&
                      answers.B === currentQuestion.matches.B &&
                      answers.C === currentQuestion.matches.C;
            userAnswersDisplay = `A-${answers.A}, B-${answers.B}, C-${answers.C}`;
            correctAnswersDisplay = `A-${currentQuestion.matches.A}, B-${currentQuestion.matches.B}, C-${currentQuestion.matches.C}`;
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
                isNormalLeft: currentQuestion.type === 'normal_vs_abnormal' ? isNormalLeft : undefined,
                matchingAnswers: currentQuestion.type === 'matching' ? { ...matchingAnswers } : undefined,
                selectedOrgans: currentQuestion.type === 'select_present_organs' ? [...selectedOrgans] : undefined
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

    const handleExitConfirm = () => {
        setShowExitConfirm(false);
        setSelectedMode(null);
        navigate('/');
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
                message: 'Excellent clinical diagnostic and anatomical recognition skills! You have successfully mastered this module\'s objectives.',
                style: styles.textSuccess
            };
        } else if (percentage >= 70) {
            return {
                grade: 'Competent',
                message: 'Great job! You have a solid grasp of abdominal anatomy and pathologies and can reliably distinguish normal variations from abnormal clinical cases.',
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
                        <h1 className={styles.introTitle}>Theoretical Clinical Assessment</h1>
                        <p className={styles.introSubtitle}>
                            Evaluate clinical case abnormalities, distinguish normal from pathological tissue, identify anatomical landmarks, and verify correct transducer orientations.
                        </p>
                    </div>

                    <div className={styles.sectionDivider} />

                    <div className={styles.objectivesSection}>
                        <h2 className={styles.sectionTitle}>Learning Objectives</h2>
                        <ul className={styles.objectivesList}>
                            <li className={styles.objectiveItem}>
                                <Check className={styles.checkIcon} size={16} />
                                <span>Distinguish normal ultrasound features of the liver, gallbladder, kidneys, and spleen from abnormal pathologies.</span>
                            </li>
                            <li className={styles.objectiveItem}>
                                <Check className={styles.checkIcon} size={16} />
                                <span>Identify common pathology patterns including fatty liver, cirrhosis, cysts, calculi (stones), sludge, and hydronephrosis.</span>
                            </li>
                            <li className={styles.objectiveItem}>
                                <Check className={styles.checkIcon} size={16} />
                                <span>Correctly identify major abdominal organs, vessels, and spaces from standard multi-organ scanning windows.</span>
                            </li>
                            <li className={styles.objectiveItem}>
                                <Check className={styles.checkIcon} size={16} />
                                <span>Associate transducer footprints (Curvilinear vs. Linear vs. Phased array) with their respective ultrasound fields-of-view.</span>
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
                            <span>Format: <strong>Dropdowns, Checkboxes, MCQs & Matching</strong></span>
                        </div>
                    </div>

                    <div className={styles.sectionDivider} />

                    <div className={styles.briefSection}>
                        <h2 className={styles.sectionTitle}>Theoretical Assessment Brief</h2>
                        <p className={styles.briefText}>
                            This mode assesses your clinical ultrasound reasoning, spatial recognition, and probe mechanics.
                        </p>
                        <div className={styles.briefGrid}>
                            <div className={styles.briefGridItem}>
                                <strong>Purpose</strong>
                                <span>Evaluate your diagnostic capability across clinical abdominal pathologies, scan orientation, and transducer selection.</span>
                            </div>
                            <div className={styles.briefGridItem}>
                                <strong>Total Saved Questions</strong>
                                <span>51 questions saved in the pool covering liver, kidneys, gallbladder, spleen, and transducer acoustics.</span>
                            </div>
                            <div className={styles.briefGridItem}>
                                <strong>Test Question Numbers</strong>
                                <span>20 questions drawn per quiz session.</span>
                            </div>
                            <div className={styles.briefGridItem}>
                                <strong>Variety of Questions</strong>
                                <span>Normality vs. Abnormality comparison dropdowns, Organ detection checklists, MCQ case studies, and Transducer matching.</span>
                            </div>
                            <div className={styles.briefGridItem}>
                                <strong>Attempt #1 (Guided Sequence)</strong>
                                <span>Features 2 Normality vs. Abnormality questions, 1 Organ Detection question, and 1 Probe matching question to establish fundamentals.</span>
                            </div>
                            <div className={styles.briefGridItem}>
                                <strong>Attempt #2+ (Shuffled Variant)</strong>
                                <span>Shuffled from the remaining 47 questions in the pool to ensure you do not repeat the introductory set.</span>
                            </div>
                        </div>
                    </div>

                    <div className={styles.sectionDivider} />

                    <div className={styles.attemptStatusSection}>
                        <span className={styles.attemptBadge}>
                            Current Attempt: #{attemptCount}
                        </span>
                        {attemptCount > 1 && (
                            <button 
                                className={styles.btnResetAttempt}
                                onClick={handleResetAttempts}
                                title="Reset attempt history to start with the introductory guided sequence again"
                            >
                                <RotateCcw size={14} /> Reset Attempt History
                            </button>
                        )}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'center', marginTop: 'var(--spacing-md)' }}>
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
                            <h2 className={styles.headerTitle}>Theoretical Clinical Assessment</h2>
                            <div className={styles.headerStats}>
                                <span className={styles.statBadge}>
                                    Question {currentIdx + 1} of {shuffledQuestions.length}
                                </span>
                                <span className={styles.statBadge}>
                                    Score: {score}
                                </span>
                                <button 
                                    className={styles.exitQuizButton}
                                    onClick={() => setShowExitConfirm(true)}
                                    title="Exit Quiz"
                                    aria-label="Exit Quiz"
                                >
                                    <X size={18} />
                                </button>
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

                        {/* Rendering: Select Present Organs (Checklist) */}
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
                                                    onChange={() => {}} 
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

                        {/* Rendering: Matching (Probe matching scan results) */}
                        {currentQuestion.type === 'matching' && (
                            <div className={styles.matchingLayout}>
                                <p className={styles.questionText} style={{ fontSize: '1rem', fontWeight: 'normal', color: 'var(--color-text-secondary)' }}>
                                    {(currentQuestion as MatchingQuestion).questionText}
                                </p>

                                <div className={styles.matchingImages}>
                                    {/* Probes Reference Image */}
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

                                    {/* Scan results Reference Image */}
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
                                            <CheckCircle2 size={16} /> Correct Assessment
                                        </>
                                    ) : (
                                        <>
                                            <XCircle size={16} /> Incorrect Assessment
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
                                            : currentQuestion.type === 'select_present_organs'
                                            ? selectedOrgans.length === 0
                                            : currentQuestion.type === 'matching'
                                            ? (!matchingAnswers.A || !matchingAnswers.B || !matchingAnswers.C)
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
                            <button className={styles.btnSecondary} onClick={() => {
                                setSelectedMode(null);
                                navigate('/');
                            }}>
                                <Home size={16} /> No, Return Home
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Exit Confirmation Modal */}
            {showExitConfirm && (
                <div className={styles.modalOverlay}>
                    <div className={styles.modalContent}>
                        <div className={styles.modalHeader}>
                            <AlertCircle size={24} />
                            <h3 className={styles.modalTitle}>Exit Assessment</h3>
                        </div>
                        <p className={styles.modalDescription}>
                            Are you sure you want to exit the quiz and return to the homepage? Your current progress and score for this session will be lost.
                        </p>
                        <div className={styles.modalActions}>
                            <button 
                                className={styles.btnSecondary} 
                                onClick={() => setShowExitConfirm(false)}
                            >
                                Resume Quiz
                            </button>
                            <button 
                                className={styles.btnDanger} 
                                onClick={handleExitConfirm}
                            >
                                Exit Quiz
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
