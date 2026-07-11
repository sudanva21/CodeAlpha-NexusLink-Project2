import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { authenticateToken } from '../middleware/auth.js';
import Room from '../models/Room.js';
import Message from '../models/Message.js';

const router = Router();

// Create room
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { name } = req.body;
    const roomId = uuidv4().split('-')[0];
    
    const room = await Room.create({
      id: roomId,
      name: name || `${req.user.username}'s Room`,
      host: { id: req.user.id, username: req.user.username, avatar: req.user.avatar },
    });
    
    console.log(`[DB] Room created successfully: ${room.name} (${roomId})`);
    res.status(201).json(room);
  } catch (err) {
    console.error('[DB Error] Create room error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get room
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const room = await Room.findOne({ id: req.params.id });
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }
    res.json(room);
  } catch (err) {
    console.error('[DB Error] Get room error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get room messages
router.get('/:id/messages', authenticateToken, async (req, res) => {
  try {
    const messages = await Message.find({ roomId: req.params.id }).sort({ timestamp: 1 });
    res.json(messages);
  } catch (err) {
    console.error('[DB Error] Get room messages error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// List rooms
router.get('/', authenticateToken, async (req, res) => {
  try {
    const roomList = await Room.find({ 'host.id': req.user.id })
      .select('id name host participants createdAt')
      .sort({ createdAt: -1 });
      
    // Format to match the previous structure
    const formattedList = roomList.map((r) => ({
      id: r.id,
      name: r.name,
      host: r.host,
      participantCount: r.participants.length,
      createdAt: r.createdAt,
    }));
    
    res.json(formattedList);
  } catch (err) {
    console.error('[DB Error] List rooms error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete room
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const room = await Room.findOne({ id: req.params.id });
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }
    if (room.host.id !== req.user.id) {
      return res.status(403).json({ error: 'Only the host can delete the room' });
    }
    await Room.deleteOne({ id: req.params.id });
    console.log(`[DB] Room deleted successfully: ${req.params.id}`);
    res.json({ message: 'Room deleted' });
  } catch (err) {
    console.error('[DB Error] Delete room error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
