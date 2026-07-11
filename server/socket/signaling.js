import Room from '../models/Room.js';

export function setupSignaling(io) {
  const roomUsers = new Map(); // roomId -> Map(socketId -> userInfo)

  io.on('connection', (socket) => {
    console.log(`[+] User connected: ${socket.user.username} (${socket.id})`);

    // Join room
    socket.on('join-room', async ({ roomId }) => {
      try {
        const room = await Room.findOne({ id: roomId });
        if (!room) {
          socket.emit('error-msg', { message: 'Room not found' });
          return;
        }

      const userInfo = getSocketUser(socket);

      // If user is the host, join immediately
      if (room.host.id === socket.user.id) {
        joinUserToRoom(socket, room, userInfo, roomUsers, io);
      } else {
        // Not host: check if host is in the room
        const isHostPresent = room.participants && room.participants.some(p => p.userId === room.host.id);

        socket.pendingRoomId = roomId;
        socket.pendingUserInfo = userInfo;

        if (isHostPresent) {
          socket.emit('waiting-for-host');
          // Notify the host (and others) in the room
          socket.to(roomId).emit('join-request', userInfo);
        } else {
          // Host is not present yet
          socket.emit('host-not-present');
        }
      }
      } catch (err) {
        console.error('Socket join-room error:', err);
      }
    });

    // Host admits user
    socket.on('admit-user', async ({ socketId }) => {
      try {
        const targetSocket = io.sockets.sockets.get(socketId);
        if (targetSocket && targetSocket.pendingRoomId) {
          const room = await Room.findOne({ id: targetSocket.pendingRoomId });
          if (room) {
            joinUserToRoom(targetSocket, room, targetSocket.pendingUserInfo, roomUsers, io);
            targetSocket.pendingRoomId = null;
            targetSocket.pendingUserInfo = null;
          }
        }
      } catch (err) {
        console.error('Socket admit-user error:', err);
      }
    });

    // Host denies user
    socket.on('deny-user', ({ socketId }) => {
      const targetSocket = io.sockets.sockets.get(socketId);
      if (targetSocket) {
        targetSocket.emit('join-denied');
        targetSocket.pendingRoomId = null;
        targetSocket.pendingUserInfo = null;
      }
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

function joinUserToRoom(socket, room, userInfo, roomUsers, io) {
  const roomId = room.id;
  socket.join(roomId);
  socket.roomId = roomId;

  // Track user in room
  if (!roomUsers.has(roomId)) {
    roomUsers.set(roomId, new Map());
  }

  roomUsers.get(roomId).set(socket.id, userInfo);

  // Update room participants in memory and DB
  const participants = Array.from(roomUsers.get(roomId).values());
  Room.findOneAndUpdate(
    { id: roomId },
    { $set: { participants: participants } }
  ).catch(err => console.error('Error updating participants:', err));

  // Notify existing users about new peer
  socket.to(roomId).emit('user-joined', userInfo);

  // Send existing users to the new peer
  const existingUsers = Array.from(roomUsers.get(roomId).values()).filter(
    (u) => u.socketId !== socket.id
  );
  socket.emit('existing-users', { users: existingUsers, iceServers: getIceServers() });

  // Broadcast updated participant list
  io.to(roomId).emit('participants-updated', room.participants);

  // If the host just joined, convert waiting users into join requests
  if (userInfo.userId === room.host.id) {
    io.sockets.sockets.forEach(s => {
      if (s.pendingRoomId === roomId && s.pendingUserInfo) {
        s.emit('waiting-for-host');
        socket.emit('join-request', s.pendingUserInfo);
      }
    });
  }

  console.log(`[+] ${socket.user.username} joined room ${roomId} (${room.participants.length} users)`);
}

function handleDisconnect(socket, roomUsers, io) {
  const roomId = socket.roomId;
  if (!roomId) return;

  // Remove from room users
  if (roomUsers.has(roomId)) {
    roomUsers.get(roomId).delete(socket.id);

    // Update room participants in DB
    Room.findOne({ id: roomId }).then(room => {
      if (room) {
        const participants = Array.from(roomUsers.get(roomId).values());
        room.participants = participants;
        room.save().catch(err => console.error('Error saving participants:', err));
        io.to(roomId).emit('participants-updated', participants);
      }
    }).catch(err => console.error('Error finding room on disconnect:', err));

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
