import React from 'react';
import { useAppStore } from '@store/useAppStore';
import { WorkspaceLayout } from '@components/workspace/WorkspaceLayout';
import { UltrasoundViewer } from '@components/workspace/UltrasoundViewer';
import { IdentificationMode } from '@components/workspace/modes/IdentificationMode';
import styles from './TrainingPage.module.css';

export const IdentificationPage: React.FC = () => {
    const { config } = useAppStore();

    const renderHeader = () => (
        <div className={styles.workspaceHeader}>
            <h2 className={styles.objective}>
                Identification: <span className={styles.target}>Abdominal Anatomy</span>
            </h2>
            <div className={styles.difficulty}>
                Difficulty: <strong>{config?.difficulty.toUpperCase() || 'BEGINNER'}</strong>
            </div>
        </div>
    );

    return (
        <div className={styles.trainingPage}>
            <WorkspaceLayout
                header={renderHeader()}
                leftPanel={<IdentificationMode />}
                centerPanel={
                    <div className={styles.viewerContainer}>
                        {/* Realistic Ultrasound Scan of Abdomen */}
                        <UltrasoundViewer imageSrc="https://prod-images-static.radiopaedia.org/images/54835639/33589b2512128919630c71448f86d8_jumbo.jpeg" />
                    </div>
                }
                rightPanel={
                    <div className={styles.instructionsPanel}>
                        <h3>Module Instructions</h3>
                        <p>Identify the anatomical structures highlighted in the ultrasound images. Select the correct organ from the list below the image.</p>
                    </div>
                }
            />
        </div>
    );
};
