import React from 'react';
import { Card } from '@components/ui/Card';
import styles from './Help.module.css';

export const Help: React.FC = () => {
    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <h1>Help & Documentation</h1>
                <p className="text-muted">Learn how to use the AI-Guided Ultrasound Training System</p>
            </div>

            <div className={styles.sections}>
                <section className={styles.section}>
                    <h3>Training Modes</h3>
                    <div className={styles.modeCards}>
                        <Card title="Full Experience">
                            <p>Manipulate the probe to acquire standard views of target organs. AI provides real-time feedback on your scan quality and positioning.</p>
                        </Card>
                        <Card title="Image Assessment">
                            <p>Practice interpreting ultrasound images through clinical scenarios and multiple-choice questions focused on abnormalities.</p>
                        </Card>
                        <Card title="Identification">
                            <p>Train your eye to recognize organs and anatomical landmarks. Match images to their corresponding anatomical views.</p>
                        </Card>
                    </div>
                </section>

                <section className={styles.section}>
                    <h3>System Controls</h3>
                    <Card>
                        <table className={styles.table}>
                            <thead>
                                <tr>
                                    <th>Control</th>
                                    <th>Action</th>
                                    <th>Description</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td><strong>Translation Sliders</strong></td>
                                    <td>X, Y, Z Movement</td>
                                    <td>Slides the probe across the abdominal surface.</td>
                                </tr>
                                <tr>
                                    <td><strong>Rotation Sliders</strong></td>
                                    <td>Angle adjustment</td>
                                    <td>Changes the tilt and orientation of the probe head.</td>
                                </tr>
                                <tr>
                                    <td><strong>Freeze Button</strong></td>
                                    <td>Pause Stream</td>
                                    <td>Halts the real-time simulation to allow for static image analysis.</td>
                                </tr>
                                <tr>
                                    <td><strong>Snapshot</strong></td>
                                    <td>Save Image</td>
                                    <td>Captures the current B-mode frame and saves it to your session results.</td>
                                </tr>
                            </tbody>
                        </table>
                    </Card>
                </section>

                <section className={styles.section}>
                    <h3>Quality Score Explained</h3>
                    <Card>
                        <p>The Quality Score (0-100%) indicates how well the current ultrasound view matches the target anatomical criteria. Higher scores are achieved by:</p>
                        <ul className={styles.list}>
                            <li>Centering the target organ in the field of view.</li>
                            <li>Maintaining appropriate depth and gain settings (backend optimized).</li>
                            <li>Reducing artifacts and shadowing by optimal probe angling.</li>
                            <li>Selecting the correct transducer for the target anatomical region.</li>
                        </ul>
                    </Card>
                </section>

                <div className={styles.disclaimer}>
                    <p><strong>Disclaimer:</strong> This system is for training purposes only. It does not provide medical diagnosis or clinical decision support. Always consult a qualified professional for medical interpretations.</p>
                </div>
            </div>
        </div>
    );
};
