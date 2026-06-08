/**
 * UltrasoundViewer.tsx
 * ─────────────────────
 * Live ultrasound imaging monitor panel.
 * Placed in the right panel of the workstation layout.
 * Displays the real-time scan output from the backend renderer.
 */
import React, { useRef, useEffect } from 'react';
import { useAppStore } from '@store/useAppStore';
import { wsService } from '@services/websocket';
import {
    Play,
    Pause,
    Camera,
    Target,
} from 'lucide-react';
import styles from './UltrasoundViewer.module.css';

interface UltrasoundViewerProps {
    imageSrc?: string;
}

export const UltrasoundViewer: React.FC<UltrasoundViewerProps> = ({ imageSrc }) => {
    const { sessionId, status, setSessionStatus, currentFrame } = useAppStore();
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
                img.src = imageSrc ? imageSrc : `data:image/jpeg;base64,${frameToRender}`;
            }
        }
    }, [currentFrame, imageSrc]);

    const handleCapture = async () => {
        if (sessionId) {
            wsService.sendCapture();
        }
    };

    const handleFreeze = async () => {
        if (sessionId) {
            setSessionStatus(status === 'paused' ? 'running' : 'paused');
        }
    };

    return (
        <div className={styles.container}>
            {/* Monitor title strip */}
            <div className={styles.monitorHeader}>
                <span className={styles.monitorTitle}>ULTRASOUND MONITOR</span>
                <span className={styles.monitorBadge}>
                    ● LIVE
                </span>
            </div>

            {/* Ultrasound Display */}
            <div className={styles.viewport}>
                {/* Ruler markings (left side) */}
                <div className={styles.ruler}>
                    {[0, 2, 4, 6, 8, 10].map(d => (
                        <div key={d} className={styles.rulerMark}>
                            <span>{d}</span>
                            <div className={styles.tick} />
                        </div>
                    ))}
                </div>

                <canvas
                    ref={canvasRef}
                    className={styles.canvas}
                    width={800}
                    height={600}
                />

                {/* HUD Overlay */}
                <div className={styles.hud}>
                    <div className={styles.hudTopRight}>
                        <div className={styles.metadata}>US-DEMO-2026</div>
                        <div className={styles.metadata}>{new Date().toLocaleDateString()}</div>
                    </div>
                    
                    <div className={styles.targetBadge}>
                        <Target size={12} className={styles.targetIcon} />
                        <span>TARGET: KIDNEY</span>
                    </div>

                    <div className={styles.depthIndicator}>
                        10
                    </div>
                </div>
            </div>

            {/* Controls strip */}
            <div className={styles.controls}>
                <div className={styles.buttonGroup}>
                    <button className={styles.actionBtn} onClick={handleFreeze}>
                        {status === 'paused' ? <Play size={14} fill="currentColor" /> : <Pause size={14} fill="currentColor" />}
                        {status === 'paused' ? 'RESUME' : 'FREEZE'}
                    </button>
                    <button className={styles.actionBtn} onClick={handleCapture}>
                        <Camera size={14} />
                        SNAPSHOT
                    </button>
                </div>
                
                <div className={styles.guidanceToggle}>
                    <span>Guidance Overlay</span>
                    <div className={styles.switch}>
                        <input type="checkbox" defaultChecked />
                        <span className={styles.slider} />
                    </div>
                </div>
            </div>
        </div>
    );
};
