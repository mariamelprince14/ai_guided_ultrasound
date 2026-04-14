/**
 * RightPanel.tsx
 * ───────────────
 * Right panel for the training workspace.
 * Stacks:
 *   1. UltrasoundViewer (top, primary — always visible)
 *   2. GuidancePanel    (bottom, collapsible — AI feedback + checklist)
 *
 * The GuidancePanel collapses to a thin header bar when minimized,
 * preserving screen space without losing access to the data.
 */
import React, { useState } from 'react';
import { UltrasoundViewer } from './UltrasoundViewer';
import { GuidancePanel } from './GuidancePanel';
import { ChevronUp, ChevronDown, Brain } from 'lucide-react';
import styles from './RightPanel.module.css';

export const RightPanel: React.FC = () => {
    const [guidanceCollapsed, setGuidanceCollapsed] = useState(false);

    return (
        <div className={styles.container}>
            {/* Ultrasound viewer — always visible, takes remaining space */}
            <div className={styles.viewerSection}>
                <UltrasoundViewer />
            </div>

            {/* Collapsible GuidancePanel */}
            <div className={`${styles.guidanceWrapper} ${guidanceCollapsed ? styles.collapsed : ''}`}>
                {/* Collapse toggle header */}
                <button
                    className={styles.collapseToggle}
                    onClick={() => setGuidanceCollapsed(prev => !prev)}
                    aria-expanded={!guidanceCollapsed}
                    aria-label={guidanceCollapsed ? 'Expand AI Guidance' : 'Collapse AI Guidance'}
                >
                    <span className={styles.toggleLeft}>
                        <Brain size={13} />
                        <span>AI Guidance</span>
                    </span>
                    <span className={styles.toggleChevron}>
                        {guidanceCollapsed ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </span>
                </button>

                {/* Panel content — hidden when collapsed */}
                <div className={styles.guidanceContent}>
                    <GuidancePanel />
                </div>
            </div>
        </div>
    );
};
