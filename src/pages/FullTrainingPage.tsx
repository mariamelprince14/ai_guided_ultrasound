import React, { useEffect } from 'react';
import { useAppStore } from '@store/useAppStore';
import { wsService } from '@services/websocket';
import { WorkspaceLayout } from '@components/workspace/WorkspaceLayout';
import { VolumeViewer } from '@components/workspace/VolumeViewer';
import { ProbeSimulation } from '@components/workspace/ProbeSimulation';
import { ProbeControls } from '@components/workspace/ProbeControls';
import { UltrasoundViewer } from '@components/workspace/UltrasoundViewer';
import { GuidancePanel } from '@components/workspace/GuidancePanel';
import type { WSMessage } from '@/types';
import styles from './TrainingPage.module.css';

export const FullTrainingPage: React.FC = () => {
    const {
        currentPose,
        updatePose,
        updateFrame,
        updateFeedback,
        setSessionStatus,
        config
    } = useAppStore();

    useEffect(() => {
        const unsubscribe = wsService.onMessage((message: WSMessage) => {
            switch (message.type) {
                case 'ultrasoundFrame':
                    updateFrame(message.data.image);
                    break;
                case 'aiFeedback':
                    updateFeedback(message.data);
                    break;
                case 'poseUpdate':
                    updatePose(message.data);
                    break;
                case 'sessionEvent':
                    if (message.data.event === 'started') setSessionStatus('running');
                    if (message.data.event === 'paused') setSessionStatus('paused');
                    if (message.data.event === 'stopped') setSessionStatus('ended');
                    break;
            }
        });

        return () => {
            unsubscribe();
        };
    }, [updateFrame, updateFeedback, updatePose, setSessionStatus]);

    const renderHeader = () => (
        <div className={styles.workspaceHeader}>
            <h2 className={styles.objective}>
                Objective: <span className={styles.target}>Acquire a valid view of {config?.targetOrgans[0] || 'Target Organ'}</span>
            </h2>
            <div className={styles.difficulty}>
                Difficulty: <strong>{config?.difficulty.toUpperCase()}</strong>
            </div>
        </div>
    );

    return (
        <div className={styles.trainingPage}>
            <WorkspaceLayout
                header={renderHeader()}
                leftPanel={
                    <>
                        <ProbeSimulation pose={currentPose} />
                        <ProbeControls />
                    </>
                }
                centerPanel={
                    <div className={styles.viewerContainer}>
                        <VolumeViewer pose={currentPose} />
                    </div>
                }
                rightPanel={
                    <>
                        <UltrasoundViewer />
                        <GuidancePanel />
                    </>
                }
            />
        </div>
    );
};
