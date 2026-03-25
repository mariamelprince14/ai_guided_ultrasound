import { format } from 'date-fns';

export function formatTimestamp(timestamp: number): string {
    return format(new Date(timestamp), 'HH:mm:ss');
}

export function formatDate(timestamp: number): string {
    return format(new Date(timestamp), 'MMM dd, yyyy HH:mm');
}

export function formatDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
        return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
        return `${minutes}m ${secs}s`;
    } else {
        return `${secs}s`;
    }
}

export function formatScore(score: number): string {
    return score.toFixed(1);
}

export function formatPoseValue(value: number, decimals: number = 2): string {
    return value.toFixed(decimals);
}

export function getQualityLabel(score: number): { label: string; color: string } {
    if (score >= 80) {
        return { label: 'Good', color: 'var(--color-success)' };
    } else if (score >= 50) {
        return { label: 'Improve', color: 'var(--color-warning)' };
    } else {
        return { label: 'Poor', color: 'var(--color-error)' };
    }
}
