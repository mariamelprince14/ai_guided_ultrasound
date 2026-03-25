/**
 * Centralized list of supported abdominal organs for the training system.
 * This ensures consistency across session setup, identification training, 
 * and AI guidance modules.
 */
export const ABDOMINAL_ORGANS = [
    'Liver',
    'Kidney',
    'Gallbladder',
    'Spleen',
    'Pancreas',
    'Aorta',
] as const;

export type AbdominalOrgan = (typeof ABDOMINAL_ORGANS)[number];

export const isAbdominalOrgan = (organ: string): organ is AbdominalOrgan => {
    return ABDOMINAL_ORGANS.includes(organ as AbdominalOrgan);
};

// Lowercase versions for internal logic/API usage if needed
export const ABDOMINAL_ORGANS_LOWER = ABDOMINAL_ORGANS.map(o => o.toLowerCase());
