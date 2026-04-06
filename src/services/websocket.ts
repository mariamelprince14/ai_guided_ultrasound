/**
 * websocket.ts
 * ─────────────
 * WebSocket service for real-time probe→ultrasound-frame streaming.
 *
 * Protocol:
 *   Send:    { type: "probeUpdate", data: { x, y, z, pitch, yaw, roll } }
 *            { type: "settingsUpdate", data: { wl, ww, showSeg, planeSizeMm, resolution } }
 *            { type: "capture" }
 *            { type: "ping" }
 *   Receive: { type: "ultrasoundFrame", data: { image: string, timestamp: number } }
 *            { type: "sessionEvent", data: { event, message, timestamp } }
 *            { type: "captureResult", data: { success, frame_index, frame_path, pose_path } }
 */

import type { WSMessage } from '@/types';

const WS_BASE_URL = import.meta.env.VITE_WS_BASE_URL || 'ws://localhost:8000';

type MessageHandler = (message: WSMessage) => void;
type ConnectionHandler = (status: 'connected' | 'disconnected' | 'error') => void;

class WebSocketService {
    private ws: WebSocket | null = null;
    private messageHandlers: Set<MessageHandler> = new Set();
    private connectionHandlers: Set<ConnectionHandler> = new Set();
    private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    private currentSessionId: string | null = null;
    private shouldReconnect = true;
    private reconnectDelay = 2000;
    private pingInterval: ReturnType<typeof setInterval> | null = null;

    connect(sessionId: string): void {
        this.currentSessionId = sessionId;
        this.shouldReconnect = true;
        this._connect();
    }

    private _connect(): void {
        if (!this.currentSessionId) return;
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.close();
        }

        const url = `${WS_BASE_URL}/ws/${this.currentSessionId}`;
        console.log(`[WS] Connecting to ${url}`);
        this.ws = new WebSocket(url);

        this.ws.onopen = () => {
            console.log('[WS] Connected');
            this.reconnectDelay = 2000;
            this.connectionHandlers.forEach(h => h('connected'));
            // Keep-alive ping every 20s
            this.pingInterval = setInterval(() => {
                this.send({ type: 'ping', data: {} });
            }, 20_000);
        };

        this.ws.onmessage = (event) => {
            try {
                const msg: WSMessage = JSON.parse(event.data);
                this.messageHandlers.forEach(h => h(msg));
            } catch (e) {
                console.error('[WS] Failed to parse message:', e);
            }
        };

        this.ws.onerror = (e) => {
            console.error('[WS] Error:', e);
            this.connectionHandlers.forEach(h => h('error'));
        };

        this.ws.onclose = () => {
            console.log('[WS] Disconnected');
            if (this.pingInterval) clearInterval(this.pingInterval);
            this.connectionHandlers.forEach(h => h('disconnected'));
            if (this.shouldReconnect) {
                console.log(`[WS] Reconnecting in ${this.reconnectDelay}ms...`);
                this.reconnectTimer = setTimeout(() => {
                    this.reconnectDelay = Math.min(this.reconnectDelay * 1.5, 10_000);
                    this._connect();
                }, this.reconnectDelay);
            }
        };
    }

    disconnect(): void {
        this.shouldReconnect = false;
        if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
        if (this.pingInterval) clearInterval(this.pingInterval);
        this.ws?.close();
        this.ws = null;
        this.currentSessionId = null;
    }

    send(message: Record<string, unknown>): void {
        if (this.ws?.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(message));
        } else {
            console.warn('[WS] Cannot send — not connected');
        }
    }

    /** Send probe pose update to backend */
    sendProbeUpdate(x: number, y: number, z: number,
                    pitch: number, yaw: number, roll: number): void {
        this.send({
            type: 'probeUpdate',
            data: { x, y, z, pitch, yaw, roll },
        });
    }

    /** Send render settings update */
    sendSettingsUpdate(settings: {
        wl?: number;
        ww?: number;
        showSeg?: boolean;
        planeSizeMm?: number;
        resolution?: number;
    }): void {
        this.send({ type: 'settingsUpdate', data: settings });
    }

    /** Trigger a capture from the backend */
    sendCapture(): void {
        this.send({ type: 'capture', data: {} });
    }

    /** Register a handler for incoming messages */
    onMessage(handler: MessageHandler): () => void {
        this.messageHandlers.add(handler);
        return () => this.messageHandlers.delete(handler);
    }

    /** Register a connection status handler */
    onConnection(handler: ConnectionHandler): () => void {
        this.connectionHandlers.add(handler);
        return () => this.connectionHandlers.delete(handler);
    }

    get isConnected(): boolean {
        return this.ws?.readyState === WebSocket.OPEN;
    }
}

export const wsService = new WebSocketService();
