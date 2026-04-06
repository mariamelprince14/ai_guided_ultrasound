import type {
    SessionConfig,
    CreateSessionResponse,
    ProbePose,
    ApiError,
    CaseInfo,
} from '@/types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

class ApiService {
    private async request<T>(
        endpoint: string,
        options: RequestInit = {}
    ): Promise<T> {
        const url = `${API_BASE_URL}${endpoint}`;

        const config: RequestInit = {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...options.headers,
            },
        };

        try {
            const response = await fetch(url, config);

            if (!response.ok) {
                const error: ApiError = await response.json().catch(() => ({
                    error: 'Unknown Error',
                    message: response.statusText,
                    statusCode: response.status,
                }));
                throw error;
            }

            return await response.json();
        } catch (error) {
            if ((error as ApiError).statusCode) {
                throw error;
            }
            throw {
                error: 'Network Error',
                message: 'Failed to connect to backend. Make sure backend/start.bat is running.',
                statusCode: 0,
            } as ApiError;
        }
    }

    /** Fetch all available CT cases from the backend */
    async getCases(): Promise<{ cases: CaseInfo[] }> {
        return this.request<{ cases: CaseInfo[] }>('/api/cases');
    }

    /** Create a new training session — loads the CT volume into memory */
    async createSession(config: SessionConfig): Promise<CreateSessionResponse> {
        return this.request<CreateSessionResponse>('/api/session/create', {
            method: 'POST',
            body: JSON.stringify({
                case_id: config.caseId,
                mode: config.mode,
                probe_type: config.probeType,
                target_organs: config.targetOrgans,
                difficulty: config.difficulty,
            }),
        });
    }

    /** Get session info */
    async getSession(sessionId: string): Promise<Record<string, unknown>> {
        return this.request(`/api/session/${sessionId}`);
    }

    /** Stop a session */
    async stopSession(sessionId: string): Promise<{ success: boolean }> {
        return this.request(`/api/session/${sessionId}/stop`, {
            method: 'POST',
        });
    }

    /** On-demand slice via HTTP (polling fallback, WS preferred) */
    async getSlice(sessionId: string, pose: ProbePose, showSeg = false): Promise<{ image: string; timestamp: number }> {
        return this.request('/api/slice', {
            method: 'POST',
            body: JSON.stringify({
                session_id: sessionId,
                x: pose.position.x,
                y: pose.position.y,
                z: pose.position.z,
                pitch: pose.rotation.pitch,
                yaw: pose.rotation.yaw,
                roll: pose.rotation.roll,
                show_seg: showSeg,
            }),
        });
    }

    /** Capture the current frame + probe pose to disk */
    async captureFrame(
        sessionId: string,
        probeMatrix: number[][],
        showSeg = false,
        wl = 60,
        ww = 360,
    ): Promise<{ success: boolean; frame_index: number; frame_path: string; pose_path: string }> {
        return this.request('/api/capture', {
            method: 'POST',
            body: JSON.stringify({
                session_id: sessionId,
                probe_matrix: probeMatrix,
                show_seg: showSeg,
                wl,
                ww,
            }),
        });
    }

    /** List all saved captures for a session */
    async listCaptures(sessionId: string): Promise<{ captures: unknown[] }> {
        return this.request(`/api/captures/${sessionId}`);
    }
}

export const apiService = new ApiService();
