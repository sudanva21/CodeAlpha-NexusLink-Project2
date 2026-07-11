// WebRTC Peer Connection Manager - Mesh topology
import { getSocket } from './socket.js';

const peers = new Map(); // socketId -> { pc, streams }
let localStream = null;
let screenStream = null;
let onRemoteStreamCallback = null;
let onRemoteStreamRemovedCallback = null;
let onScreenShareCallback = null;

const ICE_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

export function setCallbacks({ onRemoteStream, onRemoteStreamRemoved, onScreenShare }) {
  onRemoteStreamCallback = onRemoteStream;
  onRemoteStreamRemovedCallback = onRemoteStreamRemoved;
  onScreenShareCallback = onScreenShare;
}

let currentFacingMode = 'user';

// Get local media
export async function getLocalStream(video = true, audio = true) {
  try {
    localStream = await navigator.mediaDevices.getUserMedia({
      video: video ? { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: currentFacingMode } : false,
      audio: audio ? { echoCancellation: true, noiseSuppression: true, autoGainControl: true } : false,
    });
    return localStream;
  } catch (err) {
    console.error('[WebRTC] Failed to get local stream:', err);
    // Try audio only
    if (video) {
      try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
        return localStream;
      } catch (audioErr) {
        console.error('[WebRTC] Failed to get audio stream:', audioErr);
      }
    }
    return null;
  }
}

export function getLocalStreamRef() {
  return localStream;
}

// Toggle mic
export function toggleMic() {
  if (!localStream) return false;
  const audioTrack = localStream.getAudioTracks()[0];
  if (audioTrack) {
    audioTrack.enabled = !audioTrack.enabled;
    return audioTrack.enabled;
  }
  return false;
}

// Toggle camera
export function toggleCamera() {
  if (!localStream) return false;
  const videoTrack = localStream.getVideoTracks()[0];
  if (videoTrack) {
    videoTrack.enabled = !videoTrack.enabled;
    return videoTrack.enabled;
  }
  return false;
}

// Flip Camera
export async function flipCamera() {
  if (!localStream || screenStream) return false;
  
  const videoTrack = localStream.getVideoTracks()[0];
  if (!videoTrack) return false;

  currentFacingMode = currentFacingMode === 'user' ? 'environment' : 'user';

  try {
    const newStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: currentFacingMode },
    });
    
    const newVideoTrack = newStream.getVideoTracks()[0];
    
    // Replace track in all peer connections
    for (const [, peer] of peers) {
      const sender = peer.pc.getSenders().find((s) => s.track && s.track.kind === 'video');
      if (sender) {
        await sender.replaceTrack(newVideoTrack);
      }
    }
    
    // Replace track in localStream
    localStream.removeTrack(videoTrack);
    localStream.addTrack(newVideoTrack);
    videoTrack.stop();
    
    // Need to trigger a visual update if local video element is bound to this stream
    // but the stream reference hasn't changed, only the track. Usually the video element
    // automatically updates when tracks change within the stream.
    
    return true;
  } catch (err) {
    console.error('Failed to flip camera:', err);
    currentFacingMode = currentFacingMode === 'user' ? 'environment' : 'user';
    return false;
  }
}

// Screen share
export async function startScreenShare() {
  try {
    screenStream = await navigator.mediaDevices.getDisplayMedia({
      video: { cursor: 'always' },
      audio: false,
    });

    const screenTrack = screenStream.getVideoTracks()[0];

    // Add screen track to all peer connections (triggers renegotiation)
    for (const [, peer] of peers) {
      const sender = peer.pc.addTrack(screenTrack, screenStream);
      peer.screenSender = sender;
    }

    // Handle screen share stop from browser UI
    screenTrack.onended = () => {
      stopScreenShare();
    };

    const socket = getSocket();
    if (socket) socket.emit('screen-share-started');

    return screenStream;
  } catch (err) {
    console.error('[WebRTC] Screen share failed:', err);
    return null;
  }
}

export async function stopScreenShare() {
  if (!screenStream) return;

  screenStream.getTracks().forEach((t) => t.stop());
  screenStream = null;

  // Remove screen track from all peer connections
  for (const [, peer] of peers) {
    if (peer.screenSender) {
      peer.pc.removeTrack(peer.screenSender);
      peer.screenSender = null;
    }
  }

  const socket = getSocket();
  if (socket) socket.emit('screen-share-stopped');
}

export function isScreenSharing() {
  return screenStream !== null;
}

// Create peer connection
function createPeerConnection(remoteSocketId) {
  const pc = new RTCPeerConnection(ICE_CONFIG);

  // Add local tracks
  if (localStream) {
    localStream.getTracks().forEach((track) => {
      pc.addTrack(track, localStream);
    });
  }

  if (screenStream) {
    screenStream.getTracks().forEach((track) => {
      const sender = pc.addTrack(track, screenStream);
      if (peers.has(remoteSocketId)) {
        peers.get(remoteSocketId).screenSender = sender;
      }
    });
  }

  // Handle renegotiation
  pc.onnegotiationneeded = async () => {
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      const socket = getSocket();
      if (socket) socket.emit('offer', { to: remoteSocketId, offer });
    } catch (err) {
      console.error('[WebRTC] Renegotiation error:', err);
    }
  };

  // Handle ICE candidates
  pc.onicecandidate = (event) => {
    if (event.candidate) {
      const socket = getSocket();
      socket.emit('ice-candidate', {
        to: remoteSocketId,
        candidate: event.candidate,
      });
    }
  };

  // Handle remote tracks
  pc.ontrack = (event) => {
    const remoteStream = event.streams[0];
    if (onRemoteStreamCallback) {
      onRemoteStreamCallback(remoteSocketId, remoteStream);
    }
  };

  pc.oniceconnectionstatechange = () => {
    if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') {
      removePeer(remoteSocketId);
    }
  };

  peers.set(remoteSocketId, { pc, streams: [] });
  return pc;
}

// Initiate call (create offer)
export async function callPeer(remoteSocketId) {
  const pc = createPeerConnection(remoteSocketId);
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);

  const socket = getSocket();
  socket.emit('offer', { to: remoteSocketId, offer });
}

// Handle incoming offer
export async function handleOffer(from, offer) {
  let pc;
  if (peers.has(from)) {
    pc = peers.get(from).pc;
  } else {
    pc = createPeerConnection(from);
  }

  try {
    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    const socket = getSocket();
    socket.emit('answer', { to: from, answer });
  } catch (err) {
    console.error('[WebRTC] Handle offer error:', err);
  }
}

// Handle incoming answer
export async function handleAnswer(from, answer) {
  const peer = peers.get(from);
  if (peer) {
    await peer.pc.setRemoteDescription(new RTCSessionDescription(answer));
  }
}

// Handle ICE candidate
export async function handleIceCandidate(from, candidate) {
  const peer = peers.get(from);
  if (peer) {
    try {
      await peer.pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (err) {
      console.error('[WebRTC] Failed to add ICE candidate:', err);
    }
  }
}

// Remove peer
export function removePeer(socketId) {
  const peer = peers.get(socketId);
  if (peer) {
    peer.pc.close();
    peers.delete(socketId);
    if (onRemoteStreamRemovedCallback) {
      onRemoteStreamRemovedCallback(socketId);
    }
  }
}

// Cleanup all
export function cleanupWebRTC() {
  for (const [id, peer] of peers) {
    peer.pc.close();
  }
  peers.clear();

  if (localStream) {
    localStream.getTracks().forEach((t) => t.stop());
    localStream = null;
  }

  if (screenStream) {
    screenStream.getTracks().forEach((t) => t.stop());
    screenStream = null;
  }
}

export function getPeers() {
  return peers;
}
