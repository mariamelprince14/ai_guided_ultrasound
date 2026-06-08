/**
 * Volume35Integration.ts
 * ──────────────────────
 * VOLUME 35 DETECTION AND ROUTING
 * 
 * This utility ensures that:
 *  1. Volume 35 (test35) is identified correctly
 *  2. All Volume 35-specific components are used
 *  3. Other volumes are unaffected
 *  4. Scope restriction is enforced
 */

/**
 * Check if a case ID corresponds to Volume 35
 */
export function isVolume35Case(caseId: string | null): boolean {
    return caseId === 'test35';
}

/**
 * Volume 35 metadata
 */
export const VOLUME_35_CONFIG = {
    caseId: 'test35',
    displayName: 'Volume 35 - Advanced Kidney Ultrasound Simulator',
    description: 'Professional-grade ultrasound training environment',
    anatomyFocus: ['kidneys', 'retroperitoneal-space'],
    supportedProbes: ['curvilinear', 'linear'],
    defaultProbe: 'curvilinear',
    supportedModes: ['beginner', 'intermediate', 'advanced'],
    defaultMode: 'beginner',
    features: {
        realisticTorso: true,
        realisticProbes: true,
        trainingModes: true,
        professionalUI: true,
        anatomicalGuidance: true,
    },
};

/**
 * Get Volume 35 specific configuration
 */
export function getVolume35Config() {
    return VOLUME_35_CONFIG;
}

/**
 * Determine if we should use Volume 35 enhanced UI
 */
export function shouldUseVolume35UI(caseId: string | null, trainingMode?: string): boolean {
    return isVolume35Case(caseId);
}

/**
 * Determine if we should use Volume 35 torso
 */
export function shouldUseVolume35Torso(caseId: string | null): boolean {
    return isVolume35Case(caseId);
}

/**
 * Determine if we should use Volume 35 probe system
 */
export function shouldUseVolume35ProbeSystem(caseId: string | null): boolean {
    return isVolume35Case(caseId);
}

/**
 * Determine if we should use Volume 35 training modes
 */
export function shouldUseVolume35TrainingModes(caseId: string | null): boolean {
    return isVolume35Case(caseId);
}

/**
 * Log Volume 35 specific event (for tracking)
 */
export function logVolume35Event(eventType: string, details?: any): void {
    if (process.env.NODE_ENV === 'development') {
        console.log(`[Volume 35] ${eventType}`, details || '');
    }
}
