import { io, Socket } from 'socket.io-client';
import type { WSMessage } from '@/types';

type MessageHandler = (message: WSMessage) => void;

interface ConnectionState {
    socket: Socket | null;
    messageHandlers: Set<MessageHandler>;
    reconnectAttempts: number;
    maxReconnectAttempts: number;
    reconnectDelay: number;
    connectionStatusCallback: ((status: 'connected' | 'reconnecting' | 'offline') => void) | null;
}

const state: ConnectionState = {
    socket: null,
    messageHandlers: new Set<MessageHandler>(),
    reconnectAttempts: 0,
    maxReconnectAttempts: 5,
    reconnectDelay: 1000,
    connectionStatusCallback: null,
};

const setupEventListeners = () => {
    if (!state.socket) return;

    state.socket.on('connect', () => {
        console.log('WebSocket connected');
        state.reconnectAttempts = 0;
        notifyConnectionStatus('connected');
    });

    state.socket.on('disconnect', (reason) => {
        console.log('WebSocket disconnected:', reason);
        notifyConnectionStatus('offline');
    });

    state.socket.on('reconnect_attempt', (attemptNumber) => {
        console.log(`WebSocket reconnection attempt ${attemptNumber}`);
        state.reconnectAttempts = attemptNumber;
        notifyConnectionStatus('reconnecting');
    });

    state.socket.on('reconnect_failed', () => {
        console.error('WebSocket reconnection failed');
        notifyConnectionStatus('offline');
    });

    state.socket.on('error', (error) => {
        console.error('WebSocket error:', error);
    });

    state.socket.on('message', (message: WSMessage) => {
        handleIncomingMessage(message);
    });

    state.socket.on('ultrasoundFrame', (data) => {
        handleIncomingMessage({ type: 'ultrasoundFrame', data });
    });

    state.socket.on('aiFeedback', (data) => {
        handleIncomingMessage({ type: 'aiFeedback', data });
    });

    state.socket.on('poseUpdate', (data) => {
        handleIncomingMessage({ type: 'poseUpdate', data });
    });

    state.socket.on('sessionEvent', (data) => {
        handleIncomingMessage({ type: 'sessionEvent', data });
    });
};

const handleIncomingMessage = (message: WSMessage) => {
    state.messageHandlers.forEach((handler) => {
        try {
            handler(message);
        } catch (error) {
            console.error('Error in message handler:', error);
        }
    });
};

const notifyConnectionStatus = (status: 'connected' | 'reconnecting' | 'offline') => {
    if (state.connectionStatusCallback) {
        state.connectionStatusCallback(status);
    }
};

export const wsService = {
    connect(wsUrl: string): void {
        if (state.socket?.connected) {
            console.warn('WebSocket already connected');
            return;
        }

        state.socket = io(wsUrl, {
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionAttempts: state.maxReconnectAttempts,
            reconnectionDelay: state.reconnectDelay,
            reconnectionDelayMax: 5000,
        });

        setupEventListeners();
    },

    onMessage(handler: MessageHandler): () => void {
        state.messageHandlers.add(handler);
        return () => {
            state.messageHandlers.delete(handler);
        };
    },

    onConnectionStatus(callback: (status: 'connected' | 'reconnecting' | 'offline') => void): void {
        state.connectionStatusCallback = callback;
    },

    disconnect(): void {
        if (state.socket) {
            state.socket.disconnect();
            state.socket = null;
            state.messageHandlers.clear();
            state.reconnectAttempts = 0;
            notifyConnectionStatus('offline');
        }
    },

    isConnected(): boolean {
        return state.socket?.connected ?? false;
    },

    emit(event: string, data: unknown): void {
        if (state.socket?.connected) {
            state.socket.emit(event, data);
        } else {
            console.warn('Cannot emit: WebSocket not connected');
        }
    }
};
