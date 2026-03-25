import type { SessionConfig } from '@/types';

export interface ValidationError {
    field: string;
    message: string;
}

export function validateSessionConfig(config: Partial<SessionConfig>): ValidationError[] {
    const errors: ValidationError[] = [];

    if (!config.mode) {
        errors.push({ field: 'mode', message: 'Training mode is required' });
    }

    if (!config.ctVolume) {
        errors.push({ field: 'ctVolume', message: 'CT volume selection is required' });
    }

    if (!config.probeType) {
        errors.push({ field: 'probeType', message: 'Probe type is required' });
    }

    if (!config.targetOrgans || config.targetOrgans.length === 0) {
        errors.push({ field: 'targetOrgans', message: 'At least one target organ is required' });
    }

    if (!config.difficulty) {
        errors.push({ field: 'difficulty', message: 'Difficulty level is required' });
    }

    return errors;
}

export function isValidSessionConfig(config: Partial<SessionConfig>): config is SessionConfig {
    return validateSessionConfig(config).length === 0;
}
