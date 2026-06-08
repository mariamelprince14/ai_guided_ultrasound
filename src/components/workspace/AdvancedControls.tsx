/**
 * AdvancedControls.tsx
 * ────────────────────
 * Hidden developer/calibration panel with full slider controls.
 * Only shown when "Advanced Controls" toggle is enabled.
 * 
 * This preserves the original slider interface for:
 * - Debugging
 * - Calibration
 * - Testing
 * 
 * But keeps it out of the trainee's view in normal operation.
 */

import React from 'react';
import { useAppStore } from '@store/useAppStore';
import styles from './AdvancedControls.module.css';

export const AdvancedControls: React.FC = () => {
    const {
        probePos,
        probeRot,
        setProbePos,
        setProbeRot,
        registration,
        setRegistration,
        probePhysics,
    } = useAppStore();

    const handlePosChange = (axis: 'x' | 'y' | 'z', value: number) => {
        setProbePos({
            ...probePos,
            [axis]: value,
        });
    };

    const handleRotChange = (axis: 'pitch' | 'yaw' | 'roll', value: number) => {
        setProbeRot({
            ...probeRot,
            [axis]: value,
        });
    };

    const handleRegChange = (axis: 'x' | 'y' | 'z', value: number) => {
        const newPos = [...registration.position] as [number, number, number];
        newPos[{ x: 0, y: 1, z: 2 }[axis]] = value;
        setRegistration({ ...registration, position: newPos });
    };

    const handleRotRegChange = (axis: number, value: number) => {
        const newRot = [...registration.rotation] as [number, number, number];
        newRot[axis] = value;
        setRegistration({ ...registration, rotation: newRot });
    };

    return (
        <div className={styles.panel}>
            <div className={styles.titleRow}>
                <h3 className={styles.title}>🔧 Advanced Controls (Dev Mode)</h3>
                <span className={styles.badge}>Debug Only</span>
            </div>

            {/* Probe Position */}
            <div className={styles.section}>
                <div className={styles.sectionTitle}>Probe Position (mm)</div>
                {(['x', 'y', 'z'] as const).map((axis) => (
                    <div className={styles.row} key={`pos-${axis}`}>
                        <label className={styles.label}>{axis.toUpperCase()}</label>
                        <input
                            type="range"
                            className={styles.slider}
                            min="-300"
                            max="300"
                            step="1"
                            value={probePos[axis]}
                            onChange={(e) =>
                                handlePosChange(axis, parseFloat(e.target.value))
                            }
                        />
                        <span className={styles.value}>{probePos[axis]}</span>
                    </div>
                ))}
            </div>

            {/* Probe Rotation */}
            <div className={styles.section}>
                <div className={styles.sectionTitle}>Probe Rotation (deg)</div>
                {(
                    [
                        { key: 'pitch', label: 'Pitch' },
                        { key: 'yaw', label: 'Yaw' },
                        { key: 'roll', label: 'Roll' },
                    ] as const
                ).map(({ key, label }) => (
                    <div className={styles.row} key={`rot-${key}`}>
                        <label className={styles.label}>{label}</label>
                        <input
                            type="range"
                            className={styles.slider}
                            min="-180"
                            max="180"
                            step="1"
                            value={probeRot[key]}
                            onChange={(e) =>
                                handleRotChange(key, parseFloat(e.target.value))
                            }
                        />
                        <span className={styles.value}>{probeRot[key]}°</span>
                    </div>
                ))}
            </div>

            {/* Volume Registration */}
            <div className={styles.section}>
                <div className={styles.sectionTitle}>Volume Registration</div>

                <div className={styles.subsection}>
                    <div className={styles.subsectionTitle}>Position (mm)</div>
                    {(['x', 'y', 'z'] as const).map((axis) => (
                        <div className={styles.row} key={`reg-pos-${axis}`}>
                            <label className={styles.label}>{axis.toUpperCase()}</label>
                            <input
                                type="range"
                                className={styles.slider}
                                min="-300"
                                max="300"
                                step="1"
                                value={
                                    registration.position[
                                        { x: 0, y: 1, z: 2 }[axis]
                                    ]
                                }
                                onChange={(e) =>
                                    handleRegChange(axis, parseFloat(e.target.value))
                                }
                            />
                            <span className={styles.value}>
                                {
                                    registration.position[
                                        { x: 0, y: 1, z: 2 }[axis]
                                    ]
                                }
                            </span>
                        </div>
                    ))}
                </div>

                <div className={styles.subsection}>
                    <div className={styles.subsectionTitle}>Rotation (deg)</div>
                    {['Pitch (X)', 'Yaw (Y)', 'Roll (Z)'].map((label, i) => (
                        <div className={styles.row} key={`reg-rot-${i}`}>
                            <label className={styles.label}>{label.split(' ')[0]}</label>
                            <input
                                type="range"
                                className={styles.slider}
                                min="-180"
                                max="180"
                                step="1"
                                value={registration.rotation[i]}
                                onChange={(e) =>
                                    handleRotRegChange(i, parseFloat(e.target.value))
                                }
                            />
                            <span className={styles.value}>{registration.rotation[i]}°</span>
                        </div>
                    ))}
                </div>

                <div className={styles.subsection}>
                    <div className={styles.subsectionTitle}>Scale</div>
                    <div className={styles.row}>
                        <label className={styles.label}>S</label>
                        <input
                            type="range"
                            className={styles.slider}
                            min="0.3"
                            max="3.0"
                            step="0.01"
                            value={registration.scale}
                            onChange={(e) =>
                                setRegistration({
                                    ...registration,
                                    scale: parseFloat(e.target.value),
                                })
                            }
                        />
                        <span className={styles.value}>
                            {registration.scale.toFixed(2)}
                        </span>
                    </div>
                </div>
            </div>

            {/* Physics Status */}
            <div className={styles.section}>
                <div className={styles.sectionTitle}>Probe Physics</div>
                <div className={styles.infoBox}>
                    <div>
                        In Contact:{' '}
                        <strong>
                            {probePhysics.surfaceContact.isInContact ? 'Yes' : 'No'}
                        </strong>
                    </div>
                    <div>
                        Pressure:{' '}
                        <strong>
                            {(probePhysics.surfaceContact.pressureLevel * 100).toFixed(
                                0
                            )}
                            %
                        </strong>
                    </div>
                    <div>
                        Penetration:{' '}
                        <strong>
                            {probePhysics.surfaceContact.penetrationDepth.toFixed(1)}{' '}
                            mm
                        </strong>
                    </div>
                </div>
            </div>

            <div className={styles.warning}>
                ⚠ These controls are for development/debug use only. Not visible to
                trainees.
            </div>
        </div>
    );
};
