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
} from '@/types';

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

    // Reset
    resetSession: () => void;
}

const initialPose: ProbePose = {
    position: { x: 0, y: 0, z: 0 },
    rotation: { pitch: 0, roll: 0, yaw: 0 },
};

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

    resetSession: () =>
        set({
            sessionId: null,
            status: 'not-started',
            connectionStatus: 'offline',
            currentPose: initialPose,
            imagingSettings: initialImagingSettings,
            renderSettings: initialRenderSettings,
            currentFrame: null,
            currentFeedback: null,
            snapshots: [],
            metrics: initialMetrics,
            volumeInfo: null,
        }),
}));
