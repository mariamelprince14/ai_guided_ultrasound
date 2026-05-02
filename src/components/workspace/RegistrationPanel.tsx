/**
 * RegistrationPanel.tsx
 * ─────────────────────
 * Floating panel for CT-to-torso alignment with anatomically-guided controls.
 * 
 * Workflow:
 *  1. Enable "Registration Mode" to get semi-transparent torso + alignment helpers
 *  2. Adjust Orientation (rotation) to match CT axes to torso axes
 *  3. Adjust Scale so the CT body contour fits inside the torso shell
 *  4. Fine-tune Position to center anatomy (spine posterior, liver right upper)
 *  5. Save Alignment
 */
import React, { useState } from 'react';
import { useAppStore } from '@store/useAppStore';
import styles from './RegistrationPanel.module.css';

export const RegistrationPanel: React.FC = () => {
    const {
        registration, setRegistration,
        torsoSettings, setTorsoSettings,
        selectedCaseId, saveRegistration,
        centerCTInTorso, fitCTToTorso
    } = useAppStore();
    const [collapsed, setCollapsed] = useState(false);
    const [registrationMode, setRegistrationMode] = useState(false);

    if (!torsoSettings || !registration) return null;

    // Toggle registration mode: sets optimal display for alignment work
    const toggleRegistrationMode = () => {
        const entering = !registrationMode;
        setRegistrationMode(entering);
        if (entering) {
            setTorsoSettings({ 
                opacity: 0.3, 
                wireframe: true, 
                ctVisible: true,
                torsoBoundingBoxVisible: true,
                ctBoundingBoxVisible: true
            });
        } else {
            setTorsoSettings({ 
                opacity: 0.8, 
                wireframe: false, 
                ctVisible: true,
                torsoBoundingBoxVisible: false,
                ctBoundingBoxVisible: false
            });
        }
    };

    const handlePos = (idx: number, val: number) => {
        const newPos = [...registration.position] as [number, number, number];
        newPos[idx] = val;
        setRegistration({ ...registration, position: newPos });
    };

    const handleRot = (idx: number, val: number) => {
        const newRot = [...registration.rotation] as [number, number, number];
        newRot[idx] = val;
        setRegistration({ ...registration, rotation: newRot });
    };

    const handleSave = () => {
        if (selectedCaseId) {
            saveRegistration(selectedCaseId);
        }
    };

    const handleReset = () => {
        setRegistration({ position: [0, 0, 0], rotation: [0, 0, 0], scale: 1 });
    };

    // Quick rotation presets for common orientation corrections
    const rotPresets = [
        { label: '0°', rot: [0, 0, 0] },
        { label: '90° X', rot: [90, 0, 0] },
        { label: '90° Y', rot: [0, 90, 0] },
        { label: '180° Y', rot: [0, 180, 0] },
    ];

    if (collapsed) {
        return (
            <div className={styles.panelCollapsed} onClick={() => setCollapsed(false)}>
                ⚙ Alignment
            </div>
        );
    }

    return (
        <div className={styles.panel}>
            <div className={styles.titleRow}>
                <h3 className={styles.title}>Scene Alignment</h3>
                <button className={styles.collapseBtn} onClick={() => setCollapsed(true)}>—</button>
            </div>

            {/* Registration Mode Toggle */}
            <button
                className={registrationMode ? styles.regBtnActive : styles.regBtn}
                onClick={toggleRegistrationMode}
            >
                {registrationMode ? '✓ Registration Mode' : '⚙ Enter Registration Mode'}
            </button>

            {/* Visibility / Display */}
            <div className={styles.section}>
                <div className={styles.sectionTitle}>Display</div>
                <label className={styles.checkboxRow}>
                    <input type="checkbox"
                        checked={torsoSettings.ctVisible}
                        onChange={e => setTorsoSettings({ ctVisible: e.target.checked })}
                    />
                    CT Volume
                </label>
                <label className={styles.checkboxRow}>
                    <input type="checkbox"
                        checked={torsoSettings.torsoBoundingBoxVisible}
                        onChange={e => setTorsoSettings({ torsoBoundingBoxVisible: e.target.checked })}
                    />
                    Torso Bounds
                </label>
                <label className={styles.checkboxRow}>
                    <input type="checkbox"
                        checked={torsoSettings.ctBoundingBoxVisible}
                        onChange={e => setTorsoSettings({ ctBoundingBoxVisible: e.target.checked })}
                    />
                    CT Bounds
                </label>
                <label className={styles.checkboxRow}>
                    <input type="checkbox"
                        checked={torsoSettings.wireframe}
                        onChange={e => setTorsoSettings({ wireframe: e.target.checked })}
                    />
                    Torso Wireframe
                </label>
                <div className={styles.row}>
                    <span className={styles.label}>Opacity</span>
                    <input type="range" className={styles.slider}
                        min={0} max={1} step={0.05}
                        value={torsoSettings.opacity}
                        onChange={e => setTorsoSettings({ opacity: parseFloat(e.target.value) })}
                    />
                    <span className={styles.val}>{torsoSettings.opacity.toFixed(2)}</span>
                </div>
            </div>

            {/* Step 1: Orientation */}
            <div className={styles.section}>
                <div className={styles.sectionTitle}>① Orientation (deg)</div>
                <div className={styles.presetRow}>
                    {rotPresets.map((p) => (
                        <button key={p.label} className={styles.presetBtn}
                            onClick={() => setRegistration({
                                ...registration,
                                rotation: p.rot as [number, number, number]
                            })}
                        >
                            {p.label}
                        </button>
                    ))}
                </div>
                {['Pitch (X)', 'Yaw (Y)', 'Roll (Z)'].map((axis, i) => (
                    <div className={styles.row} key={axis}>
                        <span className={styles.label}>{axis.split(' ')[0]}</span>
                        <input type="range" className={styles.slider}
                            min={-180} max={180} step={1}
                            value={registration.rotation[i]}
                            onChange={e => handleRot(i, parseFloat(e.target.value))}
                        />
                        <span className={styles.val}>{registration.rotation[i]}°</span>
                    </div>
                ))}
            </div>

            {/* Step 2: Scale */}
            <div className={styles.section}>
                <div className={styles.sectionTitle}>② Scale (uniform)</div>
                <div className={styles.row}>
                    <span className={styles.label}>S</span>
                    <input type="range" className={styles.slider}
                        min={0.3} max={3.0} step={0.01}
                        value={registration.scale}
                        onChange={e => setRegistration({ ...registration, scale: parseFloat(e.target.value) })}
                    />
                    <span className={styles.val}>{registration.scale.toFixed(2)}</span>
                </div>
                <div className={styles.presetRow}>
                    <button className={styles.presetBtn} onClick={fitCTToTorso}>Auto-Fit Scale</button>
                    <button className={styles.presetBtn} onClick={centerCTInTorso}>Center Position</button>
                </div>
            </div>

            {/* Step 3: Position */}
            <div className={styles.section}>
                <div className={styles.sectionTitle}>③ Position (mm)</div>
                {['X (L/R)', 'Y (A/P)', 'Z (S/I)'].map((axis, i) => (
                    <div className={styles.row} key={axis}>
                        <span className={styles.label}>{axis.split(' ')[0]}</span>
                        <input type="range" className={styles.slider}
                            min={-300} max={300} step={1}
                            value={registration.position[i]}
                            onChange={e => handlePos(i, parseFloat(e.target.value))}
                        />
                        <span className={styles.val}>{registration.position[i]}</span>
                    </div>
                ))}
            </div>

            {/* Actions */}
            <div className={styles.actionRow}>
                <button className={styles.resetBtn} onClick={handleReset}>Reset</button>
                <button className={styles.saveBtn} onClick={handleSave}>Save</button>
            </div>
        </div>
    );
};
