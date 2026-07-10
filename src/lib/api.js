import { getToken } from './router.js';

const API_BASE = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? 'https://nexuslink-zjp3.onrender.com' : '');
const BASE_URL = `${API_BASE}/api`;

async function request(endpoint, options = {}) {
  const token = getToken();
  const headers = {
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Don't set Content-Type for FormData
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || 'Request failed');
  }

  return res.json();
}

export const api = {
  // Auth
  register: (data) => request('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
  login: (data) => request('/auth/login', { method: 'POST', body: JSON.stringify(data) }),
  getMe: () => request('/auth/me'),

  // Rooms
  createRoom: (data) => request('/rooms', { method: 'POST', body: JSON.stringify(data) }),
  getRooms: () => request('/rooms'),
  getRoom: (id) => request(`/rooms/${id}`),
  deleteRoom: (id) => request(`/rooms/${id}`, { method: 'DELETE' }),

  // Files
  uploadFile: (formData) => request('/files/upload', { method: 'POST', body: formData }),
  getRoomFiles: (roomId) => request(`/files/room/${roomId}`),

  // Health
  health: () => request('/health'),
};
