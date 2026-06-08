import React from 'react';
import { ChevronDown, Sliders, Settings, RotateCcw, Play } from 'lucide-react';
import { useAppStore } from '@store/useAppStore';
import styles from './SettingsRibbon.module.css';

export const SettingsRibbon: React.FC = () => {
    const { visualizationSettings, setVisualizationMode } = useAppStore();

    return (
        <div className={styles.ribbon}>
            {/* 1. TRAINING SECTION */}
            <div className={styles.section}>
                <div className={styles.sectionTitle}>TRAINING</div>
                <div className={styles.controlGroup}>
                    <div className={styles.control}>
                        <label>Difficulty</label>
                        <div className={styles.selectWrapper}>
                            <div className={styles.statusDot} style={{ background: visualizationSettings.mode === 'beginner' ? '#4ade80' : '#fbbf24' }} />
                            <select 
                                value={visualizationSettings.mode} 
                                onChange={(e) => setVisualizationMode(e.target.value as any)}
                            >
                                <option value="beginner">Beginner</option>
                                <option value="intermediate">Intermediate</option>
                                <option value="advanced">Advanced</option>
                            </select>
                            <ChevronDown size={14} className={styles.chevron} />
                        </div>
                    </div>
                    <div className={styles.control}>
                        <label>Guidance</label>
                        <div className={styles.selectWrapper}>
                            <select defaultValue="high">
                                <option value="high">High</option>
                                <option value="medium">Medium</option>
                                <option value="off">Off</option>
                            </select>
                            <ChevronDown size={14} className={styles.chevron} />
                        </div>
                    </div>
                </div>
            </div>

            <div className={styles.divider} />

            {/* 2. ULTRASOUND SETTINGS SECTION */}
            <div className={styles.section}>
                <div className={styles.sectionTitle}>ULTRASOUND SETTINGS</div>
                <div className={styles.controlGroup}>
                    <div className={styles.control}>
                        <label>Depth</label>
                        <div className={styles.selectWrapper}>
                            <select defaultValue="12">
                                <option value="8">8 cm</option>
                                <option value="12">12 cm</option>
                                <option value="16">16 cm</option>
                                <option value="20">20 cm</option>
                            </select>
                            <ChevronDown size={14} className={styles.chevron} />
                        </div>
                    </div>
                    <div className={styles.control}>
                        <label>Gain</label>
                        <div className={styles.selectWrapper}>
                            <select defaultValue="50">
                                <option value="30">30%</option>
                                <option value="50">50%</option>
                                <option value="70">70%</option>
                            </select>
                            <ChevronDown size={14} className={styles.chevron} />
                        </div>
                    </div>
                    <div className={styles.control}>
                        <label>Frequency</label>
                        <div className={styles.selectWrapper}>
                            <select defaultValue="3.5">
                                <option value="2.5">2.5 MHz</option>
                                <option value="3.5">3.5 MHz</option>
                                <option value="5.0">5.0 MHz</option>
                            </select>
                            <ChevronDown size={14} className={styles.chevron} />
                        </div>
                    </div>
                    <div className={styles.control}>
                        <label>Focus</label>
                        <div className={styles.selectWrapper}>
                            <select defaultValue="6">
                                <option value="4">4 cm</option>
                                <option value="6">6 cm</option>
                                <option value="8">8 cm</option>
                            </select>
                            <ChevronDown size={14} className={styles.chevron} />
                        </div>
                    </div>
                </div>
            </div>

            <div className={styles.divider} />

            {/* 3. DISPLAY SECTION */}
            <div className={styles.section}>
                <div className={styles.sectionTitle}>DISPLAY</div>
                <div className={styles.controlGroup}>
                    <div className={styles.control}>
                        <label>TGC</label>
                        <div className={styles.tgcBar}>
                            {[0.2, 0.4, 0.6, 0.8, 1.0].map((h, i) => (
                                <div key={i} className={styles.tgcLevel} style={{ height: `${h * 100}%` }} />
                            ))}
                        </div>
                    </div>
                    <div className={styles.control}>
                        <label>Dyn. Range</label>
                        <div className={styles.selectWrapper}>
                            <select defaultValue="72">
                                <option value="60">60 dB</option>
                                <option value="72">72 dB</option>
                                <option value="80">80 dB</option>
                            </select>
                            <ChevronDown size={14} className={styles.chevron} />
                        </div>
                    </div>
                    <button className={styles.presetsBtn}>Presets</button>
                </div>
            </div>

            {/* 4. ACTIONS */}
            <div className={styles.actions}>
                <button className={styles.actionBtn} title="Play/Pause"><Play size={18} fill="currentColor" /></button>
                <button className={styles.actionBtn} title="Reset"><RotateCcw size={18} /></button>
                <button className={styles.actionBtn} title="Settings"><Settings size={18} /></button>
            </div>
        </div>
    );
};
