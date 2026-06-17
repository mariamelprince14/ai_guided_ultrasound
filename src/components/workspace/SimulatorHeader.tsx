import React, { useState, useEffect } from 'react';
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
    Smartphone,
    X,
    Copy,
    Check,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useAppStore } from '@store/useAppStore';
import { apiService } from '@services/api';
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

    const [showPhoneModal, setShowPhoneModal] = useState(false);
    const sessionId = useAppStore((s) => s.sessionId);
    const [lanIp, setLanIp] = useState<string>('');
    const [tunnelUrl, setTunnelUrl] = useState<string>('');

    useEffect(() => {
        if (showPhoneModal) {
            apiService.getNetworkInfo()
                .then(info => {
                    if (info) {
                        if (info.lanIp) setLanIp(info.lanIp);
                        if (info.tunnelUrl) setTunnelUrl(info.tunnelUrl);
                    }
                })
                .catch(err => {
                    console.error('Failed to fetch network info:', err);
                });
        }
    }, [showPhoneModal]);

    const [copied, setCopied] = useState(false);

    const handleCopySessionCode = () => {
        if (sessionId) {
            navigator.clipboard.writeText(sessionId);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
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
                    <button className={styles.phoneBtn} onClick={() => setShowPhoneModal(true)} title="Connect Phone as Probe">
                        <Smartphone size={14} />
                        <span>PHONE</span>
                    </button>
                    <button className={styles.stopButton} onClick={handleEndSession}>
                        <Zap size={14} fill="#f87171" />
                        <span>END SESSION</span>
                    </button>
                </div>
            </div>

            {/* Phone QR Code Modal */}
            {showPhoneModal && (
                <div className={styles.phoneOverlay} onClick={() => setShowPhoneModal(false)}>
                    <div className={styles.phoneModal} onClick={(e) => e.stopPropagation()}>
                        <div className={styles.phoneModalHead}>
                            <h3>📱 Connect Phone as Probe</h3>
                            <button className={styles.phoneCloseBtn} onClick={() => setShowPhoneModal(false)}>
                                <X size={18} />
                            </button>
                        </div>
                        <div className={styles.phoneModalContent}>
                            <p className={styles.phoneDesc}>
                                Scan this QR code with your phone to use it as a physical probe controller.
                                Make sure your phone is on the same WiFi network.
                            </p>
                            {sessionId ? (
                                <>
                                    <div className={styles.qrImg}>
                                        <QRCodeSVG
                                            value={tunnelUrl ? `${tunnelUrl}/phone/phone_controller.html?session=${sessionId}` : `http://${lanIp || window.location.hostname}:8000/phone/phone_controller.html?session=${sessionId}`}
                                            size={200}
                                            bgColor="#ffffff"
                                            fgColor="#0f172a"
                                            level="M"
                                        />
                                    </div>
                                    <div className={styles.sessionDisplay}>
                                        <span className={styles.sessionLbl}>Session ID</span>
                                        <div className={styles.sessionCopyContainer}>
                                            <code className={styles.sessionCode}>{sessionId}</code>
                                            <button 
                                                className={styles.copyBtn} 
                                                onClick={handleCopySessionCode}
                                                title="Copy Session ID"
                                            >
                                                {copied ? <Check size={14} /> : <Copy size={14} />}
                                            </button>
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <p className={styles.phoneDesc}>No active session. Start a session first.</p>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </header>
    );
};
