/**
 * AICoachingPanel.tsx
 * ───────────────────
 * Live AI coaching assistant panel
 * Provides real-time contextual guidance and training feedback
 */

import React from 'react';
import {
    Activity,
    ChevronDown,
} from 'lucide-react';
import { useAppStore } from '@store/useAppStore';
import styles from './AICoachingPanel.module.css';

export const AICoachingPanel: React.FC = () => {
    const { visualizationSettings } = useAppStore();
    
    const suggestions = [
        "Rotate the probe 15° clockwise to align with the renal axis.",
        "Increase depth to 16cm for better visualization of the posterior cortex."
    ];

    // Voice guidance implementation
    React.useEffect(() => {
        if (visualizationSettings.mode !== 'advanced' && suggestions.length > 0) {
            // Speak the most recent (top) suggestion
            const speak = (text: string) => {
                // Cancel any ongoing speech
                window.speechSynthesis.cancel();
                const utterance = new SpeechSynthesisUtterance(text);
                utterance.rate = 1.0;
                utterance.pitch = 1.0;
                utterance.volume = 0.8;
                window.speechSynthesis.speak(utterance);
            };

            // For demo purposes, we speak the first one once when loaded
            // In a real app, we'd trigger this whenever a NEW message arrives from the backend
            const timeout = setTimeout(() => {
                speak(suggestions[0]);
            }, 1500);

            return () => clearTimeout(timeout);
        }
    }, [visualizationSettings.mode]);

    if (visualizationSettings.mode === 'advanced') {
        return null; // Hide in advanced mode
    }

    return (
        <div className={styles.panel}>
            <div className={styles.minimalHeader}>
                <div className={styles.titleSection}>
                    <Activity size={14} className={styles.icon} />
                    <span className={styles.title}>AI GUIDANCE FEED</span>
                </div>
                <div className={styles.statusListening}>
                    <div className={styles.dot} />
                    <span>VOICE ACTIVE</span>
                </div>
            </div>

            <div className={styles.feed}>
                {suggestions.map((text, idx) => (
                    <div key={idx} className={styles.coachingItem}>
                        <div className={styles.avatar}>
                            <Activity size={12} color="white" />
                        </div>
                        <div className={styles.content}>
                            <p className={styles.suggestion}>{text}</p>
                            <span className={styles.timestamp}>{idx === 0 ? 'JUST NOW' : `${idx * 2}m ago`}</span>
                        </div>
                    </div>
                ))}
            </div>

            <div className={styles.tipsSection}>
                <div className={styles.tipsHeader}>
                    <span className={styles.tipsTitle}>ANATOMICAL LANDMARKS</span>
                    <ChevronDown size={12} />
                </div>
                <div className={styles.compactTips}>
                    <div className={styles.tip}>• Morrison's Pouch (Superior)</div>
                    <div className={styles.tip}>• Liver Interface (Anterior)</div>
                </div>
            </div>
        </div>
    );
};
