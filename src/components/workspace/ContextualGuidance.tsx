/**
 * ContextualGuidance.tsx
 * ─────────────────────
 * Intelligent contextual guidance system
 * Replaces confusing technical labels with educational coaching overlays
 */

import React, { useEffect, useState } from 'react';
import {
    ArrowUp,
    ArrowDown,
    RotateCw,
    ZoomIn,
    AlertCircle,
    CheckCircle,
    Lightbulb,
} from 'lucide-react';
import { useAppStore } from '@store/useAppStore';
import styles from './ContextualGuidance.module.css';

export interface GuidanceState {
    type: 'instruction' | 'warning' | 'success' | 'info' | 'suggestion';
    message: string;
    detail?: string;
    action?: {
        icon: React.ReactNode;
        description: string;
        direction?: 'up' | 'down' | 'left' | 'right' | 'clockwise' | 'counterclockwise';
    };
}

export const ContextualGuidance: React.FC = () => {
    const {
        visualizationSettings,
        currentFeedback,
        probePosition,
        volumeInfo,
    } = useAppStore();

    const [guidance, setGuidance] = useState<GuidanceState | null>(null);
    const [isVisible, setIsVisible] = useState(true);

    useEffect(() => {
        // Generate contextual guidance based on current state
        if (!visualizationSettings.showGuidance) {
            setGuidance(null);
            return;
        }

        // Check volume boundaries
        if (volumeInfo && probePosition) {
            const { x, y, z } = probePosition;
            const bounds = volumeInfo.bounds;

            if (
                x < bounds.min[0] + 5 ||
                x > bounds.max[0] - 5
            ) {
                setGuidance({
                    type: 'warning',
                    message: 'Probe Position Warning',
                    detail: 'You are approaching the edge of the scanning volume.',
                    action: {
                        icon: <ArrowUp size={20} />,
                        description: 'Move probe more centrally',
                    },
                });
                return;
            }

            if (
                y < bounds.min[1] + 5 ||
                y > bounds.max[1] - 5
            ) {
                setGuidance({
                    type: 'warning',
                    message: 'Lateral Position Alert',
                    detail: 'Probe is too far to the side. Adjust position.',
                    action: {
                        icon: <ArrowUp size={20} />,
                        description: 'Move probe more medially',
                    },
                });
                return;
            }
        }

        // Use feedback from current state
        if (currentFeedback) {
            const feedbackType = currentFeedback.type || 'info';
            setGuidance({
                type: feedbackType as GuidanceState['type'],
                message: currentFeedback.message || 'Continue scanning',
                detail: currentFeedback.detail,
                action: currentFeedback.action,
            });
            return;
        }

        // Default beginner guidance
        if (visualizationSettings.mode === 'beginner') {
            setGuidance({
                type: 'suggestion',
                message: '📍 Find the Target Organ',
                detail: 'Look for the bright area in the ultrasound image. Rotate and tilt your probe to center it.',
                action: {
                    icon: <RotateCw size={20} />,
                    description: 'Adjust probe angle',
                    direction: 'clockwise',
                },
            });
        } else if (visualizationSettings.mode === 'intermediate') {
            setGuidance({
                type: 'info',
                message: '🎯 Scanning',
                detail: 'Achieve optimal image quality by adjusting probe pressure and angle.',
            });
        }
    }, [visualizationSettings, currentFeedback, probePosition, volumeInfo]);

    if (!guidance || !isVisible) {
        return null;
    }

    const iconMap = {
        instruction: <Lightbulb size={24} />,
        warning: <AlertCircle size={24} />,
        success: <CheckCircle size={24} />,
        info: <AlertCircle size={24} />,
        suggestion: <Lightbulb size={24} />,
    };

    const arrowMap = {
        up: <ArrowUp size={20} />,
        down: <ArrowDown size={20} />,
        clockwise: <RotateCw size={20} />,
        counterclockwise: <RotateCw size={20} className={styles.rotateReverse} />,
    };

    return (
        <div className={`${styles.container} ${styles[guidance.type]}`}>
            {/* Main Guidance Card */}
            <div className={styles.card}>
                <div className={styles.header}>
                    <div className={styles.iconWrapper}>{iconMap[guidance.type]}</div>
                    <div className={styles.title}>{guidance.message}</div>
                    <button
                        className={styles.closeButton}
                        onClick={() => setIsVisible(false)}
                        title="Dismiss"
                    >
                        ✕
                    </button>
                </div>

                {guidance.detail && (
                    <div className={styles.detail}>{guidance.detail}</div>
                )}

                {guidance.action && (
                    <div className={styles.actionBox}>
                        <div className={styles.actionIcon}>
                            {guidance.action.direction
                                ? arrowMap[guidance.action.direction as keyof typeof arrowMap]
                                : guidance.action.icon}
                        </div>
                        <div className={styles.actionText}>
                            {guidance.action.description}
                        </div>
                    </div>
                )}
            </div>

            {/* Visual Pulse Indicator */}
            <div className={styles.pulse} />
        </div>
    );
};
