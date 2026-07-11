import { api } from '../lib/api.js';
import { navigateTo, requireAuth, getUser, clearAuth } from '../lib/router.js';

export function renderDashboard(app) {
  if (!requireAuth()) return;

  const user = getUser();

    // No active rooms display on dashboard
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
            <div class="avatar avatar-md" style="background: ${user.avatar?.color || 'var(--bg-tertiary)'}">
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

  return () => {
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
