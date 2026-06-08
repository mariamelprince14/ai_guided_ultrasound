import React from 'react';
import { CheckCircle2, RotateCw, ArrowDown, MoveHorizontal } from 'lucide-react';
import { useAppStore } from '@store/useAppStore';
import styles from './ProbeHUD.module.css';

export const ProbeHUD: React.FC = () => {
    const { probePhysics } = useAppStore();
    const pressure = Math.round(probePhysics.surfaceContact.pressureLevel * 100);
    return (
        <>
            {/* 1. PROBE TIPS (Top Left) */}
            <div className={styles.tipsCard}>
                <div className={styles.tipsTitle}>PROBE TIPS</div>
                <div className={styles.tipItem}>
                    <CheckCircle2 size={14} className={styles.iconGood} />
                    <span>Good contact</span>
                </div>
                <div className={styles.tipItem}>
                    <CheckCircle2 size={14} className={styles.iconGood} />
                    <span>Steady movement</span>
                </div>
                <div className={styles.tipItem}>
                    <RotateCw size={14} className={styles.iconWarn} />
                    <span>Rotate slightly clockwise</span>
                </div>
                <div className={styles.tipItem}>
                    <ArrowDown size={14} className={styles.iconInfo} />
                    <span>Tilt inferiorly</span>
                </div>
                <div className={styles.tipItem}>
                    <MoveHorizontal size={14} className={styles.iconInfo} />
                    <span>Move medially</span>
                </div>
            </div>

            {/* 2. PRESSURE GAUGE (Bottom Left) */}
            <div className={styles.pressureCard}>
                <div className={styles.pressureHeader}>PRESSURE</div>
                <div className={styles.gaugeContainer}>
                    <svg viewBox="0 0 100 100" className={styles.gaugeSvg}>
                        <circle cx="50" cy="50" r="40" className={styles.gaugeBg} />
                        <circle 
                            cx="50" cy="50" r="40" 
                            className={styles.gaugeFill} 
                            style={{ 
                                strokeDasharray: `${pressure * 2.51}, 251`,
                                stroke: pressure > 80 ? '#ef4444' : pressure > 40 ? '#4ade80' : '#fbbf24'
                            }} 
                        />
                    </svg>
                    <div className={styles.gaugeContent}>
                        <div className={styles.gaugePercent}>{pressure}%</div>
                        <div className={styles.gaugeStatus}>{pressure > 80 ? 'HIGH' : pressure > 40 ? 'Good' : 'LOW'}</div>
                    </div>
                </div>
            </div>

            {/* 3. INTERACTION HINTS (Bottom Center) */}
            <div className={styles.interactionHints}>
                <span>Scroll: <strong>Zoom</strong></span>
                <span className={styles.hintDot}>•</span>
                <span>Right Drag: <strong>Rotate</strong></span>
                <span className={styles.hintDot}>•</span>
                <span>Middle Drag: <strong>Pan</strong></span>
            </div>

            {/* 4. RESET VIEW (Bottom Right) */}
            <button className={styles.resetViewBtn}>Reset View</button>
        </>
    );
};
