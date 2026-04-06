import React from 'react';
import { useAppStore } from '@store/useAppStore';
import { Card } from '@components/ui/Card';
import { Button } from '@components/ui/Button';
import { Badge } from '@components/ui/Badge';
import { formatDuration, formatDate } from '@utils/formatters';
import styles from './ProgressResults.module.css';

export const ProgressResults: React.FC = () => {
    const { metrics, snapshots, config } = useAppStore();

    const handleExportJSON = () => {
        const data = JSON.stringify({ metrics, config, snapshots }, null, 2);
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `session-report-${Date.now()}.json`;
        a.click();
    };

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <h1>Session Results</h1>
                <p className="text-muted">Summary of your training performance</p>
            </div>

            <div className={styles.grid}>
                <div className={styles.mainColumn}>
                    {/* Performance Overview */}
                    <Card title="Performance Overview">
                        <div className={styles.statsGrid}>
                            <div className={styles.statBox}>
                                <span className={styles.statLabel}>Best Quality Score</span>
                                <span className={styles.statValue}>{metrics.bestQualityScore}%</span>
                            </div>
                            <div className={styles.statBox}>
                                <span className={styles.statLabel}>Session Duration</span>
                                <span className={styles.statValue}>{formatDuration(metrics.duration)}</span>
                            </div>
                            <div className={styles.statBox}>
                                <span className={styles.statLabel}>Total Attempts</span>
                                <span className={styles.statValue}>{metrics.totalAttempts}</span>
                            </div>
                            <div className={styles.statBox}>
                                <span className={styles.statLabel}>Correct Identifications</span>
                                <span className={styles.statValue}>{metrics.correctAnswers}</span>
                            </div>
                        </div>
                    </Card>

                    {/* Snapshots Gallery */}
                    <Card title="Captured Snapshots" subtitle={`${snapshots.length} images saved`}>
                        {snapshots.length === 0 ? (
                            <div className={styles.emptySnapshots}>
                                <p>No snapshots were captured during this session.</p>
                            </div>
                        ) : (
                            <div className={styles.snapshotGrid}>
                                {snapshots.map((snapshot: any) => (
                                    <div key={snapshot.id} className={styles.snapshotCard}>
                                        <div className={styles.snapshotImageContainer}>
                                            <img src={`data:image/jpeg;base64,${snapshot.image}`} alt={snapshot.label} className={styles.snapshotImage} />
                                            <div className={styles.snapshotBadge}>
                                                <Badge variant="success">{snapshot.qualityScore}%</Badge>
                                            </div>
                                        </div>
                                        <div className={styles.snapshotInfo}>
                                            <span className={styles.snapshotLabel}>{snapshot.label}</span>
                                            <span className={styles.snapshotTime}>{formatDate(snapshot.timestamp)}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </Card>
                </div>

                <div className={styles.sideColumn}>
                    {/* Session Info */}
                    <Card title="Session Details">
                        <div className={styles.detailList}>
                            <div className={styles.detailItem}>
                                <span className={styles.detailLabel}>Mode:</span>
                                <span className={styles.detailValue}>{config?.mode || 'N/A'}</span>
                            </div>
                            <div className={styles.detailItem}>
                                <span className={styles.detailLabel}>Difficulty:</span>
                                <span className={styles.detailValue}>{config?.difficulty || 'N/A'}</span>
                            </div>
                            <div className={styles.detailItem}>
                                <span className={styles.detailLabel}>CT Volume:</span>
                                <span className={styles.detailValue}>{config?.caseId || 'N/A'}</span>
                            </div>
                            <div className={styles.detailItem}>
                                <span className={styles.detailLabel}>Probe Type:</span>
                                <span className={styles.detailValue}>{config?.probeType || 'N/A'}</span>
                            </div>
                        </div>
                    </Card>

                    {/* Export Options */}
                    <Card title="Export Options">
                        <div className={styles.exportButtons}>
                            <Button variant="primary" fullWidth onClick={() => alert('PDF Export triggered')}>
                                📄 Export PDF Report
                            </Button>
                            <Button variant="secondary" fullWidth onClick={handleExportJSON}>
                                📊 Export JSON Data
                            </Button>
                            <Button variant="secondary" fullWidth onClick={() => alert('CSV Export triggered')}>
                                📈 Export CSV Metrics
                            </Button>
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    );
};
