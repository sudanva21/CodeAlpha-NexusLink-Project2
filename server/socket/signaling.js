import { rooms } from '../routes/rooms.js';

export function setupSignaling(io) {
  const roomUsers = new Map(); // roomId -> Map(socketId -> userInfo)

  io.on('connection', (socket) => {
    console.log(`[+] User connected: ${socket.user.username} (${socket.id})`);

    // Join room
    socket.on('join-room', ({ roomId }) => {
      const room = rooms.get(roomId);
      if (!room) {
        socket.emit('error-msg', { message: 'Room not found' });
        return;
      }

      socket.join(roomId);
      socket.roomId = roomId;

      // Track user in room
      if (!roomUsers.has(roomId)) {
        roomUsers.set(roomId, new Map());
      }

      const userInfo = {
        socketId: socket.id,
        userId: socket.user.id,
        username: socket.user.username,
        avatar: socket.user.avatar,
      };

      roomUsers.get(roomId).set(socket.id, userInfo);

      // Update room participants
      room.participants = Array.from(roomUsers.get(roomId).values());

      // Notify existing users about new peer
      socket.to(roomId).emit('user-joined', userInfo);

      // Send existing users to the new peer
      const existingUsers = Array.from(roomUsers.get(roomId).values()).filter(
        (u) => u.socketId !== socket.id
      );
      socket.emit('existing-users', { users: existingUsers, iceServers: getIceServers() });

      // Broadcast updated participant list
      io.to(roomId).emit('participants-updated', room.participants);

      console.log(`[+] ${socket.user.username} joined room ${roomId} (${room.participants.length} users)`);
    });

    // WebRTC signaling: offer
    socket.on('offer', ({ to, offer }) => {
      io.to(to).emit('offer', { from: socket.id, offer, user: getSocketUser(socket) });
    });

    // WebRTC signaling: answer
    socket.on('answer', ({ to, answer }) => {
      io.to(to).emit('answer', { from: socket.id, answer });
    });

    // WebRTC signaling: ICE candidate
    socket.on('ice-candidate', ({ to, candidate }) => {
      io.to(to).emit('ice-candidate', { from: socket.id, candidate });
    });

    // Screen share started
    socket.on('screen-share-started', () => {
      if (socket.roomId) {
        socket.to(socket.roomId).emit('user-screen-sharing', {
          socketId: socket.id,
          username: socket.user.username,
          sharing: true,
        });
      }
    });

    // Screen share stopped
    socket.on('screen-share-stopped', () => {
      if (socket.roomId) {
        socket.to(socket.roomId).emit('user-screen-sharing', {
          socketId: socket.id,
          username: socket.user.username,
          sharing: false,
        });
      }
    });

    // Chat message
    socket.on('chat-message', ({ roomId, message, encrypted }) => {
      io.to(roomId).emit('chat-message', {
        id: Date.now().toString(36) + Math.random().toString(36).substr(2),
        from: getSocketUser(socket),
        message,
        encrypted,
        timestamp: new Date().toISOString(),
      });
    });

    // File shared notification
    socket.on('file-shared', ({ roomId, fileMeta }) => {
      socket.to(roomId).emit('file-shared', {
        ...fileMeta,
        sharedBy: getSocketUser(socket),
      });
    });

    // Leave room
    socket.on('leave-room', () => {
      handleDisconnect(socket, roomUsers, io);
    });

    // Disconnect
    socket.on('disconnect', () => {
      handleDisconnect(socket, roomUsers, io);
      console.log(`[-] User disconnected: ${socket.user.username}`);
    });
  });
}

function handleDisconnect(socket, roomUsers, io) {
  const roomId = socket.roomId;
  if (!roomId) return;

  // Remove from room users
  if (roomUsers.has(roomId)) {
    roomUsers.get(roomId).delete(socket.id);

    // Update room participants
    const room = rooms.get(roomId);
    if (room) {
      room.participants = Array.from(roomUsers.get(roomId).values());
      io.to(roomId).emit('participants-updated', room.participants);
    }

    // Clean up empty rooms
    if (roomUsers.get(roomId).size === 0) {
      roomUsers.delete(roomId);
    }
  }

  // Notify others
  socket.to(roomId).emit('user-left', {
    socketId: socket.id,
    username: socket.user.username,
  });

  socket.leave(roomId);
  socket.roomId = null;
}

function getSocketUser(socket) {
  return {
    socketId: socket.id,
    userId: socket.user.id,
    username: socket.user.username,
    avatar: socket.user.avatar,
  };
}

function getIceServers() {
  return [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ];
}
