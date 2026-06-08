/**
 * TrainingWorkspaceLayout.tsx
 * ───────────────────────────────────────
 * Main training workspace with split-view layout:
 * - LEFT/CENTER: Large 3D ultrasound simulation viewport (70%)
 * - RIGHT: Professional ultrasound imaging panel (30%)
 * 
 * This layout restores the essential simulation-centric design where the
 * trainee immediately understands this is an ultrasound simulator.
 */

import React, { useState } from 'react';
import { SimulatorHeader } from './SimulatorHeader';
import { CompactSidebar } from './CompactSidebar';
import { ContextualGuidance } from './ContextualGuidance';
import { PressureVisualization } from './PressureVisualization';
import { AICoachingPanel } from './AICoachingPanel';
import { ProbeControls } from './ProbeControls';
import { SessionMetricsDisplay } from './SessionMetricsDisplay';
import styles from './TrainingWorkspaceLayout.module.css';

interface TrainingWorkspaceLayoutProps {
    volumeViewport: React.ReactNode;  // 3D torso + probe viewport
    ultrasoundViewport: React.ReactNode;  // Ultrasound imaging panel
}

export const TrainingWorkspaceLayout: React.FC<TrainingWorkspaceLayoutProps> = ({
    volumeViewport,
    ultrasoundViewport,
}) => {
    const [sidebarOpen, setSidebarOpen] = useState(false);

    return (
        <div className={styles.container}>
            {/* Professional Header */}
            <SimulatorHeader onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />

            {/* Compact Sidebar */}
            <CompactSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

            {/* Main Content Area */}
            <main className={styles.mainContent}>
                {/* Split View: 3D Simulation + Ultrasound */}
                <div className={styles.splitViewContainer}>
                    {/* LEFT: 3D Ultrasound Simulation (Main Focus) */}
                    <div className={styles.leftPanel}>
                        {/* 3D Viewport */}
                        <div className={styles.volumeViewport}>
                            {volumeViewport}
                        </div>

                        {/* Probe Controls - Compact Bottom Bar */}
                        <div className={styles.controlsBar}>
                            <ProbeControls />
                        </div>
                    </div>

                    {/* RIGHT: Ultrasound Imaging Panel (Professional Medical Monitor) */}
                    <div className={styles.rightPanel}>
                        {/* Ultrasound Image Viewer */}
                        <div className={styles.ultrasoundViewer}>
                            {ultrasoundViewport}
                        </div>

                        {/* AI Coaching Panel - Positioned Below Ultrasound */}
                        <div className={styles.coachingArea}>
                            <AICoachingPanel />
                        </div>
                    </div>
                </div>

                {/* Session Metrics at Bottom */}
                <div className={styles.metricsBar}>
                    <SessionMetricsDisplay />
                </div>
            </main>

            {/* Floating UI Elements - Kept Minimal */}
            <ContextualGuidance />
            <PressureVisualization />
        </div>
    );
};
