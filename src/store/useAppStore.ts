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
} from '@/types';
import { apiService } from '@/services/api';

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
    setProbePos: (pos: { x: number; y: number; z: number }) => void;
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

    // Alignment Actions
    centerCTInTorso: () => void;
    fitCTToTorso: () => void;

    // Reset
    resetSession: () => void;
}

const initialPose: ProbePose = {
    position: { x: 0, y: 0, z: 0 },
    rotation: { pitch: 0, roll: 0, yaw: 0 },
};

const initialProbePos = { x: 0, y: 0, z: 0 };
const initialProbeRot = { pitch: 0, yaw: 0, roll: 0 };

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
    rotation: [0, 0, 0],
    scale: 1,
};

const initialTorsoSettings: TorsoSettings = {
    opacity: 0.8,
    wireframe: false,
    ctVisible: true,
    torsoBoundingBoxVisible: false,
    ctBoundingBoxVisible: false,
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
                set({ registration: reg });
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

    // Alignment Actions
    centerCTInTorso: () => set((state) => {
        if (!state.torsoBounds || !state.ctBounds) return state;
        
        // Target: Torso center (in world)
        // Current: CT center (in local scene space, unaffected by registration position yet)
        // We want CT's local center * registration.scale + registration.position to land at torso center
        const tx = state.torsoBounds.center[0] - state.ctBounds.center[0] * state.registration.scale;
        const ty = state.torsoBounds.center[1] - state.ctBounds.center[1] * state.registration.scale;
        const tz = state.torsoBounds.center[2] - state.ctBounds.center[2] * state.registration.scale;

        return {
            registration: {
                ...state.registration,
                position: [tx, ty, tz]
            }
        };
    }),
    fitCTToTorso: () => set((state) => {
        if (!state.torsoBounds || !state.ctBounds) return state;

        // Torso max world dimension
        const tSize = state.torsoBounds.size;
        const torsoMaxDim = Math.max(tSize[0], tSize[1], tSize[2]);

        // CT max local scene dimension
        const ctSize = state.ctBounds.size;
        const ctMaxDim = Math.max(ctSize[0], ctSize[1], ctSize[2]);

        // Target: CT size fits *inside* torso size with padding
        const scale = (torsoMaxDim / ctMaxDim) * 0.8;

        return {
            registration: {
                ...state.registration,
                scale: parseFloat(scale.toFixed(2))
            }
        };
    }),

    // Shared probe position/rotation (shared between ProbeControls and VolumeViewer)
    probePos: initialProbePos,
    probeRot: initialProbeRot,
    setProbePos: (pos) => set({ probePos: pos }),
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
        }),
}));
