import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '@store/useAppStore';
import { HomepageNavbar } from '@components/layout/HomepageNavbar';
import { SignInModal } from '@components/ui/SignInModal';
import { SignUpModal } from '@components/ui/SignUpModal';
import {
    Monitor,
    ClipboardCheck,
    ScanEye,
    ArrowRight,
    ShieldCheck,
    Play,
    Users,
    Wrench,
    ClipboardList,
    CheckCircle2,
    Target,
    BarChart3,
    Microscope,
    TrendingUp,
    ChevronRight,
    ChevronDown,
    X,
    Gauge,
    Compass,
    Eye,
    Activity,
    MessageSquare,
    BookOpen,
    Award,
    Brain,
    Lightbulb,
    Zap,
    Star,
    GraduationCap,
    Crosshair,
} from 'lucide-react';
import type { TrainingMode } from '@/types';
import clsx from 'clsx';
import styles from './ModeSelection.module.css';

/* ───────── Data ───────── */

interface OutputItem {
    icon: React.ReactNode;
    text: string;
}

interface ModeCardData {
    mode: TrainingMode;
    icon: React.ReactNode;
    title: string;
    description: string;
    focusIcon: React.ReactNode;
    whatYouDo: string;
    expectedOutputs: OutputItem[];
    image: string;
}

const modeCards: ModeCardData[] = [
    {
        mode: 'full',
        icon: <Monitor size={28} color="var(--color-primary-500)" />,
        title: 'Abdominal Training Mode',
        description:
            'Real-time ultrasound simulation of abdominal organs with AI-guided probe manipulation.',
        focusIcon: <Crosshair size={16} className={styles.focusIcon} />,
        whatYouDo:
            'Manipulate a virtual probe to acquire optimal ultrasound views of abdominal target organs.',
        expectedOutputs: [
            { icon: <Gauge size={15} />, text: 'Real-time quality scores' },
            { icon: <Compass size={15} />, text: 'AI-guided probe positioning' },
            { icon: <Eye size={15} />, text: 'View recognition feedback' },
            { icon: <Activity size={15} />, text: 'Performance metrics' },
        ],
        image: '/images/card-abdominal.png',
    },
    {
        mode: 'theoretical',
        icon: <ClipboardCheck size={28} color="var(--color-primary-500)" />,
        title: 'Theoretical Clinical Assessment Mode',
        description:
            'Combined clinical cases and anatomy identification questions to test your diagnostic and recognition knowledge.',
        focusIcon: <BookOpen size={16} className={styles.focusIcon} />,
        whatYouDo:
            'Evaluate pathology scans and identify anatomical views/transducers across a variety of questions.',
        expectedOutputs: [
            { icon: <MessageSquare size={15} />, text: 'Diagnostic case questions' },
            { icon: <Brain size={15} />, text: 'Anatomy identification tasks' },
            { icon: <BookOpen size={15} />, text: 'Detailed sonographic explanations' },
            { icon: <Award size={15} />, text: 'Comprehensive score tracking' },
        ],
        image: '/images/card-clinical.png',
    },
];

const stats = [
    { icon: <Users size={24} />, value: '500+', label: 'Virtual Patients' },
    { icon: <Wrench size={24} />, value: '10,000+', label: 'Probe Poses' },
    { icon: <ClipboardList size={24} />, value: '50+', label: 'Clinical Cases' },
    { icon: <CheckCircle2 size={24} />, value: '95%', label: 'Training Accuracy' },
];

const features = [
    {
        icon: <Target size={24} />,
        title: 'Real-Time Guidance',
        desc: 'AI provides instant feedback on probe position, angle, and scan quality.',
    },
    {
        icon: <BarChart3 size={24} />,
        title: 'Scan Quality Analysis',
        desc: 'Get objective scores for depth, gain, clarity, and anatomical coverage.',
    },
    {
        icon: <Microscope size={24} />,
        title: 'Anatomy Detection',
        desc: 'AI automatically detects and highlights anatomical structures.',
    },
    {
        icon: <TrendingUp size={24} />,
        title: 'Skill Tracking',
        desc: 'Monitor your progress and improve with data-driven insights.',
    },
];

const howSteps = [
    { num: 1, title: 'Place the Probe', desc: 'Position the probe on the virtual patient.' },
    { num: 2, title: 'Acquire the Image', desc: 'Adjust angle, depth, and gain to get the best view.' },
    { num: 3, title: 'Get AI Feedback', desc: 'Receive real-time guidance and quality score.' },
    { num: 4, title: 'Improve Skills', desc: 'Repeat, learn and master ultrasound scanning.' },
];

const demoSlides = [
    {
        icon: <Monitor size={36} />,
        title: 'Abdominal Training Mode',
        desc: 'Real-time AI feedback on probe positioning and scan quality. Get guided through optimal views of abdominal organs with instant quality scoring.',
    },
    {
        icon: <ClipboardCheck size={36} />,
        title: 'Theoretical Clinical Assessment Mode',
        desc: 'Test diagnostic and recognition knowledge with combined clinical cases and anatomy identification questions. Shuffled quizzes with detailed sonographic explanations.',
    },
];

/* ───────── Hook: Intersection Observer ───────── */

function useScrollAnimation() {
    const ref = useRef<HTMLDivElement>(null);
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setIsVisible(true);
                    observer.unobserve(el);
                }
            },
            { threshold: 0.15 }
        );
        observer.observe(el);
        return () => observer.disconnect();
    }, []);

    return { ref, isVisible };
}

/* ───────── Component ───────── */

export const ModeSelection: React.FC = () => {
    const navigate = useNavigate();
    const { selectedMode, setSelectedMode } = useAppStore();

    /* Sign In / Sign Up Modals */
    const [showSignIn, setShowSignIn] = useState(false);
    const [showSignUp, setShowSignUp] = useState(false);

    useEffect(() => {
        console.log("showSignIn changed:", showSignIn);
    }, [showSignIn]);

    useEffect(() => {
        console.log("showSignUp changed:", showSignUp);
    }, [showSignUp]);

    console.log("ModeSelection rendering, state:", { showSignIn, showSignUp });

    /* Demo modal */
    const [showDemo, setShowDemo] = useState(false);
    const [activeSlide, setActiveSlide] = useState(0);
    const slideTimer = useRef<ReturnType<typeof setInterval> | null>(null);

    const startSlideshow = useCallback(() => {
        slideTimer.current = setInterval(() => {
            setActiveSlide((prev) => (prev + 1) % demoSlides.length);
        }, 5000);
    }, []);

    useEffect(() => {
        if (showDemo) {
            setActiveSlide(0);
            startSlideshow();
        }
        return () => {
            if (slideTimer.current) clearInterval(slideTimer.current);
        };
    }, [showDemo, startSlideshow]);

    const handleDotClick = (idx: number) => {
        setActiveSlide(idx);
        if (slideTimer.current) clearInterval(slideTimer.current);
        startSlideshow();
    };

    /* Mode selection */
    const handleModeSelect = (mode: TrainingMode) => {
        setSelectedMode(mode);
    };

    const handleStartTraining = () => {
        const modesSection = document.getElementById('training-modes');
        if (modesSection) {
            modesSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    };

    const handleContinueTraining = () => {
        if (selectedMode) {
            if (selectedMode === 'full') {
                navigate('/setup');
            } else {
                navigate('/workspace');
            }
        }
    };

    /* Scroll animation refs */
    const statsAnim = useScrollAnimation();
    const modesAnim = useScrollAnimation();
    const featuresAnim = useScrollAnimation();
    const howAnim = useScrollAnimation();

    return (
        <div className={styles.homepage}>
            {/* Background glassmorphism blobs */}
            <div className={styles.glassBlob1} />
            <div className={styles.glassBlob2} />
            <div className={styles.glassBlob3} />

            <HomepageNavbar 
                onSignInClick={() => {
                    console.log("Navbar Sign In callback triggered");
                    setShowSignUp(false);
                    setShowSignIn(true);
                }} 
                onSignUpClick={() => {
                    console.log("Navbar Sign Up callback triggered");
                    setShowSignIn(false);
                    setShowSignUp(true);
                }} 
            />

            {/* ===== HERO ===== */}
            <section className={styles.hero} id="hero-section">
                <div className={styles.heroLeft}>
                    <div className={styles.trainingBadge}>
                        <span className={styles.badgeDot} />
                        <span className={styles.badgeText}>Training System Only</span>
                    </div>

                    <h1 className={styles.heroTitle}>
                        <span className={styles.heroTitleLine}>AI-Guided</span>
                        <span className={styles.heroTitleAccent}>Ultrasound</span>
                        <span className={styles.heroTitleLine}>Training System</span>
                    </h1>

                    <p className={styles.heroSubtitle}>
                        Real-time scanning optimization and skill transfer (training-only)
                    </p>

                    <div className={styles.disclaimerBanner}>
                        <ShieldCheck size={16} className={styles.disclaimerIcon} />
                        <span className={styles.disclaimerText}>
                            Training System Only. No Diagnostic Decision Support.
                        </span>
                    </div>

                    <div className={styles.heroCta}>
                        <button
                            className={styles.ctaPrimary}
                            onClick={handleStartTraining}
                            id="cta-start-training"
                        >
                            Start Training <ArrowRight size={18} />
                        </button>
                        <button
                            className={styles.ctaSecondary}
                            onClick={() => setShowDemo(true)}
                            id="cta-watch-demo"
                        >
                            <Play size={16} /> Watch Demo
                        </button>
                    </div>
                </div>

                <div className={styles.heroRight}>
                    {/* 3D Torso Background */}
                    <img
                        src="/images/hero-torso.png"
                        alt="3D anatomical torso with ultrasound probe"
                        className={styles.heroTorso}
                    />

                    {/* Ultrasound Image Frame */}
                    <div className={styles.heroUltrasoundFrame}>
                        <img
                            src="/images/ultrasound-liver.png"
                            alt="Liver ultrasound scan"
                            className={styles.heroUltrasoundImg}
                        />
                        <div className={styles.ultrasoundLabel}>Liver</div>
                    </div>

                    {/* AI Guidance Panel */}
                    <div className={styles.heroAiPanel}>
                        <div className={styles.aiPanelTitle}>AI Guidance</div>
                        {[
                            { label: 'Probe Position', value: 'Optimal' },
                            { label: 'Angle', value: 'Optimal' },
                            { label: 'Depth', value: 'Optimal' },
                        ].map((param) => (
                            <div key={param.label} className={styles.aiPanelRow}>
                                <CheckCircle2 size={14} className={styles.aiParamIcon} />
                                <span className={styles.aiParamLabel}>{param.label}</span>
                                <span className={styles.aiParamValue}>{param.value}</span>
                            </div>
                        ))}
                        <div className={styles.aiScoreBadge}>
                            <div className={styles.scoreCircle}>92</div>
                            <div className={styles.scoreLabel}>
                                <span className={styles.scoreValue}>Scan Quality</span>
                                Optimal
                            </div>
                        </div>
                    </div>
                </div>

                {/* Scroll-down indicator */}
                <div className={styles.scrollIndicator} onClick={handleStartTraining}>
                    <span className={styles.scrollText}>Explore Training Modes</span>
                    <ChevronDown size={20} className={styles.scrollChevron} />
                </div>
            </section>

            {/* ===== STATS BAR ===== */}
            <section
                className={styles.statsSection}
                ref={statsAnim.ref}
            >
                <div
                    className={clsx(
                        styles.statsBar,
                        styles.animateOnScroll,
                        statsAnim.isVisible && styles.visible
                    )}
                >
                    {stats.map((s) => (
                        <div key={s.label} className={styles.statItem}>
                            <div className={styles.statIcon}>{s.icon}</div>
                            <div>
                                <div className={styles.statValue}>{s.value}</div>
                                <div className={styles.statLabel}>{s.label}</div>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* ===== TRAINING MODES ===== */}
            <section
                className={styles.modesSection}
                ref={modesAnim.ref}
                id="training-modes"
            >
                <div
                    className={clsx(
                        styles.animateOnScroll,
                        modesAnim.isVisible && styles.visible
                    )}
                >
                    <div className={styles.sectionHeader}>
                        <h2 className={styles.sectionTitle}>
                            <span className={styles.sectionSparkle}>✦</span>
                            Choose Your Training Mode
                            <span className={styles.sectionSparkle}>✦</span>
                        </h2>
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
                                id={`mode-card-${card.mode}`}
                            >
                                <div className={styles.cardImageWrapper}>
                                    <img
                                        src={card.image}
                                        alt={card.title}
                                        className={styles.cardImage}
                                    />
                                </div>
                                <div className={styles.cardBody}>
                                    <div className={styles.cardIcon}>{card.icon}</div>
                                    <h3 className={styles.cardTitle}>{card.title}</h3>
                                    <p className={styles.cardDescription}>{card.description}</p>

                                    <div className={styles.cardSection}>
                                        <div className={styles.cardSectionHeader}>
                                            {card.focusIcon}
                                            <h4 className={styles.cardSectionTitle}>Training Focus</h4>
                                        </div>
                                        <p className={styles.cardSectionText}>{card.whatYouDo}</p>
                                    </div>

                                    <div className={styles.cardSection}>
                                        <div className={styles.cardSectionHeader}>
                                            <Award size={16} className={styles.focusIcon} />
                                            <h4 className={styles.cardSectionTitle}>Learning Outcomes</h4>
                                        </div>
                                        <div className={styles.outcomeGrid}>
                                            {card.expectedOutputs.map((output, index) => (
                                                <div key={index} className={styles.outcomeItem}>
                                                    <div className={styles.outcomeIconWrap}>
                                                        {output.icon}
                                                    </div>
                                                    <span className={styles.outcomeText}>{output.text}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {selectedMode && (
                        <div style={{ textAlign: 'center', marginTop: '2.5rem' }}>
                            <button
                                className={styles.ctaPrimary}
                                onClick={handleContinueTraining}
                                id="cta-continue-training"
                            >
                                Continue with {modeCards.find(c => c.mode === selectedMode)?.title}
                                <ArrowRight size={18} />
                            </button>
                        </div>
                    )}
                </div>
            </section>

            {/* ===== FEATURE HIGHLIGHTS ===== */}
            <section
                className={styles.featuresSection}
                ref={featuresAnim.ref}
                id="feature-highlights"
            >
                <div
                    className={clsx(
                        styles.animateOnScroll,
                        featuresAnim.isVisible && styles.visible
                    )}
                >
                    <div className={styles.sectionHeader}>
                        <h2 className={styles.sectionTitle}>
                            <span className={styles.sectionSparkle}>✦</span>
                            Feature Highlights
                            <span className={styles.sectionSparkle}>✦</span>
                        </h2>
                    </div>

                    <div className={styles.featuresGrid}>
                        {features.map((f) => (
                            <div key={f.title} className={styles.featureCard}>
                                <div className={styles.featureIconWrap}>{f.icon}</div>
                                <h3 className={styles.featureTitle}>{f.title}</h3>
                                <p className={styles.featureDesc}>{f.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ===== HOW TRAINING WORKS ===== */}
            <section
                className={styles.howSection}
                ref={howAnim.ref}
                id="how-it-works"
            >
                <div
                    className={clsx(
                        styles.animateOnScroll,
                        howAnim.isVisible && styles.visible
                    )}
                >
                    <div className={styles.sectionHeader}>
                        <h2 className={styles.sectionTitle}>
                            <span className={styles.sectionSparkle}>✦</span>
                            How Training Works
                            <span className={styles.sectionSparkle}>✦</span>
                        </h2>
                    </div>

                    <div className={styles.stepsRow}>
                        {howSteps.map((step, idx) => (
                            <div key={step.num} className={styles.stepCard}>
                                <div className={styles.stepNumber}>{step.num}</div>
                                <h3 className={styles.stepTitle}>{step.title}</h3>
                                <p className={styles.stepDesc}>{step.desc}</p>
                                {idx < howSteps.length - 1 && (
                                    <ChevronRight size={20} className={styles.stepArrow} />
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ===== FOOTER ===== */}
            <footer className={styles.footer}>
                <p className={styles.footerText}>
                    AI-Guided Ultrasound Training System · For educational and training purposes only ·{' '}
                    <button
                        className={styles.footerLink}
                        onClick={() => navigate('/registration')}
                    >
                        Calibration &amp; System Registration
                    </button>
                </p>
            </footer>

            {/* ===== DEMO MODAL ===== */}
            {showDemo && (
                <div
                    className={styles.demoOverlay}
                    onClick={() => setShowDemo(false)}
                    id="demo-modal"
                >
                    <div className={styles.demoModal} onClick={(e) => e.stopPropagation()}>
                        <div className={styles.demoHeader}>
                            <h2 className={styles.demoTitle}>System Demo</h2>
                            <button
                                className={styles.demoClose}
                                onClick={() => setShowDemo(false)}
                                aria-label="Close"
                            >
                                <X size={18} />
                            </button>
                        </div>
                        <div className={styles.demoContent}>
                            <div className={styles.slideshow}>
                                {demoSlides.map((slide, idx) => (
                                    <div
                                        key={idx}
                                        className={clsx(
                                            styles.slide,
                                            idx === activeSlide && styles.activeSlide
                                        )}
                                    >
                                        <div className={styles.slideIcon}>{slide.icon}</div>
                                        <h3 className={styles.slideTitle}>{slide.title}</h3>
                                        <p className={styles.slideDesc}>{slide.desc}</p>
                                    </div>
                                ))}
                            </div>
                            <div className={styles.slideDots}>
                                {demoSlides.map((_, idx) => (
                                    <button
                                        key={idx}
                                        className={clsx(
                                            styles.dot,
                                            idx === activeSlide && styles.activeDot
                                        )}
                                        onClick={() => handleDotClick(idx)}
                                        aria-label={`Slide ${idx + 1}`}
                                    />
                                ))}
                            </div>
                        </div>
                        <div className={styles.demoCaption}>
                            Simulated demo for educational preview — not from live system
                        </div>
                    </div>
                </div>
            )}

            {/* ===== SIGN IN MODAL ===== */}
            <SignInModal
                isOpen={showSignIn}
                onClose={() => setShowSignIn(false)}
                onSwitchToSignUp={() => {
                    setShowSignIn(false);
                    setShowSignUp(true);
                }}
            />

            {/* ===== SIGN UP MODAL ===== */}
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
