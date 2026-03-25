import React from 'react';
import { useAppStore } from '@store/useAppStore';
import { WorkspaceLayout } from '@components/workspace/WorkspaceLayout';
import { UltrasoundViewer } from '@components/workspace/UltrasoundViewer';
import { AssessmentMode } from '@components/workspace/modes/AssessmentMode';
import styles from './TrainingPage.module.css';

export const AssessmentPage: React.FC = () => {
    const { config } = useAppStore();

    const renderHeader = () => (
        <div className={styles.workspaceHeader}>
            <h2 className={styles.objective}>
                Assessment: <span className={styles.target}>Clinical Ultrasound Cases</span>
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
                leftPanel={<AssessmentMode />}
                centerPanel={
                    <div className={styles.viewerContainer}>
                        {/* Ultrasound placeholder: Real ultrasound scan of Liver/Kidney interface */}
                        <UltrasoundViewer imageSrc="https://prod-images-static.radiopaedia.org/images/157200/3ea320e87f5815617307223b9f4853_jumbo.jpg" />
                    </div>
                }
                rightPanel={
                    <div className={styles.instructionsPanel}>
                        <h3>Module Instructions</h3>
                        <p>Observe the static ultrasound images and identify any abnormalities present. Choose the best diagnosis from the options provided (Normal, Tumor, or Abnormal).</p>
                    </div>
                }
            />
        </div>
    );
};
