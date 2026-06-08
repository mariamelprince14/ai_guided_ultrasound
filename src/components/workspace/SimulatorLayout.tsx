/**
 * SimulatorLayout.tsx
 * ───────────────────
 * Professional 3-column medical ultrasound workstation layout:
 *   LEFT   → Compact collapsible navigation sidebar
 *   TOP    → Clinical header (session controls, difficulty, scan params)
 *   CENTER → Dominant 3D simulation viewport (torso, probe, anatomy)
 *   RIGHT  → Ultrasound imaging monitor + AI coaching panel
 *   BOTTOM → Compact metrics/status bar
 */

import React, { useState } from 'react';
import { SimulatorHeader } from './SimulatorHeader';
import { CompactSidebar } from './CompactSidebar';
import { AICoachingPanel } from './AICoachingPanel';
import styles from './SimulatorLayout.module.css';

interface SimulatorLayoutProps {
    viewport: React.ReactNode;      // Large center 3D simulation
    rightPanel: React.ReactNode;    // Ultrasound monitor
    bottomBar?: React.ReactNode;    // Compact status metrics
}

export const SimulatorLayout: React.FC<SimulatorLayoutProps> = ({
    viewport,
    rightPanel,
    bottomBar,
}) => {
    const [sidebarOpen, setSidebarOpen] = useState(false);

    return (
        <div className={styles.container}>
            {/* 1. Professional Compact Toolbar */}
            <SimulatorHeader onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />

            <div className={styles.body}>
                {/* 2. Collapsible Left Sidebar (Handled by absolute positioning in its component or margin here) */}
                <CompactSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

                {/* 3. CENTER: Immersive 3D Simulation Viewport */}
                <main className={styles.centerArea}>
                    <div className={styles.viewportWrapper}>
                        {viewport}
                    </div>
                </main>

                {/* 4. RIGHT: Clinical Monitor & Coaching */}
                <aside className={styles.rightPanel}>
                    <div className={styles.rightPanelInner}>
                        <div className={styles.ultrasoundMonitor}>
                            {rightPanel}
                        </div>
                        <div className={styles.coachingArea}>
                            <AICoachingPanel />
                        </div>
                    </div>
                </aside>
            </div>

            {/* 5. BOTTOM: Slim Status Metrics */}
            {bottomBar && (
                <footer className={styles.bottomBar}>
                    {bottomBar}
                </footer>
            )}
        </div>
    );
};
