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
    const { visualizationSettings, currentFeedback } = useAppStore();
    
    const suggestions = currentFeedback?.guidanceSteps && currentFeedback.guidanceSteps.length > 0
        ? currentFeedback.guidanceSteps
        : [
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

            // Speak the current top recommendation when it changes
            speak(suggestions[0]);
        }
    }, [suggestions[0], visualizationSettings.mode]);

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
                    {currentFeedback?.progressChecklist ? (
                        Object.entries(currentFeedback.progressChecklist)
                            .filter(([key]) => key.endsWith("Visible"))
                            .map(([key, visible]) => {
                                const organName = key.replace("Visible", "");
                                return (
                                    <div key={key} className={styles.tip} style={{ opacity: visible ? 1 : 0.5 }}>
                                        {visible ? '• ' : '○ '} {organName.charAt(0).toUpperCase() + organName.slice(1)} {visible ? '(Visible)' : '(Not visible)'}
                                    </div>
                                );
                            })
                    ) : (
                        <>
                            <div className={styles.tip}>• Morrison's Pouch (Superior)</div>
                            <div className={styles.tip}>• Liver Interface (Anterior)</div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};
