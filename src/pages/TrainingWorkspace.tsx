import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '@store/useAppStore';
import { FullTrainingPage } from './FullTrainingPage';
import { AssessmentPage } from './AssessmentPage';
import { IdentificationPage } from './IdentificationPage';

/**
 * TrainingWorkspace Dispatcher
 * 
 * This component acts as a container for the active training session.
 * It checks the 'selectedMode' from the global store and renders the 
 * appropriate page layout. If no mode is selected, it redirects to the dashboard.
 */
export const TrainingWorkspace: React.FC = () => {
    const { selectedMode } = useAppStore();
    const navigate = useNavigate();

    useEffect(() => {
        if (!selectedMode) {
            navigate('/');
        }
    }, [selectedMode, navigate]);

    if (!selectedMode) {
        return null; // Or a loading spinner while redirecting
    }

    switch (selectedMode) {
        case 'full':
            return <FullTrainingPage />;
        case 'theoretical':
        case 'assessment':
            return <AssessmentPage />;
        case 'identification':
            return <IdentificationPage />;
        default:
            return <div>Unknown Training Mode</div>;
    }
};
