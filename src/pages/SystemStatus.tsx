import React, { useState, useEffect, useRef } from 'react';
import { useAppStore } from '@store/useAppStore';
import { Card } from '@components/ui/Card';
import { Badge } from '@components/ui/Badge';
import { Button } from '@components/ui/Button';
import { HomepageNavbar } from '@components/layout/HomepageNavbar';
import { SignInModal } from '@components/ui/SignInModal';
import { SignUpModal } from '@components/ui/SignUpModal';
import styles from './SystemStatus.module.css';

interface LogEntry {
    timestamp: string;
    level: 'info' | 'warn' | 'error';
    message: string;
}

interface CaseStatus {
    id: string;
    name: string;
    is_valid: boolean;
    has_segmentation: boolean;
    volume_file: string;
    error?: string;
}

interface DiscoveryStatus {
    total: number;
    valid: number;
    segmentations: number;
    failed: number;
    cases: CaseStatus[];
}

export const SystemStatus: React.FC = () => {
    const { sessionId, connectionStatus } = useAppStore();
    const [discovery, setDiscovery] = useState<DiscoveryStatus | null>(null);
    const [logs, setLogs] = useState<LogEntry[]>(() => [
        { timestamp: new Date().toLocaleTimeString(), level: 'info', message: 'System initialized' },
        { timestamp: new Date().toLocaleTimeString(), level: 'info', message: 'Rest client ready' },
        { timestamp: new Date().toLocaleTimeString(), level: 'info', message: 'WebSocket manager waiting for connection...' },
    ]);
    const logEndRef = useRef<HTMLDivElement>(null);

    // Modals state
    const [showSignIn, setShowSignIn] = useState(false);
    const [showSignUp, setShowSignUp] = useState(false);

    useEffect(() => {
        const fetchStatus = async () => {
            try {
                const res = await fetch('http://localhost:8000/api/cases/status');
                const data = await res.json();
                setDiscovery(data);
                setLogs(prev => [
                    ...prev,
                    { timestamp: new Date().toLocaleTimeString(), level: 'info', message: `Discovery complete: found ${data.total} cases` }
                ]);
            } catch (err) {
                setLogs(prev => [
                    ...prev,
                    { timestamp: new Date().toLocaleTimeString(), level: 'error', message: 'Failed to fetch discovery status' }
                ]);
            }
        };
        fetchStatus();
    }, []);

    useEffect(() => {
        logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [logs]);

    const clearLogs = () => setLogs([]);

    const getConnectionVariant = (status: string) => {
        switch (status) {
            case 'connected': return 'success';
            case 'reconnecting': return 'warning';
            default: return 'error';
        }
    };

    return (
        <div className={styles.homepage}>
            {/* Background glassmorphism blobs */}
            <div className={styles.glassBlob1} />
            <div className={styles.glassBlob2} />
            <div className={styles.glassBlob3} />

            <HomepageNavbar 
                onSignInClick={() => {
                    setShowSignUp(false);
                    setShowSignIn(true);
                }} 
                onSignUpClick={() => {
                    setShowSignIn(false);
                    setShowSignUp(true);
                }} 
            />

            <div className={styles.container}>
                <div className={styles.header}>
                    <h1 className={styles.title}>
                        <span className={styles.titleLine}>System Status</span>
                    </h1>
                    <p className={styles.subtitle}>Technical diagnostics and connection monitoring</p>
                </div>

                <div className={styles.statsRow}>
                    <Card className={styles.setupCard} title="Dataset Validation">
                        <div className={styles.statusGrid}>
                            <div className={styles.statusItem}>
                                <span className={styles.statusLabel}>Total Discoveries</span>
                                <span className={styles.statusValue}>{discovery?.total ?? '...'}</span>
                            </div>
                            <div className={styles.statusItem}>
                                <span className={styles.statusLabel}>Valid Volumes</span>
                                <Badge variant="success">{discovery?.valid ?? 0}</Badge>
                            </div>
                            <div className={styles.statusItem}>
                                <span className={styles.statusLabel}>Segmentations</span>
                                <span className={styles.statusValue}>{discovery?.segmentations ?? 0}</span>
                            </div>
                            <div className={styles.statusItem}>
                                <span className={styles.statusLabel}>Load Failures</span>
                                <Badge variant={discovery?.failed ? 'error' : 'success'}>{discovery?.failed ?? 0}</Badge>
                            </div>
                        </div>
                    </Card>

                    <Card className={styles.setupCard} title="Connection Health">
                        <div className={styles.statusGrid}>
                            <div className={styles.statusItem}>
                                <span className={styles.statusLabel}>WebSocket</span>
                                <Badge variant={getConnectionVariant(connectionStatus)}>{connectionStatus.toUpperCase()}</Badge>
                            </div>
                            <div className={styles.statusItem}>
                                <span className={styles.statusLabel}>Session ID</span>
                                <span className={styles.statusValueMonoShort}>{sessionId ? sessionId.slice(0, 8) : 'None'}</span>
                            </div>
                        </div>
                    </Card>
                </div>

                <div className={styles.caseListSection}>
                    <h3>Case Inventory & Integrity</h3>
                    <div className={styles.caseTableWrapper}>
                        <table className={styles.caseTable}>
                            <thead>
                                <tr>
                                    <th>ID</th>
                                    <th>Name</th>
                                    <th>Segmentation</th>
                                    <th>Volume File</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {discovery?.cases?.map(c => (
                                    <tr key={c.id}>
                                        <td className={styles.caseIdCell}>{c.id}</td>
                                        <td>{c.name}</td>
                                        <td>
                                            {c.has_segmentation ? 
                                                <span style={{ color: '#4ade80' }} className={styles.checkIcon}>✓</span> : 
                                                <span style={{ color: '#94a3b8', opacity: 0.3 }}>—</span>
                                            }
                                        </td>
                                        <td className={styles.detailsCell}>{c.volume_file}</td>
                                        <td>
                                            <span className={c.is_valid ? styles.statusValueMonoShort : styles.statusValueMonoError}>
                                                {c.is_valid ? 'READY' : (c.error || 'FAILED')}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                                {(!discovery || !discovery.cases || discovery.cases.length === 0) && (
                                    <tr>
                                        <td colSpan={5} style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                                            No cases discovered or backend offline
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className={styles.logSection}>
                    <div className={styles.logHeader}>
                        <h3>System Logs</h3>
                        <Button variant="secondary" size="small" onClick={clearLogs}>Clear Logs</Button>
                    </div>
                    <div className={styles.logPanel}>
                        {logs.map((log, index) => (
                            <div key={index} className={`${styles.logEntry} ${styles[log.level]}`}>
                                <span className={styles.logTime}>[{log.timestamp}]</span>
                                <span className={styles.logLevel}>{log.level.toUpperCase()}:</span>
                                <span className={styles.logMessage}>{log.message}</span>
                            </div>
                        ))}
                        <div ref={logEndRef} />
                    </div>
                </div>
            </div>

            {/* Sign In / Sign Up Modals */}
            <SignInModal
                isOpen={showSignIn}
                onClose={() => setShowSignIn(false)}
                onSwitchToSignUp={() => {
                    setShowSignIn(false);
                    setShowSignUp(true);
                }}
            />
            <SignUpModal
                isOpen={showSignUp}
                onClose={() => setShowSignUp(false)}
                onSwitchToSignIn={() => {
                    setShowSignUp(false);
                    setShowSignIn(true);
                }}
            />
        </div>
    );
};
