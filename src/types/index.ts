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

/**
 * Anatomical coordinate metadata derived from the NIfTI affine.
 * Retrieved from GET /api/cases/{caseId}/anatomy.
 * This is the ground truth for anatomical embedding — never assume orientation.
 */
export interface AnatomyMetadata {
    caseId: string;
    /** 4x4 NIfTI affine matrix: maps voxel (i,j,k) → world (x,y,z) in mm */
    affine: number[][];
    /** Unit direction cosines for each voxel axis in world space */
    axisOrientations: {
        i: [number, number, number];   // nibabel i-axis → world xyz
        j: [number, number, number];   // nibabel j-axis → world xyz
        k: [number, number, number];   // nibabel k-axis → world xyz
    };
    /** Nibabel orientation codes e.g. ['L','P','S'] or ['R','A','S'] */
    axisCodes: [string, string, string];
    /** Convention string e.g. 'LPS', 'RAS' */
    convention: string;
    /** World-space bounding box of the volume in mm */
    worldBounds: {
        min: [number, number, number];
        max: [number, number, number];
        center: [number, number, number];
        size: [number, number, number];
    };
    /** Voxel spacing [dx, dy, dz] in mm (nibabel i,j,k order) */
    voxelSpacing: [number, number, number];
    /** Volume shape in nibabel (X,Y,Z) order */
    niftiShape: [number, number, number];
    /** Volume shape in backend (D,H,W) = (Z,Y,X) storage order */
    backendShape: [number, number, number];
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

// Torso & Volume Registration
export interface VolumeRegistration {
    position: [number, number, number];
    rotation: [number, number, number]; // in degrees
    scale: number;
}

export interface TorsoSettings {
    opacity: number;
    wireframe: boolean;
    ctVisible: boolean;
    torsoBoundingBoxVisible: boolean;
    ctBoundingBoxVisible: boolean;
}

export interface BoundingBox3D {
    min: [number, number, number];
    max: [number, number, number];
    center: [number, number, number];
    size: [number, number, number];
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

// Visualization Modes - Progressive Disclosure
export type VisualizationMode = 'beginner' | 'intermediate' | 'advanced';

export interface VisualizationSettings {
    mode: VisualizationMode;
    showTorso: boolean;
    torsoOpacity: number;
    showVolume: boolean;
    volumeOpacity: number;
    showProbe: boolean;
    showSlicePlane: boolean;
    showGuidance: boolean;
    showAdvancedControls: boolean;
}

// Volume Alignment - Affine Registration
export interface AffineTransform {
    matrix: number[][]; // 4x4 transformation matrix
    caseId: string;
    templateId: string;
    timestamp: number;
}

export interface VolumeAlignment {
    caseId: string;
    affineTransform: AffineTransform;
    spacing: [number, number, number]; // normalized spacing (typically 1mm³)
    canonicalBounds: BoundingBox3D;
}

// Probe Physics
export interface SurfaceContact {
    contactPoint: [number, number, number];
    contactNormal: [number, number, number];
    isInContact: boolean;
    penetrationDepth: number; // mm
    pressureLevel: number; // 0-1 normalized
}

export interface ProbePhysics {
    surfaceContact: SurfaceContact;
    constrainedMovement: boolean;
    maxTiltAngle: number; // degrees
    maxPressure: number; // mm
    surfaceFollowing: boolean; // probe aligns to curvature
}

export interface SessionConfig {
    mode: TrainingMode;
    caseId: string;
    probeType: ProbeType;
    targetOrgans: string[];
    difficulty: Difficulty;
    visualizationMode: VisualizationMode;
    enableProbePhysics: boolean;
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
    probeType?: ProbeType;
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
        sliceIdx?: number;
        maxSlices?: number;
        voxelCoords?: [number, number, number];
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

export interface RawUltrasoundFrameMessage {
    type: 'rawUltrasoundFrame';
    data: {
        image: string; // base64 encoded PNG
        timestamp: number;
        sliceIdx?: number;
        maxSlices?: number;
        voxelCoords?: [number, number, number];
    };
}

export type WSMessage =
    | UltrasoundFrameMessage
    | RawUltrasoundFrameMessage
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
