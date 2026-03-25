import React, { useState, useEffect, useRef } from 'react';
import { useAppStore } from '@store/useAppStore';
import { Card } from '@components/ui/Card';
import { Badge } from '@components/ui/Badge';
import { Button } from '@components/ui/Button';
import styles from './SystemStatus.module.css';

interface LogEntry {
    timestamp: string;
    level: 'info' | 'warn' | 'error';
    message: string;
}

export const SystemStatus: React.FC = () => {
    const { sessionId, connectionStatus } = useAppStore();
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const logEndRef = useRef<HTMLDivElement>(null);

    // Simulate incoming logs for demo purposes
    useEffect(() => {
        const initialLogs: LogEntry[] = [
            { timestamp: new Date().toLocaleTimeString(), level: 'info', message: 'System initialized' },
            { timestamp: new Date().toLocaleTimeString(), level: 'info', message: 'Rest client ready' },
            { timestamp: new Date().toLocaleTimeString(), level: 'info', message: 'WebSocket manager waiting for connection...' },
        ];
        setLogs(initialLogs);
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
        <div className={styles.container}>
            <div className={styles.header}>
                <h1>System Status</h1>
                <p className="text-muted">Technical diagnostics and connection monitoring</p>
            </div>

            <div className={styles.statsRow}>
                <Card title="Backend Health">
                    <div className={styles.statusGrid}>
                        <div className={styles.statusItem}>
                            <span className={styles.statusLabel}>WebSocket State</span>
                            <Badge variant={getConnectionVariant(connectionStatus)}>{connectionStatus.toUpperCase()}</Badge>
                        </div>
                        <div className={styles.statusItem}>
                            <span className={styles.statusLabel}>Latency Estimate</span>
                            <span className={styles.statusValue}>24ms</span>
                        </div>
                        <div className={styles.statusItem}>
                            <span className={styles.statusLabel}>Last Heartbeat</span>
                            <span className={styles.statusValue}>1s ago</span>
                        </div>
                    </div>
                </Card>

                <Card title="Active Session Info">
                    <div className={styles.statusGrid}>
                        <div className={styles.statusItem}>
                            <span className={styles.statusLabel}>Session ID</span>
                            <span className={styles.statusValueMono}>{sessionId || 'None'}</span>
                        </div>
                        <div className={styles.statusItem}>
                            <span className={styles.statusLabel}>Dropped Frames</span>
                            <span className={styles.statusValue}>0 (0%)</span>
                        </div>
                    </div>
                </Card>
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
    );
};
