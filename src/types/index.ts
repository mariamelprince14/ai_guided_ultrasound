// Training Modes
export type TrainingMode = 'full' | 'assessment' | 'identification';

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
    ctVolume: CTVolume;
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
    gain: number; // 0-100%
    depth: number; // 5-25cm
    frequency: number; // 2-15MHz
    contactPressure: number; // 0-10N
    power: number; // 0-100%
    dynamicRange: number; // 30-90dB
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
        image: string; // base64 encoded
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

export type WSMessage =
    | UltrasoundFrameMessage
    | AIFeedbackMessage
    | PoseUpdateMessage
    | SessionEventMessage;

// Session State
export type SessionStatus = 'not-started' | 'running' | 'paused' | 'ended';

export type ConnectionStatus = 'connected' | 'reconnecting' | 'offline';

export interface SessionState {
    sessionId: string | null;
    status: SessionStatus;
    connectionStatus: ConnectionStatus;
    config: SessionConfig | null;
    currentPose: ProbePose;
    imagingSettings: ImagingSettings;
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
    config: SessionConfig;
}

export interface ApiError {
    error: string;
    message: string;
    statusCode: number;
}
