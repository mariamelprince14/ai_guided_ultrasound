// Training Modes
export type TrainingMode = 'full' | 'assessment' | 'identification';

// Case info from backend
export interface CaseInfo {
    id: string;
    name: string;
    folder: string;
    has_segmentation: boolean;
    volume_file: string;
}

// Volume metadata from backend
export interface VolumeInfo {
    shape: [number, number, number];
    voxelSpacing: [number, number, number];
    huMin: number;
    huMax: number;
    hasSegmentation: boolean;
    segLabels: Record<string, string>;
    bounds: {
        min: [number, number, number];
        max: [number, number, number];
        center: [number, number, number];
    };
}

export interface VolumeVoxelData {
    data: Uint8Array;
    metadata: {
        dims: [number, number, number];
        spacing: [number, number, number];
        factors: [number, number, number];
        huRange: [number, number];
        axisOrder: string;
    };
}

// Session Configuration
export interface CTVolume {
    id: string;
    name: string;
    voxelSpacing: [number, number, number];
    sliceCount: number;
    availableOrgans: string[];
    metadata?: Record<string, unknown>;
}

export type ProbeType = 'linear' | 'curvilinear';

export type Difficulty = 'beginner' | 'intermediate' | 'advanced';

export interface SessionConfig {
    mode: TrainingMode;
    caseId: string;
    probeType: ProbeType;
    targetOrgans: string[];
    difficulty: Difficulty;
    sessionLabel?: string;
}

// Probe Pose
export interface ProbePose {
    position: {
        x: number;
        y: number;
        z: number;
    };
    rotation: {
        pitch: number;
        roll: number;
        yaw: number;
    };
}

// Imaging Settings (Probe Parameters)
export interface ImagingSettings {
    gain: number;         // 0-100%
    depth: number;        // 5-25cm
    frequency: number;    // 2-15MHz
    contactPressure: number; // 0-10N
    power: number;        // 0-100%
    dynamicRange: number; // 30-90dB
    windowLevel: number;  // HU center
    windowWidth: number;  // HU width
}

// Backend rendering settings
export interface RenderSettings {
    wl: number;          // window level (HU)
    ww: number;          // window width (HU)
    showSeg: boolean;    // show segmentation overlay
    planeSizeMm: number; // probe plane size in mm
    resolution: number;  // output resolution px
    clippingEnabled: boolean; // render only region around probe
}

// AI Feedback
export interface AIFeedback {
    qualityScore: number; // 0-100
    viewLabel: string;
    guidanceSteps: string[];
    justification: string;
    progressChecklist: {
        targetCentered: boolean;
        depthAppropriate: boolean;
        shadowingReduced: boolean;
        [key: string]: boolean;
    };
    overlayCoordinates?: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
}

// WebSocket Messages
export interface UltrasoundFrameMessage {
    type: 'ultrasoundFrame';
    data: {
        image: string; // base64 encoded PNG
        timestamp: number;
    };
}

export interface AIFeedbackMessage {
    type: 'aiFeedback';
    data: AIFeedback;
}

export interface PoseUpdateMessage {
    type: 'poseUpdate';
    data: ProbePose;
}

export interface SessionEventMessage {
    type: 'sessionEvent';
    data: {
        event: 'started' | 'paused' | 'resumed' | 'stopped' | 'error';
        message?: string;
        timestamp: number;
    };
}

export interface CaptureResultMessage {
    type: 'captureResult';
    data: {
        success: boolean;
        frame_index: number;
        frame_path: string;
        pose_path: string;
    };
}

export type WSMessage =
    | UltrasoundFrameMessage
    | AIFeedbackMessage
    | PoseUpdateMessage
    | SessionEventMessage
    | CaptureResultMessage;

// Session State
export type SessionStatus = 'not-started' | 'loading' | 'running' | 'paused' | 'ended';

export type ConnectionStatus = 'connected' | 'reconnecting' | 'offline';

export interface SessionState {
    sessionId: string | null;
    status: SessionStatus;
    connectionStatus: ConnectionStatus;
    config: SessionConfig | null;
    currentPose: ProbePose;
    imagingSettings: ImagingSettings;
    renderSettings: RenderSettings;
    currentFrame: string | null; // base64 image
    currentFeedback: AIFeedback | null;
    snapshots: Snapshot[];
    metrics: SessionMetrics;
}

export interface Snapshot {
    id: string;
    image: string; // base64
    timestamp: number;
    label: string;
    pose: ProbePose;
    qualityScore: number;
}

export interface SessionMetrics {
    startTime: number | null;
    endTime: number | null;
    duration: number; // seconds
    bestQualityScore: number;
    correctAnswers: number;
    totalAttempts: number;
}

// Assessment Mode
export interface MCQQuestion {
    id: string;
    questionText: string;
    image: string; // base64
    options: string[];
    correctAnswer: number;
    explanation: string;
    timeLimit?: number; // seconds
}

// Identification Mode
export interface IdentificationTask {
    id: string;
    image: string; // base64
    correctOrgan: string;
    correctView: string;
    correctProbeType?: ProbeType;
}

// API Responses
export interface CreateSessionResponse {
    sessionId: string;
    wsUrl: string;
    caseId: string;
    volumeInfo: VolumeInfo;
    config: {
        mode: string;
        probeType: string;
        targetOrgans: string[];
        difficulty: string;
    };
}

export interface ApiError {
    error: string;
    message: string;
    statusCode: number;
}
