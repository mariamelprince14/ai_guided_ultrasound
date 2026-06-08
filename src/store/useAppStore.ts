import { create } from 'zustand';
import type {
    TrainingMode,
    SessionConfig,
    SessionState,
    SessionStatus,
    ConnectionStatus,
    ProbePose,
    AIFeedback,
    Snapshot,
    ImagingSettings,
    RenderSettings,
    CaseInfo,
    VolumeInfo,
    VolumeVoxelData,
    VolumeRegistration,
    TorsoSettings,
    BoundingBox3D,
    VisualizationSettings,
    VolumeAlignment,
    ProbePhysics,
    SurfaceContact,
    AnatomyMetadata,
} from '@/types';
import { apiService } from '@/services/api';
import { computeSurfaceContact } from '@/utils/probePhysics';
import {
    computeAnatomicalTransform,
    VOLUME35_MM_TO_SCENE,
} from '@/utils/AnatomicalEmbedding';
import type { ContactLabel } from '@/utils/ProbeMetrics';

interface AppState extends SessionState {
    // Case discovery
    cases: CaseInfo[];
    setCases: (cases: CaseInfo[]) => void;
    selectedCaseId: string | null;
    setSelectedCaseId: (id: string | null) => void;

    // Volume info (from session create response)
    volumeInfo: VolumeInfo | null;
    setVolumeInfo: (info: VolumeInfo | null) => void;

    // Selection state
    selectedMode: TrainingMode | null;
    setSelectedMode: (mode: TrainingMode | null) => void;

    // Configuration
    setConfig: (config: Partial<SessionConfig>) => void;
    updateConfig: (updates: Partial<SessionConfig>) => void;

    // Session management
    setSessionId: (id: string | null) => void;
    setSessionStatus: (status: SessionStatus) => void;
    setConnectionStatus: (status: ConnectionStatus) => void;

    // Shared probe position/rotation (used by both ProbeControls sliders AND 3D VolumeViewer)
    probePos: { x: number; y: number; z: number };
    probeRot: { pitch: number; yaw: number; roll: number };
    probeNormal: { x: number; y: number; z: number };
    setProbePos: (pos: { x: number; y: number; z: number }, normal?: { x: number; y: number; z: number }) => void;
    setProbeRot: (rot: { pitch: number; yaw: number; roll: number }) => void;

    // Real-time data
    updatePose: (pose: ProbePose) => void;
    updateImagingSettings: (settings: Partial<ImagingSettings>) => void;
    updateRenderSettings: (settings: Partial<RenderSettings>) => void;
    updateFrame: (frame: string) => void;
    updateFeedback: (feedback: AIFeedback) => void;

    // Snapshots
    addSnapshot: (snapshot: Snapshot) => void;
    clearSnapshots: () => void;

    // Metrics
    updateMetrics: (updates: Partial<AppState['metrics']>) => void;
    incrementCorrectAnswers: () => void;
    incrementTotalAttempts: () => void;

    // Real 3D voxel data for VolumeViewer ray-marching
    volumeVoxelData: VolumeVoxelData | null;
    fetchVolumeData: (caseId: string) => Promise<void>;

    // Registration and Torso settings
    registration: VolumeRegistration;
    setRegistration: (reg: VolumeRegistration) => void;
    torsoSettings: TorsoSettings;
    setTorsoSettings: (settings: Partial<TorsoSettings>) => void;
    loadRegistration: (caseId: string) => void;
    saveRegistration: (caseId: string) => void;

    // Bounds tracking
    torsoBounds: BoundingBox3D | null;
    ctBounds: BoundingBox3D | null;
    setTorsoBounds: (bounds: BoundingBox3D) => void;
    setCTBounds: (bounds: BoundingBox3D) => void;

    // Anatomy metadata from NIfTI affine (ground truth for alignment)
    anatomyMetadata: AnatomyMetadata | null;
    fetchAnatomyMetadata: (caseId: string) => Promise<void>;

    // Primary anatomical embedding action (uses real NIfTI affine)
    embedCTAnatomically: () => void;

    // @deprecated — kept as aliases during migration, route to embedCTAnatomically
    centerCTInTorso: () => void;
    fitCTToTorso: () => void;

    // Visualization Modes - Progressive Disclosure
    visualizationSettings: VisualizationSettings;
    anatomyHintActive: boolean;
    setVisualizationMode: (mode: 'beginner' | 'intermediate' | 'advanced') => void;
    toggleGuidance: () => void;
    toggleAnatomyHint: () => void;
    toggleAdvancedControls: () => void;

    // Volume Alignment - Affine Registration
    volumeAlignment: VolumeAlignment | null;
    loadVolumeAlignment: (caseId: string) => Promise<void>;
    saveVolumeAlignment: (caseId: string, alignment: VolumeAlignment) => void;

    // Probe Physics
    probePhysics: ProbePhysics;
    updateSurfaceContact: (contact: SurfaceContact) => void;
    setProbePhysicsEnabled: (enabled: boolean) => void;

    // Real-time probe performance metrics (replaces Math.random() placeholder)
    /** Contact quality score 0–100 derived from tilt angle vs surface normal */
    contactQuality: number;
    /** Qualitative label for contact quality */
    contactQualityLabel: ContactLabel;
    /** Probe stability score 0–100 derived from rolling position variance */
    probeStability: number;
    /** Update both metrics atomically (called from DragController each frame) */
    updateProbeMetrics: (quality: number, qualityLabel: ContactLabel, stability: number) => void;

    // Scaling
    mmToSceneScale: number;
    setMmToSceneScale: (scale: number) => void;

    // Reset
    resetSession: () => void;
}

const initialPose: ProbePose = {
    position: { x: 0, y: 0, z: 0 },
    rotation: { pitch: 0, roll: 0, yaw: 0 },
};

const initialProbePos = { x: 0, y: 0, z: 0 };
const initialProbeRot = { pitch: 0, yaw: 0, roll: 0 };
const initialProbeNormal = { x: 0, y: 1, z: 0 };

const initialMetrics = {
    startTime: null,
    endTime: null,
    duration: 0,
    bestQualityScore: 0,
    correctAnswers: 0,
    totalAttempts: 0,
};

const initialImagingSettings: ImagingSettings = {
    gain: 85,
    depth: 15,
    frequency: 7.5,
    contactPressure: 0,
    power: 100,
    dynamicRange: 70,
    windowLevel: 60,
    windowWidth: 360,
};

const initialRenderSettings: RenderSettings = {
    wl: 60,
    ww: 360,
    showSeg: false,
    planeSizeMm: 150,
    resolution: 512,
    clippingEnabled: false,
};

const initialRegistration: VolumeRegistration = {
    position: [0, 0, 0],
    rotation: [0, 0, 0], // Naturally align with supine torso group
    scale: 1,
};

const initialTorsoSettings: TorsoSettings = {
    opacity: 0.8,
    wireframe: false,
    ctVisible: true,
    torsoBoundingBoxVisible: false,
    ctBoundingBoxVisible: false,
};

const initialVisualizationSettings: VisualizationSettings = {
    mode: 'beginner',
    showTorso: true,
    torsoOpacity: 1.0,
    showVolume: true,
    volumeOpacity: 0.22,
    showProbe: true,
    showSlicePlane: true,
    showGuidance: true,
    showAdvancedControls: false,
};

const initialSurfaceContact: SurfaceContact = {
    contactPoint: [0, 0, 0],
    contactNormal: [0, 1, 0],
    isInContact: false,
    penetrationDepth: 0,
    pressureLevel: 0,
};

const initialProbePhysics: ProbePhysics = {
    surfaceContact: initialSurfaceContact,
    constrainedMovement: true,
    maxTiltAngle: 60,
    maxPressure: 20,
    surfaceFollowing: true,
};

export const useAppStore = create<AppState>((set) => ({
    // Case discovery
    cases: [],
    setCases: (cases) => set({ cases }),
    selectedCaseId: null,
    setSelectedCaseId: (id) => set({ selectedCaseId: id }),

    // Volume info
    volumeInfo: null,
    setVolumeInfo: (info) => set({ volumeInfo: info }),

    // Initial state
    selectedMode: null,
    sessionId: null,
    status: 'not-started',
    connectionStatus: 'offline',
    config: null,
    currentPose: initialPose,
    imagingSettings: initialImagingSettings,
    renderSettings: initialRenderSettings,
    currentFrame: null,
    currentFeedback: null,
    snapshots: [],
    metrics: initialMetrics,
    volumeVoxelData: null,
    probeNormal: initialProbeNormal,
    visualizationSettings: initialVisualizationSettings,
    anatomyHintActive: false,
    mmToSceneScale: 0.04, // Default estimate (400mm torso -> 16 units)
    setMmToSceneScale: (scale) => set({ mmToSceneScale: scale }),

    // Probe metrics — initial values at rest
    contactQuality: 0,
    contactQualityLabel: 'poor' as ContactLabel,
    probeStability: 100,
    updateProbeMetrics: (quality, qualityLabel, stability) =>
        set({ contactQuality: quality, contactQualityLabel: qualityLabel, probeStability: stability }),

    // Registration and Torso settings
    registration: initialRegistration,
    setRegistration: (reg) => set({ registration: reg }),
    torsoSettings: initialTorsoSettings,
    setTorsoSettings: (settings) => set((state) => ({ torsoSettings: { ...state.torsoSettings, ...settings } })),
    loadRegistration: (caseId) => {
        const stored = localStorage.getItem(`registration_${caseId}`);
        if (stored) {
            try {
                const reg = JSON.parse(stored);
                // Always reset rotation to [0,0,0] — orientation is driven by the NIfTI
                // affine via embedCTAnatomically, never by a persisted manual rotation.
                set({ registration: { ...reg, rotation: [0, 0, 0] } });
            } catch (e) {
                console.error('Failed to parse registration json', e);
                set({ registration: initialRegistration });
            }
        } else {
            set({ registration: initialRegistration });
        }
    },
    saveRegistration: (caseId) => {
        set((state) => {
            localStorage.setItem(`registration_${caseId}`, JSON.stringify(state.registration));
            return state;
        });
    },

    // Bounds tracking
    torsoBounds: null,
    ctBounds: null,
    setTorsoBounds: (bounds) => set({ torsoBounds: bounds }),
    setCTBounds: (bounds) => set({ ctBounds: bounds }),

    // Anatomy metadata
    anatomyMetadata: null,
    fetchAnatomyMetadata: async (caseId: string) => {
        try {
            const metadata = await apiService.getAnatomyMetadata(caseId);
            set({ anatomyMetadata: metadata });
            console.info('[Store] Anatomy metadata loaded:', metadata.convention, metadata.axisCodes);
        } catch (error) {
            console.error('[Store] Failed to fetch anatomy metadata:', error);
        }
    },

    // Primary embedding action — uses real NIfTI affine as ground truth
    embedCTAnatomically: () => set((state) => {
        if (!state.torsoBounds || !state.anatomyMetadata) {
            console.warn('[embedCTAnatomically] Missing torsoBounds or anatomyMetadata — cannot embed.');
            return state;
        }

        const mmToScene = VOLUME35_MM_TO_SCENE;
        const result = computeAnatomicalTransform(
            state.anatomyMetadata,
            state.torsoBounds,
            mmToScene,
        );

        console.info(
            '[embedCTAnatomically] Registration computed:',
            `scale=${result.registration.scale}`,
            `pos=[${result.registration.position.map(v => v.toFixed(2)).join(', ')}]`,
            `CT-TLS: ${result.ctBoundsInTLS.size.map(v => v.toFixed(1)).join('×')} scene units`,
            `cavity: ${result.cavityRegion.size.map(v => v.toFixed(1)).join('×')} scene units`,
        );

        if (result.warnings.length > 0) {
            result.warnings.forEach(w => console.warn('[embedCTAnatomically]', w));
        }

        return {
            registration: {
                ...result.registration,
                // Always lock rotation to [0,0,0] — NIfTI orientation is handled by the
                // anatomical-subject group rotation and the VolumeRaymarch axis-swap mesh.
                // Any stale rotation from localStorage is intentionally discarded here.
                rotation: [0, 0, 0] as [number, number, number],
            },
            mmToSceneScale: mmToScene,
        };
    }),

    // @deprecated: kept as aliases during migration — route to embedCTAnatomically
    centerCTInTorso: () => {
        console.warn(
            '[centerCTInTorso] DEPRECATED: use embedCTAnatomically() instead. '
            + 'This alias will be removed in a future release.'
        );
        // Route to new action via get is not available in set, so we
        // trigger embedCTAnatomically externally (VolumeViewer already calls it)
    },
    fitCTToTorso: () => {
        console.warn(
            '[fitCTToTorso] DEPRECATED: use embedCTAnatomically() instead. '
            + 'This alias will be removed in a future release.'
        );
    },

    // Shared probe position/rotation (shared between ProbeControls and VolumeViewer)
    probePos: initialProbePos,
    probeRot: initialProbeRot,
    setProbePos: (pos, normal) => set((state) => {
        // Convert mm probe position to scene units for physics calculation
        const px = (pos.x * state.registration.scale + state.registration.position[0]) * state.mmToSceneScale;
        const py = (pos.y * state.registration.scale + state.registration.position[1]) * state.mmToSceneScale;
        const pz = (pos.z * state.registration.scale + state.registration.position[2]) * state.mmToSceneScale;

        // If normal is provided from a real mesh hit, use it. Otherwise use ellipsoid approximation.
        const contact = computeSurfaceContact(
            [px, py, pz],
            state.torsoBounds || { center: [0, 0, 0], size: [16, 16, 16] },
            state.imagingSettings.contactPressure / 100
        );

        // If a real normal was passed, prioritize it for realistic orientation
        if (normal) {
            contact.contactNormal = [normal.x, normal.y, normal.z];
        }

        return {
            probePos: pos,
            probeNormal: normal || { x: contact.contactNormal[0], y: contact.contactNormal[1], z: contact.contactNormal[2] },
            probePhysics: {
                ...state.probePhysics,
                surfaceContact: contact,
            },
        };
    }),
    setProbeRot: (rot) => set({ probeRot: rot }),

    // Actions
    setSelectedMode: (mode) => set({ selectedMode: mode }),

    setConfig: (config) =>
        set({
            config: config as SessionConfig,
        }),

    updateConfig: (updates) =>
        set((state) => ({
            config: state.config ? { ...state.config, ...updates } : null,
        })),

    setSessionId: (id) => set({ sessionId: id }),

    setSessionStatus: (status) => set({ status }),

    setConnectionStatus: (status) => set({ connectionStatus: status }),

    updatePose: (pose) => set({ currentPose: pose }),

    updateImagingSettings: (updates) =>
        set((state) => ({
            imagingSettings: { ...state.imagingSettings, ...updates },
        })),

    updateRenderSettings: (updates) =>
        set((state) => ({
            renderSettings: { ...state.renderSettings, ...updates },
        })),

    updateFrame: (frame) => set({ currentFrame: frame }),

    updateFeedback: (feedback) =>
        set((state) => ({
            currentFeedback: feedback,
            metrics: {
                ...state.metrics,
                bestQualityScore: Math.max(
                    state.metrics.bestQualityScore,
                    feedback.qualityScore
                ),
            },
        })),

    addSnapshot: (snapshot) =>
        set((state) => ({
            snapshots: [...state.snapshots, snapshot],
        })),

    clearSnapshots: () => set({ snapshots: [] }),

    updateMetrics: (updates) =>
        set((state) => ({
            metrics: { ...state.metrics, ...updates },
        })),

    incrementCorrectAnswers: () =>
        set((state) => ({
            metrics: {
                ...state.metrics,
                correctAnswers: state.metrics.correctAnswers + 1,
            },
        })),

    incrementTotalAttempts: () =>
        set((state) => ({
            metrics: {
                ...state.metrics,
                totalAttempts: state.metrics.totalAttempts + 1,
            },
        })),

    fetchVolumeData: async (caseId: string) => {
        try {
            const result = await apiService.getVolumeData(caseId);
            set({ volumeVoxelData: result });
        } catch (error) {
            console.error('Failed to fetch volume data:', error);
        }
    },

    // Visualization Modes - Progressive Disclosure
    setVisualizationMode: (mode) => set((state) => {
        const settings = { ...state.visualizationSettings, mode };

        // Torso is ALWAYS opaque — anatomy overlay toggle handles local reveals
        settings.showTorso = true;
        settings.torsoOpacity = 1.0;

        if (mode === 'advanced') {
            // Advanced: anatomy completely hidden, no guidance
            settings.showVolume = false;
            settings.volumeOpacity = 0;
            settings.showGuidance = false;
            settings.showSlicePlane = true;
            settings.showProbe = true;
        } else if (mode === 'intermediate') {
            // Intermediate: faint anatomy only during guidance, minimal hints
            settings.showVolume = true;
            settings.volumeOpacity = 0.08;
            settings.showGuidance = false;
            settings.showSlicePlane = true;
            settings.showProbe = true;
        } else {
            // Beginner: partial educational anatomy visibility + full guidance
            settings.showVolume = true;
            settings.volumeOpacity = 0.22;
            settings.showGuidance = true;
            settings.showSlicePlane = true;
            settings.showProbe = true;
        }

        return { 
            visualizationSettings: settings,
            torsoSettings: {
                ...state.torsoSettings,
                opacity: settings.torsoOpacity,
                ctVisible: settings.showVolume
            },
            anatomyHintActive: false 
        };
    }),

    toggleGuidance: () => set((state) => ({
        visualizationSettings: {
            ...state.visualizationSettings,
            showGuidance: !state.visualizationSettings.showGuidance,
        },
    })),

    toggleAnatomyHint: () => set((state) => ({
        anatomyHintActive: !state.anatomyHintActive
    })),

    toggleAdvancedControls: () => set(state => ({
        visualizationSettings: {
            ...state.visualizationSettings,
            showAdvancedControls: !state.visualizationSettings.showAdvancedControls,
        },
    })),

    // Volume Alignment - Affine Registration
    volumeAlignment: null,
    loadVolumeAlignment: async (caseId: string) => {
        try {
            const alignment = await apiService.getAlignment(caseId);
            if (alignment && alignment.affineTransform) {
                set({ volumeAlignment: alignment });
                
                // If we have a precomputed matrix, apply it to the registration state
                const matrix = alignment.affineTransform.matrix;
                if (matrix && matrix.length === 4) {
                    // Extract position from 4x4 matrix (last column)
                    // Note: We need to handle how registration.position is used in VolumeViewer
                    // In VolumeViewer, registration.position is in mm and scaled by 'scale'
                    const pos: [number, number, number] = [matrix[0][3], matrix[1][3], matrix[2][3]];
                    
                    // Update registration to use precomputed offset
                    set((state) => ({
                        registration: {
                            ...state.registration,
                            position: pos,
                            scale: 1.0 // Assume alignment standardized scaling
                        }
                    }));
                }
            } else {
                set({ volumeAlignment: null });
            }
        } catch (e) {
            console.error('Failed to load volume alignment from backend:', e);
            set({ volumeAlignment: null });
        }
    },
    saveVolumeAlignment: (caseId: string, alignment: VolumeAlignment) => {
        // Now mostly handled backend-side, but keep for local overrides if needed
        localStorage.setItem(`volumeAlignment_${caseId}`, JSON.stringify(alignment));
        set({ volumeAlignment: alignment });
    },

    // Probe Physics
    probePhysics: initialProbePhysics,
    updateSurfaceContact: (contact: SurfaceContact) => set((state) => ({
        probePhysics: {
            ...state.probePhysics,
            surfaceContact: contact,
        },
    })),
    setProbePhysicsEnabled: (enabled: boolean) => set((state) => ({
        probePhysics: {
            ...state.probePhysics,
            constrainedMovement: enabled,
        },
    })),

    resetSession: () =>
        set({
            sessionId: null,
            status: 'not-started',
            connectionStatus: 'offline',
            currentPose: initialPose,
            probePos: initialProbePos,
            probeRot: initialProbeRot,
            imagingSettings: initialImagingSettings,
            renderSettings: initialRenderSettings,
            currentFrame: null,
            currentFeedback: null,
            snapshots: [],
            metrics: initialMetrics,
            volumeInfo: null,
            volumeVoxelData: null,
            torsoBounds: null,
            ctBounds: null,
            visualizationSettings: initialVisualizationSettings,
            volumeAlignment: null,
            probePhysics: initialProbePhysics,
            anatomyMetadata: null,
        }),
}));
