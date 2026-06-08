import React from 'react';
import {
    Zap,
    Play,
    Pause,
    RotateCcw,
    Menu,
    ChevronDown,
    Activity,
    Wifi,
    Settings,
} from 'lucide-react';
import { useAppStore } from '@store/useAppStore';
import styles from './SimulatorHeader.module.css';

export const SimulatorHeader: React.FC<{ onToggleSidebar: () => void }> = ({ onToggleSidebar }) => {
    const {
        status,
        visualizationSettings,
        setVisualizationMode,
        connectionStatus,
        setSessionStatus,
        resetSession,
    } = useAppStore();

    const handlePlayPause = () => {
        setSessionStatus(status === 'paused' ? 'running' : 'paused');
    };

    const handleResetView = () => {
        // We'll use a custom event to tell VolumeViewer to reset its camera
        window.dispatchEvent(new CustomEvent('reset-simulator-view'));
    };

    const handleEndSession = () => {
        if (window.confirm('Are you sure you want to end the current training session?')) {
            resetSession();
            window.location.href = '/';
        }
    };

    return (
        <header className={styles.header}>
            {/* 1. System Navigation & Status */}
            <div className={styles.leftSection}>
                <button className={styles.menuBtn} onClick={onToggleSidebar}>
                    <Menu size={18} />
                </button>
                <div className={styles.brand}>
                    <span className={styles.brandText}>USim</span>
                    <span className={styles.brandSub}>PRO</span>
                </div>
                <div className={styles.divider} />
                <div className={styles.statusGroup}>
                    <div className={styles.badge}>
                        <Activity size={12} className={status === 'running' ? styles.pulse : ''} />
                        <span>{status.toUpperCase()}</span>
                    </div>
                    <div className={styles.badge}>
                        <Wifi size={12} color={connectionStatus === 'connected' ? '#4ade80' : '#f87171'} />
                        <span>{connectionStatus.toUpperCase()}</span>
                    </div>
                    <div className={styles.timer}>00:12:47</div>
                </div>
            </div>

            {/* 2. Mode & Training Controls */}
            <div className={styles.centerSection}>
                <div className={styles.modeControls}>
                    <span className={styles.sectionLabel}>MODE</span>
                    <div className={styles.difficultyPill}>
                        {['beginner', 'intermediate', 'advanced'].map(mode => (
                            <button
                                key={mode}
                                className={`${styles.pillBtn} ${visualizationSettings.mode === mode ? styles.pillActive : ''}`}
                                onClick={() => setVisualizationMode(mode as any)}
                            >
                                {mode.charAt(0).toUpperCase() + mode.slice(1)}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* 3. Global Actions */}
            <div className={styles.rightSection}>
                <div className={styles.actionGroup}>
                    <button 
                        className={styles.iconBtn} 
                        title={status === 'paused' ? 'Resume' : 'Pause'}
                        onClick={handlePlayPause}
                    >
                        {status === 'paused' ? <Play size={16} fill="currentColor" /> : <Pause size={16} fill="currentColor" />}
                    </button>
                    <button 
                        className={styles.iconBtn} 
                        title="Reset View"
                        onClick={handleResetView}
                    >
                        <RotateCcw size={16} />
                    </button>
                    <div className={styles.divider} />
                    <button className={styles.settingsBtn}>
                        <Settings size={14} />
                        <span>IMAGE PARAMS</span>
                        <ChevronDown size={12} />
                    </button>
                    <button className={styles.stopButton} onClick={handleEndSession}>
                        <Zap size={14} fill="#f87171" />
                        <span>END SESSION</span>
                    </button>
                </div>
            </div>
        </header>
    );
};
