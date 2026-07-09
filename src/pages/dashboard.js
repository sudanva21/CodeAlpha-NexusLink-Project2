import { api } from '../lib/api.js';
import { navigateTo, requireAuth, getUser, clearAuth } from '../lib/router.js';

export function renderDashboard(app) {
  if (!requireAuth()) return;

  const user = getUser();

  async function loadRooms() {
    try {
      const rooms = await api.getRooms();
      const list = document.getElementById('room-list');
      if (!list) return;

      if (rooms.length === 0) {
        list.innerHTML = `
          <div class="empty-state">
            <div class="empty-state-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="opacity:0.4">
                <polygon points="23 7 16 12 23 17 23 7"/>
                <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
              </svg>
            </div>
            <p>No active rooms yet. Create one to get started!</p>
          </div>
        `;
        return;
      }

      list.innerHTML = rooms.map((room) => `
        <div class="room-item" data-room-id="${room.id}">
          <div class="room-item-left">
            <div class="room-item-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polygon points="23 7 16 12 23 17 23 7"/>
                <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
              </svg>
            </div>
            <div class="room-item-info">
              <h4>${escapeHtml(room.name)}</h4>
              <p>Host: ${escapeHtml(room.host.username)} &middot; ID: ${room.id}</p>
            </div>
          </div>
          <div class="room-item-meta">
            <div class="participant-count">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
              </svg>
              ${room.participantCount}
            </div>
            <span class="btn btn-primary btn-sm">Join</span>
          </div>
        </div>
      `).join('');

      // Click to join
      list.querySelectorAll('.room-item').forEach((item) => {
        item.addEventListener('click', () => {
          const roomId = item.dataset.roomId;
          navigateTo(`/room/${roomId}`);
        });
      });
    } catch (err) {
      console.error('Failed to load rooms:', err);
    }
  }

  app.innerHTML = `
    <div class="dashboard-page">
      <nav class="dash-nav">
        <div class="dash-nav-left">
          <div class="nav-logo">
            <div class="nav-logo-icon">N</div>
            NexusLink
          </div>
        </div>
        <div class="dash-nav-right">
          <div class="dash-user">
            <div class="avatar avatar-md" style="background: ${user.avatar?.color || '#5B4FD6'}">
              ${user.avatar?.initials || user.username?.slice(0, 2).toUpperCase()}
            </div>
            <span class="dash-user-name">${escapeHtml(user.username)}</span>
          </div>
          <button class="btn btn-ghost btn-sm" id="logout-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            Logout
          </button>
        </div>
      </nav>

      <div class="dash-content">
        <div class="dash-welcome">
          <h1>Hello, ${escapeHtml(user.username)} &#128075;</h1>
          <p>Create or join a room to start collaborating</p>
        </div>

        <div class="dash-actions">
          <div class="dash-action-card">
            <h3>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="16"/>
                <line x1="8" y1="12" x2="16" y2="12"/>
              </svg>
              New Room
            </h3>
            <p>Create a new room and invite others to join</p>
            <div class="dash-action-form">
              <input type="text" class="input" id="room-name" placeholder="Room name (optional)" />
              <button class="btn btn-primary" id="create-room-btn">Create</button>
            </div>
          </div>

          <div class="dash-action-card">
            <h3>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent-secondary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/>
                <polyline points="10 17 15 12 10 7"/>
                <line x1="15" y1="12" x2="3" y2="12"/>
              </svg>
              Join Room
            </h3>
            <p>Enter a room ID to join an existing session</p>
            <div class="dash-action-form">
              <input type="text" class="input" id="join-room-id" placeholder="Enter room ID" />
              <button class="btn btn-secondary" id="join-room-btn">Join</button>
            </div>
          </div>
        </div>

        <div class="dash-rooms-header">
          <h2>Active Rooms</h2>
          <button class="btn btn-ghost btn-sm" id="refresh-rooms">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="23 4 23 10 17 10"/>
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
            </svg>
            Refresh
          </button>
        </div>

        <div id="room-list" class="room-list">
          <div class="empty-state">
            <div class="spinner" style="margin: 0 auto;"></div>
            <p class="mt-4">Loading rooms...</p>
          </div>
        </div>
      </div>
    </div>
  `;

  // Event handlers
  document.getElementById('logout-btn').addEventListener('click', () => {
    clearAuth();
    navigateTo('/');
  });

  document.getElementById('create-room-btn').addEventListener('click', async () => {
    const name = document.getElementById('room-name').value.trim();
    try {
      const room = await api.createRoom({ name });
      navigateTo(`/room/${room.id}`);
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  document.getElementById('join-room-btn').addEventListener('click', () => {
    const roomId = document.getElementById('join-room-id').value.trim();
    if (roomId) {
      navigateTo(`/room/${roomId}`);
    }
  });

  // Enter key support
  document.getElementById('room-name').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('create-room-btn').click();
  });

  document.getElementById('join-room-id').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('join-room-btn').click();
  });

  document.getElementById('refresh-rooms').addEventListener('click', loadRooms);

  // Load rooms
  loadRooms();

  // Auto-refresh rooms every 10 seconds
  const refreshInterval = setInterval(loadRooms, 10000);

  return () => {
    clearInterval(refreshInterval);
  };
}

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function showToast(message, type = 'info') {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('toast-exit');
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}
