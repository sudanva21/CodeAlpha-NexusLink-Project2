import { io } from 'https://cdn.socket.io/4.7.5/socket.io.esm.min.js';
import { getToken } from './router.js';

let socket = null;

export function connectSocket() {
  if (socket && socket.connected) return socket;

  const token = getToken();
  if (!token) return null;

  socket = io({
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
  });

  socket.on('connect', () => {
    console.log('[Socket] Connected:', socket.id);
  });

  socket.on('connect_error', (err) => {
    console.error('[Socket] Connection error:', err.message);
  });

  socket.on('disconnect', (reason) => {
    console.log('[Socket] Disconnected:', reason);
  });

  return socket;
}

export function getSocket() {
  if (!socket || !socket.connected) {
    return connectSocket();
  }
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
