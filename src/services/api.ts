import type {
    SessionConfig,
    CreateSessionResponse,
    ProbePose,
    ApiError,
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
                message: 'Failed to connect to backend',
                statusCode: 0,
            } as ApiError;
        }
    }

    async createSession(config: SessionConfig): Promise<CreateSessionResponse> {
        return this.request<CreateSessionResponse>('/api/session/create', {
            method: 'POST',
            body: JSON.stringify(config),
        });
    }

    async updateProbePose(sessionId: string, pose: ProbePose): Promise<{ success: boolean }> {
        return this.request(`/api/session/${sessionId}/probePose`, {
            method: 'POST',
            body: JSON.stringify(pose),
        });
    }

    async pauseSession(sessionId: string): Promise<{ success: boolean }> {
        return this.request(`/api/session/${sessionId}/pause`, {
            method: 'POST',
        });
    }

    async resumeSession(sessionId: string): Promise<{ success: boolean }> {
        return this.request(`/api/session/${sessionId}/resume`, {
            method: 'POST',
        });
    }

    async stopSession(sessionId: string): Promise<{ success: boolean }> {
        return this.request(`/api/session/${sessionId}/stop`, {
            method: 'POST',
        });
    }

    async captureSnapshot(sessionId: string): Promise<{ snapshotId: string }> {
        return this.request(`/api/session/${sessionId}/snapshot`, {
            method: 'POST',
        });
    }

    async freezeStream(sessionId: string, freeze: boolean): Promise<{ success: boolean }> {
        return this.request(`/api/session/${sessionId}/freeze`, {
            method: 'POST',
            body: JSON.stringify({ freeze }),
        });
    }
}

export const apiService = new ApiService();
