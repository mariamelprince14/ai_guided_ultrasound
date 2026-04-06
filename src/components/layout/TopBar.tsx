import React, { useState } from 'react';
import { useAppStore } from '@store/useAppStore';
import { Badge } from '@components/ui/Badge';
import { Button } from '@components/ui/Button';
import { Modal } from '@components/ui/Modal';
import { apiService } from '@services/api';
import { Power, Globe, CheckCircle2, AlertCircle, Circle } from 'lucide-react';
import styles from './TopBar.module.css';

export const TopBar: React.FC = () => {
    console.log('TopBar rendering')
    
    const { status, connectionStatus, selectedMode, sessionId, setSessionStatus } = useAppStore();
    const [showStopModal, setShowStopModal] = useState(false);

    const getStatusVariant = (status: string) => {
        switch (status) {
            case 'running':
                return 'success';
            case 'paused':
                return 'warning';
            case 'ended':
                return 'neutral';
            default:
                return 'neutral';
        }
    };

    const getConnectionVariant = (status: string) => {
        switch (status) {
            case 'connected':
                return 'success';
            case 'reconnecting':
                return 'warning';
            default:
                return 'error';
        }
    };

    const handleStopSession = async () => {
        if (sessionId) {
            try {
                await apiService.stopSession(sessionId);
                setSessionStatus('ended');
                setShowStopModal(false);
            } catch (error) {
                console.error('Failed to stop session:', error);
            }
        }
    };

    const getModeName = (mode: string | null) => {
        switch (mode) {
            case 'full':
                return 'Full Experience';
            case 'assessment':
                return 'Image Assessment';
            case 'identification':
                return 'Identification';
            default:
                return 'No Mode Selected';
        }
    };

    return (
        <>
            <header className={styles.topBar}>
                <div className={styles.left}>
                    <div className={styles.statusGroup}>
                        <span className={styles.label}>Session:</span>
                        <Badge variant={getStatusVariant(status)}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                {status === 'running' && <CheckCircle2 size={12} />}
                                {status === 'paused' && <Circle size={12} />}
                                {status === 'ended' && <AlertCircle size={12} />}
                                {status.replace('-', ' ').toUpperCase()}
                            </span>
                        </Badge>
                    </div>
                    <div className={styles.statusGroup}>
                        <span className={styles.label}>Connection:</span>
                        <Badge variant={getConnectionVariant(connectionStatus)}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <Globe size={12} />
                                {connectionStatus.toUpperCase()}
                            </span>
                        </Badge>
                    </div>
                </div>
                <div className={styles.center}>
                    <span className={styles.modeName}>{getModeName(selectedMode)}</span>
                </div>
                <div className={styles.right}>
                    {status === 'running' && (
                        <Button
                            variant="danger"
                            size="small"
                            onClick={() => setShowStopModal(true)}
                        >
                            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Power size={14} />
                                Stop Session
                            </span>
                        </Button>
                    )}
                </div>
            </header>

            <Modal
                isOpen={showStopModal}
                onClose={() => setShowStopModal(false)}
                title="Stop Session"
                footer={
                    <>
                        <Button variant="secondary" onClick={() => setShowStopModal(false)}>
                            Cancel
                        </Button>
                        <Button variant="danger" onClick={handleStopSession}>
                            Stop Session
                        </Button>
                    </>
                }
            >
                <p>Are you sure you want to stop the current training session?</p>
                <p className="text-muted">This action cannot be undone.</p>
            </Modal>
        </>
    );
};
