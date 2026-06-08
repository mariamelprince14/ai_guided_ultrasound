import React, { useEffect } from 'react';
import { useAppStore } from '@store/useAppStore';
import { VolumeViewer } from '@components/workspace/VolumeViewer';
import { RegistrationPanel } from '@components/workspace/RegistrationPanel';
import styles from './TrainingPage.module.css';

/**
 * RegistrationPage
 * ────────────────
 * Dedicated page for CT-to-torso alignment and preprocessing.
 * strictly separated from the training environment.
 */
export const RegistrationPage: React.FC = () => {
    const { 
        selectedCaseId, 
        fetchVolumeData, 
        loadRegistration,
        setVisualizationMode
    } = useAppStore();

    useEffect(() => {
        // When entering registration page, set a clear "Dev" visualization mode
        setVisualizationMode('beginner'); 
        
        if (selectedCaseId) {
            fetchVolumeData(selectedCaseId);
            loadRegistration(selectedCaseId);
        }
    }, [selectedCaseId, fetchVolumeData, loadRegistration, setVisualizationMode]);

    return (
        <div className={styles.container} style={{ gridTemplateColumns: '350px 1fr' }}>
            <div className={styles.leftPanel}>
                <RegistrationPanel />
                <div style={{ padding: '20px', color: '#888', fontSize: '12px' }}>
                    <p>Registration Mode: Adjust the CT volume transform to align internal anatomy with the torso shell.</p>
                    <p>Ensure the spine is centered posteriorly and the liver is positioned in the right upper quadrant.</p>
                </div>
            </div>
            
            <div className={styles.viewerContainer}>
                {/* We use the regular VolumeViewer but it will now be uncluttered since we moved the panel here */}
                <VolumeViewer />
            </div>
        </div>
    );
};
