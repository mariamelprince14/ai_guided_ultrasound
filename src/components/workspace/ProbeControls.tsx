import React from 'react';
import { Card } from '@components/ui/Card';
import { Button } from '@components/ui/Button';
import { useAppStore } from '@store/useAppStore';
import { apiService } from '@services/api';
import { formatPoseValue } from '@utils/formatters';
import {
    Hand,
    RotateCcw,
    Move,
    Lock,
    Rotate3d,
    Gauge,
    Activity
} from 'lucide-react';
import type { ProbePose } from '@/types';
import styles from './ProbeControls.module.css';

export const ProbeControls: React.FC = () => {
    const { sessionId, currentPose, imagingSettings, updatePose, updateImagingSettings } = useAppStore();

    const handleUpdate = async (updates: Partial<ProbePose['position'] | ProbePose['rotation']>, type: 'pos' | 'rot') => {
        const newPose = { ...currentPose };
        if (type === 'pos') {
            newPose.position = { ...newPose.position, ...updates };
        } else {
            newPose.rotation = { ...newPose.rotation, ...updates };
        }

        // Local update for immediate feedback
        updatePose(newPose);

        // Backend update (authoritative)
        if (sessionId) {
            try {
                await apiService.updateProbePose(sessionId, newPose);
            } catch (error) {
                console.error('Failed to update probe pose:', error);
            }
        }
    };

    const resetPose = () => {
        handleUpdate({ x: 0, y: 0, z: 0 }, 'pos');
        handleUpdate({ pitch: 0, roll: 0, yaw: 0 }, 'rot');
    };

    return (
        <Card title={<span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Hand size={18} color="var(--color-primary-500)" /> Probe Manipulation</span>}>
            <div className={styles.controls}>
                {/* Translation Section */}
                <div className={styles.section}>
                    <h4 className={styles.sectionTitle}>
                        <Move size={12} style={{ marginRight: '6px' }} />
                        Translation
                    </h4>
                    <div className={styles.sliderGroup}>
                        <div className={styles.sliderLabel}>
                            <span>X</span>
                            <span>{formatPoseValue(currentPose.position.x)}</span>
                        </div>
                        <input
                            type="range"
                            min="-2"
                            max="2"
                            step="0.1"
                            value={currentPose.position.x}
                            onChange={(e) => handleUpdate({ x: parseFloat(e.target.value) }, 'pos')}
                            className={styles.slider}
                        />
                    </div>
                    <div className={styles.sliderGroup}>
                        <div className={styles.sliderLabel}>
                            <span>Y</span>
                            <span>{formatPoseValue(currentPose.position.y)}</span>
                        </div>
                        <input
                            type="range"
                            min="-2"
                            max="2"
                            step="0.1"
                            value={currentPose.position.y}
                            onChange={(e) => handleUpdate({ y: parseFloat(e.target.value) }, 'pos')}
                            className={styles.slider}
                        />
                    </div>
                    <div className={styles.sliderGroup}>
                        <div className={styles.sliderLabel}>
                            <span>Z</span>
                            <span>{formatPoseValue(currentPose.position.z)}</span>
                        </div>
                        <input
                            type="range"
                            min="-1"
                            max="1"
                            step="0.1"
                            value={currentPose.position.z}
                            onChange={(e) => handleUpdate({ z: parseFloat(e.target.value) }, 'pos')}
                            className={styles.slider}
                        />
                    </div>
                </div>

                {/* Rotation Section */}
                <div className={styles.section}>
                    <h4 className={styles.sectionTitle}>
                        <Rotate3d size={12} style={{ marginRight: '6px' }} />
                        Rotation
                    </h4>
                    <div className={styles.sliderGroup}>
                        <div className={styles.sliderLabel}>
                            <span>Pitch</span>
                            <span>{formatPoseValue(currentPose.rotation.pitch, 0)}°</span>
                        </div>
                        <input
                            type="range"
                            min="-45"
                            max="45"
                            step="1"
                            value={currentPose.rotation.pitch}
                            onChange={(e) => handleUpdate({ pitch: parseFloat(e.target.value) }, 'rot')}
                            className={styles.slider}
                        />
                    </div>
                    <div className={styles.sliderGroup}>
                        <div className={styles.sliderLabel}>
                            <span>Roll</span>
                            <span>{formatPoseValue(currentPose.rotation.roll, 0)}°</span>
                        </div>
                        <input
                            type="range"
                            min="-45"
                            max="45"
                            step="1"
                            value={currentPose.rotation.roll}
                            onChange={(e) => handleUpdate({ roll: parseFloat(e.target.value) }, 'rot')}
                            className={styles.slider}
                        />
                    </div>
                    <div className={styles.sliderGroup}>
                        <div className={styles.sliderLabel}>
                            <span>Yaw</span>
                            <span>{formatPoseValue(currentPose.rotation.yaw, 0)}°</span>
                        </div>
                        <input
                            type="range"
                            min="-180"
                            max="180"
                            step="1"
                            value={currentPose.rotation.yaw}
                            onChange={(e) => handleUpdate({ yaw: parseFloat(e.target.value) }, 'rot')}
                            className={styles.slider}
                        />
                    </div>
                </div>

                {/* Simulation Parameters */}
                <div className={styles.section}>
                    <h4 className={styles.sectionTitle}>
                        <Gauge size={12} style={{ marginRight: '6px' }} />
                        Imaging
                    </h4>
                    <div className={styles.sliderGroup}>
                        <div className={styles.sliderLabel}>
                            <span>Gain</span>
                            <span>{imagingSettings.gain}%</span>
                        </div>
                        <input
                            type="range"
                            min="0"
                            max="100"
                            step="1"
                            value={imagingSettings.gain}
                            onChange={(e) => updateImagingSettings({ gain: parseInt(e.target.value) })}
                            className={styles.slider}
                        />
                    </div>
                    <div className={styles.sliderGroup}>
                        <div className={styles.sliderLabel}>
                            <span>Depth</span>
                            <span>{imagingSettings.depth}cm</span>
                        </div>
                        <input
                            type="range"
                            min="5"
                            max="30"
                            step="1"
                            value={imagingSettings.depth}
                            onChange={(e) => updateImagingSettings({ depth: parseInt(e.target.value) })}
                            className={styles.slider}
                        />
                    </div>
                    <div className={styles.sliderGroup}>
                        <div className={styles.sliderLabel}>
                            <span>Power</span>
                            <span>{imagingSettings.power}%</span>
                        </div>
                        <input
                            type="range"
                            min="0"
                            max="100"
                            step="1"
                            value={imagingSettings.power}
                            onChange={(e) => updateImagingSettings({ power: parseInt(e.target.value) })}
                            className={styles.slider}
                        />
                    </div>
                    <div className={styles.sliderGroup}>
                        <div className={styles.sliderLabel}>
                            <span>D-Range</span>
                            <span>{imagingSettings.dynamicRange}dB</span>
                        </div>
                        <input
                            type="range"
                            min="30"
                            max="90"
                            step="1"
                            value={imagingSettings.dynamicRange}
                            onChange={(e) => updateImagingSettings({ dynamicRange: parseInt(e.target.value) })}
                            className={styles.slider}
                        />
                    </div>
                </div>

                {/* Biomechanical Props */}
                <div className={styles.section}>
                    <h4 className={styles.sectionTitle}>
                        <Activity size={12} style={{ marginRight: '6px' }} />
                        Props
                    </h4>
                    <div className={styles.sliderGroup}>
                        <div className={styles.sliderLabel}>
                            <span>Freq</span>
                            <span>{imagingSettings.frequency}</span>
                        </div>
                        <input
                            type="range"
                            min="2"
                            max="18"
                            step="0.5"
                            value={imagingSettings.frequency}
                            onChange={(e) => updateImagingSettings({ frequency: parseFloat(e.target.value) })}
                            className={styles.slider}
                        />
                    </div>
                    <div className={styles.sliderGroup}>
                        <div className={styles.sliderLabel}>
                            <span>Press</span>
                            <span>{imagingSettings.contactPressure.toFixed(1)}</span>
                        </div>
                        <input
                            type="range"
                            min="0"
                            max="10"
                            step="0.1"
                            value={imagingSettings.contactPressure}
                            onChange={(e) => updateImagingSettings({ contactPressure: parseFloat(e.target.value) })}
                            className={styles.slider}
                        />
                    </div>
                </div>

                <div className={styles.actions}>
                    <Button variant="secondary" size="small" onClick={resetPose}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <RotateCcw size={12} /> Reset
                        </span>
                    </Button>
                    <div className={styles.lockOption}>
                        <label>
                            <input type="checkbox" />
                            <Lock size={10} /> Lock Axis
                        </label>
                    </div>
                </div>

                <div className={styles.poseReadout}>
                    <div className={styles.readoutItem}>
                        <span className={styles.readoutLabel}>P:</span>
                        <span>[{formatPoseValue(currentPose.position.x, 1)}, {formatPoseValue(currentPose.position.y, 1)}, {formatPoseValue(currentPose.position.z, 1)}]</span>
                    </div>
                    <div className={styles.readoutItem}>
                        <span className={styles.readoutLabel}>R:</span>
                        <span>[{formatPoseValue(currentPose.rotation.pitch, 0)}°, {formatPoseValue(currentPose.rotation.roll, 0)}°, {formatPoseValue(currentPose.rotation.yaw, 0)}°]</span>
                    </div>
                </div>
            </div>
        </Card>
    );
};
