export function setupWhiteboard(io) {
  // Room whiteboard state: roomId -> array of strokes
  const whiteboardState = new Map();

  io.on('connection', (socket) => {
    // Join whiteboard for a room
    socket.on('whiteboard-join', ({ roomId }) => {
      // Send existing strokes to new joiner
      const strokes = whiteboardState.get(roomId) || [];
      socket.emit('whiteboard-state', { strokes });
    });

    // Draw stroke
    socket.on('whiteboard-draw', ({ roomId, stroke }) => {
      if (!whiteboardState.has(roomId)) {
        whiteboardState.set(roomId, []);
      }
      whiteboardState.get(roomId).push(stroke);

      // Broadcast to others in room
      socket.to(roomId).emit('whiteboard-draw', {
        stroke,
        user: socket.user.username,
      });
    });

    // Erase
    socket.on('whiteboard-erase', ({ roomId, eraseData }) => {
      // Remove strokes that intersect with eraser
      if (whiteboardState.has(roomId)) {
        const strokes = whiteboardState.get(roomId);
        // Filter out erased strokes by ID
        const filtered = strokes.filter((s) => !eraseData.strokeIds.includes(s.id));
        whiteboardState.set(roomId, filtered);
      }

      socket.to(roomId).emit('whiteboard-erase', { eraseData });
    });

    // Clear whiteboard
    socket.on('whiteboard-clear', ({ roomId }) => {
      whiteboardState.set(roomId, []);
      socket.to(roomId).emit('whiteboard-clear', {});
    });

    // Undo last stroke
    socket.on('whiteboard-undo', ({ roomId }) => {
      if (whiteboardState.has(roomId)) {
        const strokes = whiteboardState.get(roomId);
        strokes.pop();
      }
      socket.to(roomId).emit('whiteboard-undo', {});
    });
  });
}
