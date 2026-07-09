import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

// In-memory room store
const rooms = new Map();

// Create room
router.post('/', authenticateToken, (req, res) => {
  try {
    const { name } = req.body;
    const roomId = uuidv4().split('-')[0];
    const room = {
      id: roomId,
      name: name || `${req.user.username}'s Room`,
      host: { id: req.user.id, username: req.user.username, avatar: req.user.avatar },
      participants: [],
      createdAt: new Date().toISOString(),
      files: [],
    };
    rooms.set(roomId, room);
    res.status(201).json(room);
  } catch (err) {
    console.error('Create room error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get room
router.get('/:id', authenticateToken, (req, res) => {
  const room = rooms.get(req.params.id);
  if (!room) {
    return res.status(404).json({ error: 'Room not found' });
  }
  res.json(room);
});

// List rooms
router.get('/', authenticateToken, (req, res) => {
  const roomList = Array.from(rooms.values()).map((r) => ({
    id: r.id,
    name: r.name,
    host: r.host,
    participantCount: r.participants.length,
    createdAt: r.createdAt,
  }));
  res.json(roomList);
});

// Delete room
router.delete('/:id', authenticateToken, (req, res) => {
  const room = rooms.get(req.params.id);
  if (!room) {
    return res.status(404).json({ error: 'Room not found' });
  }
  if (room.host.id !== req.user.id) {
    return res.status(403).json({ error: 'Only the host can delete the room' });
  }
  rooms.delete(req.params.id);
  res.json({ message: 'Room deleted' });
});

export { rooms };
export default router;
