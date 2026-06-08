/**
 * SessionMetricsDisplay.tsx
 * ────────────────────────
 * Real-time session metrics and performance indicators
 * Shows training progress and probe/scanning quality metrics
 */

import React from 'react';
import {
    Activity,
    Target,
    Zap,
    Clock,
    TrendingUp,
    AlertCircle,
} from 'lucide-react';
import { useAppStore } from '@store/useAppStore';
import styles from './SessionMetricsDisplay.module.css';

export interface SessionMetrics {
    probeStability: number; // 0-100
    scanCoverage: number; // 0-100
    contactQuality: number; // 0-100
    scanEfficiency: number; // 0-100
    organAcquisition: number; // 0-100
    timeElapsed: number; // seconds
    accuracyScore: number; // 0-100
}

export const SessionMetricsDisplay: React.FC = () => {
    const { sessionStatus } = useAppStore();

    const metrics: SessionMetrics = {
        probeStability: 87,
        scanCoverage: 64,
        contactQuality: 92,
        scanEfficiency: 71,
        organAcquisition: 58,
        timeElapsed: 187,
        accuracyScore: 75,
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const MetricItem: React.FC<{
        icon: React.ReactNode;
        label: string;
        value: string | number;
        unit?: string;
        trendIcon?: React.ReactNode;
    }> = ({ icon, label, value, unit = '', trendIcon }) => (
        <div className={styles.metricItem}>
            <div className={styles.iconContainer}>{icon}</div>
            <div className={styles.metricData}>
                <div className={styles.metricLabel}>{label}</div>
                <div className={styles.metricValue}>
                    {value}{unit}
                    {trendIcon && <span className={styles.trendIcon}>{trendIcon}</span>}
                </div>
            </div>
        </div>
    );

    return (
        <div className={styles.metricsFooter}>
            <div className={styles.metricsGrid}>
                <MetricItem 
                    icon={<Activity size={20} color="#4ade80" />} 
                    label="Probe Stability" 
                    value={metrics.probeStability} 
                    unit="%"
                    trendIcon={<TrendingUp size={12} color="#4ade80" />}
                />
                <MetricItem 
                    icon={<Zap size={20} color="#2dd4bf" />} 
                    label="Contact Quality" 
                    value={metrics.contactQuality} 
                    unit="%"
                />
                <MetricItem 
                    icon={<Target size={20} color="#fbbf24" />} 
                    label="Scan Coverage" 
                    value={metrics.scanCoverage} 
                    unit="%"
                />
                <MetricItem 
                    icon={<TrendingUp size={20} color="#f97316" />} 
                    label="Scan Efficiency" 
                    value={metrics.scanEfficiency} 
                    unit="%"
                />
                <MetricItem 
                    icon={<AlertCircle size={20} color="#f43f5e" />} 
                    label="Organ Acquisition" 
                    value={metrics.organAcquisition} 
                    unit="%"
                />
                <MetricItem 
                    icon={<Clock size={20} color="#94a3b8" />} 
                    label="Time" 
                    value={formatTime(metrics.timeElapsed)} 
                />
            </div>

            <button className={styles.endCaseBtn}>
                End Case
            </button>
        </div>
    );
};
