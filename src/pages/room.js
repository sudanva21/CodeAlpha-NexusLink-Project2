import { api } from '../lib/api.js';
import { navigateTo, requireAuth, getUser } from '../lib/router.js';
import { getSocket, connectSocket, disconnectSocket } from '../lib/socket.js';
import {
  getLocalStream, toggleMic, toggleCamera, flipCamera, startScreenShare, stopScreenShare,
  isScreenSharing, callPeer, handleOffer, handleAnswer, handleIceCandidate,
  removePeer, cleanupWebRTC, setCallbacks
} from '../lib/webrtc.js';
import { deriveRoomKey, encryptMessage, decryptMessage } from '../lib/encryption.js';
import { WhiteboardEngine } from '../lib/whiteboard.js';

let whiteboardEngine = null;
let currentPanel = null; // 'chat' | 'participants' | 'files' | null
let micEnabled = true;
let camEnabled = true;

export async function renderRoom(app, params) {
  if (!requireAuth()) return;

  const roomId = params.id;
  const user = getUser();

  // Verify room exists
  let room;
  try {
    room = await api.getRoom(roomId);
  } catch (err) {
    showToast('Room not found', 'error');
    navigateTo('/dashboard');
    return;
  }

  // Derive encryption key for this room
  await deriveRoomKey(roomId);

  // State
  let participants = [];
  let chatMessages = [];
  let files = [];

  app.innerHTML = buildRoomHTML(room, user);

  // Setup Socket
  const socket = connectSocket();
  if (!socket) {
    showToast('Connection failed', 'error');
    navigateTo('/dashboard');
    return;
  }

  // Get local media
  const localStream = await getLocalStream(true, true);
  if (localStream) {
    const localVideo = document.getElementById('local-video');
    if (localVideo) {
      localVideo.srcObject = localStream;
    }
  }

  // Setup WebRTC callbacks
  setCallbacks({
    onRemoteStream: (socketId, stream) => {
      addRemoteVideo(socketId, stream);
    },
    onRemoteStreamRemoved: (socketId) => {
      removeRemoteVideo(socketId);
    },
  });

  // Join room via socket
  socket.emit('join-room', { roomId });

  // Socket event handlers
  socket.on('existing-users', async ({ users }) => {
    document.getElementById('lobby-overlay').style.display = 'none';
    for (const u of users) {
      await callPeer(u.socketId);
    }
  });

  socket.on('waiting-for-host', () => {
    const overlay = document.getElementById('lobby-overlay');
    overlay.style.display = 'flex';
    const textEl = overlay.querySelector('h2');
    if (textEl) textEl.textContent = 'Please wait until a meeting host brings you into the call';
  });

  socket.on('host-not-present', () => {
    const overlay = document.getElementById('lobby-overlay');
    overlay.style.display = 'flex';
    const textEl = overlay.querySelector('h2');
    if (textEl) textEl.textContent = 'Waiting for meeting host to start the meeting.';
  });

  socket.on('join-denied', () => {
    showToast('Your request to join was denied', 'error');
    navigateTo('/dashboard');
  });

  socket.on('join-request', (userInfo) => {
    const container = document.getElementById('host-requests-container');
    if (!container) return;

    const reqEl = document.createElement('div');
    reqEl.className = 'host-request-toast';
    reqEl.innerHTML = `
      <div class="request-info">
        <div class="request-avatar">${escapeHtml(userInfo.username.charAt(0).toUpperCase())}</div>
        <div class="request-text">
          <strong>${escapeHtml(userInfo.username)}</strong> wants to join
        </div>
      </div>
      <div class="request-actions">
        <button class="btn btn-primary btn-sm" id="admit-${userInfo.socketId}">Admit</button>
        <button class="btn btn-ghost btn-sm" id="deny-${userInfo.socketId}">Deny</button>
      </div>
    `;

    container.appendChild(reqEl);

    document.getElementById(\`admit-\${userInfo.socketId}\`).addEventListener('click', () => {
      socket.emit('admit-user', { socketId: userInfo.socketId });
      reqEl.remove();
    });

    document.getElementById(\`deny-\${userInfo.socketId}\`).addEventListener('click', () => {
      socket.emit('deny-user', { socketId: userInfo.socketId });
      reqEl.remove();
    });
  });

  socket.on('user-joined', async (userInfo) => {
    showToast(`${userInfo.username} joined`, 'info');
  });

  socket.on('offer', async ({ from, offer }) => {
    await handleOffer(from, offer);
  });

  socket.on('answer', async ({ from, answer }) => {
    await handleAnswer(from, answer);
  });

  socket.on('ice-candidate', async ({ from, candidate }) => {
    await handleIceCandidate(from, candidate);
  });

  socket.on('user-left', ({ socketId, username }) => {
    removePeer(socketId);
    removeRemoteVideo(socketId);
    showToast(`${username} left`, 'info');
  });

  socket.on('participants-updated', (parts) => {
    participants = parts;
    updateParticipantsList(participants);
    updateVideoGridLayout();
  });

  socket.on('chat-message', async (msg) => {
    // Decrypt message
    if (msg.encrypted && msg.message) {
      try {
        msg.decryptedText = await decryptMessage(msg.message);
      } catch {
        msg.decryptedText = '[Could not decrypt]';
      }
    } else {
      msg.decryptedText = msg.message;
    }
    chatMessages.push(msg);
    appendChatMessage(msg);
  });

  socket.on('file-shared', (fileMeta) => {
    files.push(fileMeta);
    appendFileItem(fileMeta);
    showToast(`${fileMeta.sharedBy?.username || 'Someone'} shared a file`, 'info');
  });

  socket.on('user-screen-sharing', ({ socketId, username, sharing }) => {
    const tile = document.querySelector(`.video-tile[data-socket-id="${socketId}"]`);
    if (tile) {
      if (sharing) {
        tile.classList.add('screen-share');
      } else {
        tile.classList.remove('screen-share');
      }
    }
    showToast(`${username} ${sharing ? 'started' : 'stopped'} screen sharing`, 'info');
  });

  // Load existing files
  try {
    files = await api.getRoomFiles(roomId);
    renderFileList(files);
  } catch (err) {
    // ignore
  }

  // --- Control bar event handlers ---
  setupControls(roomId, socket, user);
  
  // Add click to pin on local tile
  const localTile = document.getElementById('local-tile');
  if (localTile) {
    localTile.addEventListener('click', () => {
      document.querySelectorAll('.video-tile').forEach(t => t.classList.remove('pinned'));
      localTile.classList.add('pinned');
    });
  }

  // Cleanup function
  return () => {
    socket.emit('leave-room');
    cleanupWebRTC();
    if (whiteboardEngine) {
      whiteboardEngine.destroy();
      whiteboardEngine = null;
    }
    socket.off('existing-users');
    socket.off('user-joined');
    socket.off('offer');
    socket.off('answer');
    socket.off('ice-candidate');
    socket.off('user-left');
    socket.off('participants-updated');
    socket.off('chat-message');
    socket.off('file-shared');
    socket.off('user-screen-sharing');
    disconnectSocket();
    currentPanel = null;
  };
}

function buildRoomHTML(room, user) {
  return `
    <div class="room-page">
      <!-- Top bar -->
      <div class="room-topbar">
        <div class="room-topbar-left">
          <button class="btn btn-ghost btn-sm" id="back-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="19" y1="12" x2="5" y2="12"/>
              <polyline points="12 19 5 12 12 5"/>
            </svg>
          </button>
          <h3>${escapeHtml(room.name)}</h3>
        </div>
        <div class="room-topbar-center">
          <div class="room-id-badge" id="copy-room-id" title="Click to copy room ID">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
            </svg>
            ${room.id}
          </div>
          <span class="badge badge-success">
            <span style="width:6px;height:6px;border-radius:50%;background:var(--success);display:inline-block;"></span>
            Live
          </span>
        </div>
        <div class="room-topbar-right">
          <button class="btn btn-ghost btn-sm" id="toggle-participants" title="Participants">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
          </button>
          <button class="btn btn-ghost btn-sm" id="toggle-chat" title="Chat">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
          </button>
          <button class="btn btn-ghost btn-sm" id="toggle-files" title="Files">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/>
              <polyline points="13 2 13 9 20 9"/>
            </svg>
          </button>
        </div>
      </div>

      <!-- Body -->
      <div class="room-body">
        <div class="video-area">
          <div class="video-grid" id="video-grid" data-count="1">
            <div class="video-tile local pinned" id="local-tile">
              <video id="local-video" autoplay muted playsinline></video>
              <div class="video-tile-overlay">
                <span class="video-tile-name">You (${escapeHtml(user.username)})</span>
                <div class="video-tile-status">
                  <span id="mic-status-icon">&#127908;</span>
                  <span id="cam-status-icon">&#127909;</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Side panel (hidden by default) -->
        <div class="side-panel" id="side-panel" style="display: none;">
          <div class="panel-header">
            <h4 id="panel-title">Chat</h4>
            <button class="btn btn-ghost btn-sm" id="close-panel">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>

          <!-- Chat panel -->
          <div id="chat-panel" class="panel-body" style="display:none;">
            <div class="chat-messages" id="chat-messages"></div>
          </div>
          <div id="chat-input-area" class="chat-input-area" style="display:none;">
            <div class="chat-input-row">
              <input type="text" class="input" id="chat-input" placeholder="Type a message... (encrypted)" />
              <button class="btn btn-primary btn-sm" id="send-chat">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13"/>
                  <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                </svg>
              </button>
            </div>
            <p class="text-xs text-muted mt-2" style="display:flex;align-items:center;gap:4px;">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--success)" stroke-width="2.5"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              End-to-end encrypted
            </p>
          </div>

          <!-- Participants panel -->
          <div id="participants-panel" class="panel-body" style="display:none;">
            <div id="participants-list"></div>
          </div>

          <!-- Files panel -->
          <div id="files-panel" class="panel-body" style="display:none;">
            <div class="file-upload-area" id="file-upload-area">
              <div class="file-upload-icon">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="17 8 12 3 7 8"/>
                  <line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
              </div>
              <p>Drop files here or click to upload</p>
              <span>Max 50MB per file</span>
            </div>
            <input type="file" id="file-input" class="file-input-hidden" multiple />
            <div id="file-list"></div>
          </div>
        </div>
      </div>

      <!-- Control bar -->
      <div class="room-controls">
        <button class="control-btn" id="mic-btn" title="Toggle Microphone">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
            <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
            <line x1="12" y1="19" x2="12" y2="23"/>
            <line x1="8" y1="23" x2="16" y2="23"/>
          </svg>
        </button>

        <button class="control-btn" id="cam-btn" title="Toggle Camera">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polygon points="23 7 16 12 23 17 23 7"/>
            <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
          </svg>
        </button>

        <button class="control-btn" id="flip-cam-btn" title="Flip Camera" style="display:none;">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="1 4 1 10 7 10"></polyline>
            <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>
          </svg>
        </button>

        <div class="control-divider"></div>

        <button class="control-btn" id="screen-btn" title="Screen Share">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
            <line x1="8" y1="21" x2="16" y2="21"/>
            <line x1="12" y1="17" x2="12" y2="21"/>
          </svg>
        </button>

        <button class="control-btn" id="whiteboard-btn" title="Whiteboard">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 19l7-7 3 3-7 7-3-3z"/>
            <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/>
            <path d="M2 2l7.586 7.586"/>
            <circle cx="11" cy="11" r="2"/>
          </svg>
        </button>

        <div class="control-divider"></div>

        <button class="control-btn end-call" id="leave-btn" title="Leave Room">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91"/>
            <line x1="23" y1="1" x2="1" y2="23"/>
          </svg>
        </button>
      </div>

      <!-- Whiteboard overlay (hidden by default) -->
      <div id="whiteboard-overlay" class="whiteboard-overlay" style="display:none;">
        <div class="whiteboard-topbar">
          <h3>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 19l7-7 3 3-7 7-3-3z"/>
              <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/>
            </svg>
            Whiteboard
          </h3>
          <div class="whiteboard-topbar-actions">
            <button class="btn btn-ghost btn-sm" id="wb-undo">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
              Undo
            </button>
            <button class="btn btn-ghost btn-sm" id="wb-clear">Clear All</button>
            <button class="btn btn-ghost btn-sm" id="wb-export">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Export
            </button>
            <button class="btn btn-secondary btn-sm" id="wb-close">Close</button>
          </div>
        </div>
        <div class="whiteboard-body">
          <div class="whiteboard-toolbar" id="wb-toolbar">
            <button class="wb-tool active" data-tool="pen" title="Pen">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/></svg>
            </button>
            <button class="wb-tool" data-tool="eraser" title="Eraser">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 20H7L3 16l8.5-8.5a2.83 2.83 0 0 1 4 0l5 5a2.83 2.83 0 0 1 0 4L16 21"/></svg>
            </button>
            <button class="wb-tool" data-tool="line" title="Line">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="19" x2="19" y2="5"/></svg>
            </button>
            <button class="wb-tool" data-tool="rect" title="Rectangle">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>
            </button>
            <button class="wb-tool" data-tool="circle" title="Circle">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg>
            </button>

            <div class="wb-divider"></div>

            <div class="wb-colors" id="wb-colors">
              <div class="wb-color active" data-color="#1A1A2E" style="background:#1A1A2E"></div>
              <div class="wb-color" data-color="#5B4FD6" style="background:#5B4FD6"></div>
              <div class="wb-color" data-color="#E8604C" style="background:#E8604C"></div>
              <div class="wb-color" data-color="#1EA896" style="background:#1EA896"></div>
              <div class="wb-color" data-color="#F59E0B" style="background:#F59E0B"></div>
              <div class="wb-color" data-color="#3B82F6" style="background:#3B82F6"></div>
            </div>

            <div class="wb-divider"></div>

            <div class="wb-stroke-sizes" id="wb-strokes">
              <div class="wb-stroke" data-width="2" title="Thin">
                <div class="wb-stroke-dot" style="width:4px;height:4px;"></div>
              </div>
              <div class="wb-stroke active" data-width="4" title="Medium">
                <div class="wb-stroke-dot" style="width:8px;height:8px;"></div>
              </div>
              <div class="wb-stroke" data-width="8" title="Thick">
                <div class="wb-stroke-dot" style="width:14px;height:14px;"></div>
              </div>
            </div>
          </div>

          <div class="whiteboard-canvas-area">
            <canvas id="whiteboard-canvas"></canvas>
            <div class="whiteboard-info">
              <span>Collaborative Mode</span>
              <span>|</span>
              <span>Room: ${escapeHtml(String(undefined))} </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Host Requests Container -->
      <div id="host-requests-container" class="host-requests-container"></div>
      
      <!-- Lobby Overlay -->
      <div id="lobby-overlay" class="lobby-overlay" style="display:none;">
        <div class="lobby-content">
          <div class="lobby-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <polyline points="12 6 12 12 16 14"/>
            </svg>
          </div>
          <h2>Please wait until a meeting host brings you into the call</h2>
        </div>
      </div>
    </div>
  `;
}

function setupControls(roomId, socket, user) {
  // Mic toggle
  document.getElementById('mic-btn').addEventListener('click', () => {
    micEnabled = toggleMic();
    const btn = document.getElementById('mic-btn');
    btn.classList.toggle('muted', !micEnabled);
    document.getElementById('mic-status-icon').style.opacity = micEnabled ? '1' : '0.3';
  });

  // Camera toggle
  document.getElementById('cam-btn').addEventListener('click', () => {
    camEnabled = toggleCamera();
    const btn = document.getElementById('cam-btn');
    btn.classList.toggle('muted', !camEnabled);
    document.getElementById('cam-status-icon').style.opacity = camEnabled ? '1' : '0.3';
  });

  // Flip Camera
  const flipBtn = document.getElementById('flip-cam-btn');
  // Only show on mobile where facing mode is usually relevant
  if (window.innerWidth <= 768) {
    flipBtn.style.display = 'flex';
  }
  flipBtn.addEventListener('click', async () => {
    if (!camEnabled) return; // Only flip if camera is on
    const success = await flipCamera();
    if (!success) {
      console.warn('Failed to flip camera');
    }
  });

  // Screen share
  document.getElementById('screen-btn').addEventListener('click', async () => {
    const btn = document.getElementById('screen-btn');
    if (isScreenSharing()) {
      await stopScreenShare();
      btn.classList.remove('active');
    } else {
      const stream = await startScreenShare();
      if (stream) {
        btn.classList.add('active');
      }
    }
  });

  // Whiteboard
  document.getElementById('whiteboard-btn').addEventListener('click', () => {
    openWhiteboard(roomId);
  });

  document.getElementById('wb-close').addEventListener('click', closeWhiteboard);

  // Whiteboard toolbar
  document.getElementById('wb-toolbar').addEventListener('click', (e) => {
    const toolBtn = e.target.closest('.wb-tool');
    if (toolBtn && whiteboardEngine) {
      document.querySelectorAll('.wb-tool').forEach((b) => b.classList.remove('active'));
      toolBtn.classList.add('active');
      whiteboardEngine.setTool(toolBtn.dataset.tool);
    }
  });

  document.getElementById('wb-colors').addEventListener('click', (e) => {
    const colorEl = e.target.closest('.wb-color');
    if (colorEl && whiteboardEngine) {
      document.querySelectorAll('.wb-color').forEach((c) => c.classList.remove('active'));
      colorEl.classList.add('active');
      whiteboardEngine.setColor(colorEl.dataset.color);
    }
  });

  document.getElementById('wb-strokes').addEventListener('click', (e) => {
    const strokeEl = e.target.closest('.wb-stroke');
    if (strokeEl && whiteboardEngine) {
      document.querySelectorAll('.wb-stroke').forEach((s) => s.classList.remove('active'));
      strokeEl.classList.add('active');
      whiteboardEngine.setLineWidth(parseInt(strokeEl.dataset.width));
    }
  });

  document.getElementById('wb-undo').addEventListener('click', () => {
    if (whiteboardEngine) whiteboardEngine.undo();
  });

  document.getElementById('wb-clear').addEventListener('click', () => {
    if (whiteboardEngine) whiteboardEngine.clear();
  });

  document.getElementById('wb-export').addEventListener('click', () => {
    if (whiteboardEngine) {
      const dataUrl = whiteboardEngine.exportPNG();
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `whiteboard-${roomId}.png`;
      a.click();
    }
  });

  // Leave room
  document.getElementById('leave-btn').addEventListener('click', () => {
    navigateTo('/dashboard');
  });

  // Back button
  document.getElementById('back-btn').addEventListener('click', () => {
    navigateTo('/dashboard');
  });

  // Copy room ID
  document.getElementById('copy-room-id').addEventListener('click', () => {
    navigator.clipboard.writeText(roomId).then(() => {
      showToast('Room ID copied!', 'success');
    });
  });

  // Panel toggles
  document.getElementById('toggle-chat').addEventListener('click', () => togglePanel('chat'));
  document.getElementById('toggle-participants').addEventListener('click', () => togglePanel('participants'));
  document.getElementById('toggle-files').addEventListener('click', () => togglePanel('files'));
  document.getElementById('close-panel').addEventListener('click', () => togglePanel(null));

  // Chat
  document.getElementById('send-chat').addEventListener('click', () => sendChat(roomId, socket));
  document.getElementById('chat-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') sendChat(roomId, socket);
  });

  // File upload
  document.getElementById('file-upload-area').addEventListener('click', () => {
    document.getElementById('file-input').click();
  });

  document.getElementById('file-upload-area').addEventListener('dragover', (e) => {
    e.preventDefault();
    e.currentTarget.classList.add('dragover');
  });

  document.getElementById('file-upload-area').addEventListener('dragleave', (e) => {
    e.currentTarget.classList.remove('dragover');
  });

  document.getElementById('file-upload-area').addEventListener('drop', (e) => {
    e.preventDefault();
    e.currentTarget.classList.remove('dragover');
    if (e.dataTransfer.files.length > 0) {
      uploadFiles(e.dataTransfer.files, roomId, socket);
    }
  });

  document.getElementById('file-input').addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      uploadFiles(e.target.files, roomId, socket);
    }
  });
}

function togglePanel(panel) {
  const sidePanel = document.getElementById('side-panel');
  const chatPanel = document.getElementById('chat-panel');
  const chatInput = document.getElementById('chat-input-area');
  const participantsPanel = document.getElementById('participants-panel');
  const filesPanel = document.getElementById('files-panel');
  const title = document.getElementById('panel-title');
  const roomPage = document.querySelector('.room-page');

  if (currentPanel === panel || panel === null) {
    if (window.innerWidth <= 768) {
      sidePanel.classList.remove('open');
      if (roomPage) roomPage.classList.remove('panel-open');
      setTimeout(() => {
        if (currentPanel === null) sidePanel.style.display = 'none';
      }, 300);
    } else {
      sidePanel.style.display = 'none';
    }
    currentPanel = null;
    return;
  }

  currentPanel = panel;
  sidePanel.style.display = 'flex';
  
  if (window.innerWidth <= 768) {
    setTimeout(() => {
      sidePanel.classList.add('open');
      if (roomPage) roomPage.classList.add('panel-open');
    }, 10);
  }

  chatPanel.style.display = 'none';
  chatInput.style.display = 'none';
  participantsPanel.style.display = 'none';
  filesPanel.style.display = 'none';

  if (panel === 'chat') {
    title.textContent = 'Chat';
    chatPanel.style.display = 'flex';
    chatInput.style.display = 'block';
    // Scroll to bottom
    setTimeout(() => {
      const msgs = document.getElementById('chat-messages');
      msgs.scrollTop = msgs.scrollHeight;
    }, 50);
  } else if (panel === 'participants') {
    title.textContent = 'Participants';
    participantsPanel.style.display = 'block';
  } else if (panel === 'files') {
    title.textContent = 'Files';
    filesPanel.style.display = 'block';
  }
}

async function sendChat(roomId, socket) {
  const input = document.getElementById('chat-input');
  const text = input.value.trim();
  if (!text) return;

  try {
    const encrypted = await encryptMessage(text);
    socket.emit('chat-message', { roomId, message: encrypted, encrypted: true });
    input.value = '';
  } catch (err) {
    console.error('[Chat] Encryption failed:', err);
    socket.emit('chat-message', { roomId, message: text, encrypted: false });
    input.value = '';
  }
}

function appendChatMessage(msg) {
  const container = document.getElementById('chat-messages');
  if (!container) return;

  const time = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const avatarColor = msg.from?.avatar?.color || 'var(--bg-tertiary)';
  const initials = msg.from?.avatar?.initials || msg.from?.username?.slice(0, 2).toUpperCase() || '??';

  const msgEl = document.createElement('div');
  msgEl.className = 'chat-msg';
  msgEl.innerHTML = `
    <div class="avatar avatar-sm" style="background:${avatarColor}">${initials}</div>
    <div class="chat-msg-content">
      <div class="chat-msg-header">
        <span class="chat-msg-name">${escapeHtml(msg.from?.username || 'Unknown')}</span>
        <span class="chat-msg-time">${time}</span>
      </div>
      <div class="chat-msg-text">${escapeHtml(msg.decryptedText || msg.message)}</div>
      ${msg.encrypted ? '<div class="chat-msg-encrypted"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg> Encrypted</div>' : ''}
    </div>
  `;
  container.appendChild(msgEl);
  container.scrollTop = container.scrollHeight;
}

function updateParticipantsList(participants) {
  const container = document.getElementById('participants-list');
  if (!container) return;

  container.innerHTML = participants.map((p) => {
    const color = p.avatar?.color || 'var(--bg-tertiary)';
    const initials = p.avatar?.initials || p.username?.slice(0, 2).toUpperCase() || '??';
    return `
      <div class="participant-item">
        <div class="avatar avatar-md" style="background:${color}">${initials}</div>
        <div class="participant-info">
          <h5>${escapeHtml(p.username)}</h5>
          <p>Connected</p>
        </div>
        <div class="participant-status"></div>
      </div>
    `;
  }).join('');
}

function addRemoteVideo(socketId, stream) {
  const grid = document.getElementById('video-grid');
  if (!grid) return;

  // Check if tile already exists
  let tile = grid.querySelector(`.video-tile[data-socket-id="${socketId}"]`);
  if (tile) {
    const video = tile.querySelector('video');
    if (video) video.srcObject = stream;
    return;
  }

  tile = document.createElement('div');
  tile.className = 'video-tile';
  tile.dataset.socketId = socketId;
  tile.innerHTML = `
    <video autoplay playsinline></video>
    <div class="video-tile-overlay">
      <span class="video-tile-name">Participant</span>
    </div>
  `;

  const video = tile.querySelector('video');
  video.srcObject = stream;
  grid.appendChild(tile);
  
  // Make remote video pinned by default when they join
  document.querySelectorAll('.video-tile').forEach(t => t.classList.remove('pinned'));
  tile.classList.add('pinned');
  
  // Add click to pin
  tile.addEventListener('click', () => {
    document.querySelectorAll('.video-tile').forEach(t => t.classList.remove('pinned'));
    tile.classList.add('pinned');
  });

  updateVideoGridLayout();
}

function removeRemoteVideo(socketId) {
  const tile = document.querySelector(`.video-tile[data-socket-id="${socketId}"]`);
  if (tile) {
    const video = tile.querySelector('video');
    if (video) video.srcObject = null;
    tile.remove();
    updateVideoGridLayout();
  }
}

function updateVideoGridLayout() {
  const grid = document.getElementById('video-grid');
  if (!grid) return;
  const count = grid.children.length;
  grid.dataset.count = Math.min(count, 6);
}

async function uploadFiles(files, roomId, socket) {
  for (const file of files) {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('roomId', roomId);

      const result = await api.uploadFile(formData);
      socket.emit('file-shared', { roomId, fileMeta: result });
      appendFileItem(result);
      showToast(`Uploaded: ${file.name}`, 'success');
    } catch (err) {
      showToast(`Upload failed: ${err.message}`, 'error');
    }
  }
}

function renderFileList(files) {
  const container = document.getElementById('file-list');
  if (!container) return;
  container.innerHTML = '';
  files.forEach((f) => appendFileItem(f));
}

function appendFileItem(fileMeta) {
  const container = document.getElementById('file-list');
  if (!container) return;

  const ext = fileMeta.originalName.split('.').pop().toLowerCase();
  const iconMap = {
    pdf: '#E8604C', doc: '#3B82F6', docx: '#3B82F6', xls: '#1EA896', xlsx: '#1EA896',
    png: '#F59E0B', jpg: '#F59E0B', jpeg: '#F59E0B', gif: '#F59E0B',
    zip: '#5B4FD6', rar: '#5B4FD6', mp4: '#EC4899', mp3: '#8B5CF6',
  };
  const color = iconMap[ext] || '#5A5A72';
  const size = formatFileSize(fileMeta.size);

  const item = document.createElement('div');
  item.className = 'file-item';
  item.style.cursor = 'pointer';
  item.innerHTML = `
    <div class="file-icon" style="color:${color}">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/>
        <polyline points="13 2 13 9 20 9"/>
      </svg>
    </div>
    <div class="file-info">
      <h5>${escapeHtml(fileMeta.originalName)}</h5>
      <p>${size} &middot; ${fileMeta.uploadedBy?.username || 'Unknown'}</p>
    </div>
    <button class="btn btn-ghost btn-sm" title="Download">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
    </button>
  `;

  item.addEventListener('click', () => {
    window.open(`/api/files/${fileMeta.id}`, '_blank');
  });

  container.appendChild(item);
}

function openWhiteboard(roomId) {
  const overlay = document.getElementById('whiteboard-overlay');
  overlay.style.display = 'flex';

  // Update room ID in info bar
  const info = overlay.querySelector('.whiteboard-info');
  if (info) {
    info.innerHTML = `<span>Collaborative Mode</span><span>|</span><span>Room: ${roomId}</span>`;
  }

  const canvas = document.getElementById('whiteboard-canvas');
  if (!whiteboardEngine) {
    whiteboardEngine = new WhiteboardEngine(canvas, roomId);
  } else {
    whiteboardEngine.resize();
  }
}

function closeWhiteboard() {
  document.getElementById('whiteboard-overlay').style.display = 'none';
}

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
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
