import React, { useRef, useEffect } from 'react';
import { useAppStore } from '@store/useAppStore';
import { Badge } from '@components/ui/Badge';
import { Button } from '@components/ui/Button';
import { apiService } from '@services/api';
import { getQualityLabel } from '@utils/formatters';
import {
    Play,
    Pause,
    Camera,
    Target,
    Layers,
    ScanEye
} from 'lucide-react';
import styles from './UltrasoundViewer.module.css';

interface UltrasoundViewerProps {
    imageSrc?: string;
}

export const UltrasoundViewer: React.FC<UltrasoundViewerProps> = ({ imageSrc }) => {
    const { sessionId, status, currentFrame, currentFeedback, config } = useAppStore();
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const frameToRender = imageSrc || currentFrame;

        if (frameToRender && canvasRef.current) {
            const canvas = canvasRef.current;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                const img = new Image();
                img.onload = () => {
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                };
                // If it's a static src, use it directly. If it's a base64 frame, prepend prefix.
                img.src = imageSrc ? imageSrc : `data:image/jpeg;base64,${frameToRender}`;
            }
        }
    }, [currentFrame, imageSrc]);

    const handleCapture = async () => {
        if (sessionId) {
            try {
                await apiService.captureSnapshot(sessionId);
            } catch (error) {
                console.error('Failed to capture snapshot:', error);
            }
        }
    };

    const handleFreeze = async () => {
        if (sessionId) {
            try {
                await apiService.freezeStream(sessionId, status === 'running');
            } catch (error) {
                console.error('Failed to toggle freeze:', error);
            }
        }
    };

    const qualityInfo = currentFeedback ? getQualityLabel(currentFeedback.qualityScore) : null;

    return (
        <div className={styles.container}>
            {/* Ultrasound Display */}
            <div className={styles.viewport}>
                <canvas
                    ref={canvasRef}
                    className={styles.canvas}
                    width={800}
                    height={600}
                />

                {/* Medical Scanline Overlay */}
                <div className={styles.scanline} />
                <div className={styles.vignette} />

                {!currentFrame && (
                    <div className={styles.placeholder}>
                        <div className={styles.spinner} />
                        <p>Awaiting ultrasound stream...</p>
                    </div>
                )}

                {/* HUD Overlay */}
                <div className={styles.hud}>
                    <div className={styles.hudTop}>
                        <div className={styles.hudGroup}>
                            <span className={styles.hudLabel}>
                                <Target size={10} style={{ marginRight: '4px' }} />
                                TARGET:
                            </span>
                            <span className={styles.hudValue}>{config?.targetOrgans[0]?.toUpperCase() || 'NONE'}</span>
                        </div>
                        {currentFeedback && (
                            <div className={styles.hudGroup}>
                                <span className={styles.hudLabel}>
                                    <ScanEye size={10} style={{ marginRight: '4px' }} />
                                    VIEW:
                                </span>
                                <Badge variant="info">
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <Layers size={12} />
                                        {currentFeedback.viewLabel}
                                    </span>
                                </Badge>
                            </div>
                        )}
                    </div>

                    <div className={styles.hudBottom}>
                        {currentFeedback && (
                            <div className={styles.qualityBar}>
                                <div className={styles.qualityHeader}>
                                    <span className={styles.hudLabel}>QUALITY SCORE:</span>
                                    <span className={styles.qualityValue} style={{ color: qualityInfo?.color }}>
                                        {currentFeedback.qualityScore}% - {qualityInfo?.label}
                                    </span>
                                </div>
                                <div className={styles.progressBar}>
                                    <div
                                        className={styles.progressFill}
                                        style={{
                                            width: `${currentFeedback.qualityScore}%`,
                                            backgroundColor: qualityInfo?.color,
                                        }}
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Controls */}
            <div className={styles.controls}>
                <div className={styles.leftControls}>
                    <Button variant="secondary" size="small" onClick={handleFreeze}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            {status === 'paused' ? <Play size={14} fill="currentColor" /> : <Pause size={14} fill="currentColor" />}
                            {status === 'paused' ? 'Resume' : 'Freeze'}
                        </span>
                    </Button>
                    <Button variant="secondary" size="small" onClick={handleCapture}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Camera size={14} />
                            Snapshot
                        </span>
                    </Button>
                </div>
                <div className={styles.rightControls}>
                    <label className={styles.toggle}>
                        <input type="checkbox" defaultChecked />
                        <span className={styles.toggleLabel}>Show guidance overlay</span>
                    </label>
                </div>
            </div>
        </div>
    );
};
