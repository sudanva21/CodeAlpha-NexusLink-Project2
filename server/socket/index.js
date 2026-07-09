import { setupSignaling } from './signaling.js';
import { setupWhiteboard } from './whiteboard.js';

export function setupSocket(io) {
  setupSignaling(io);
  setupWhiteboard(io);
}
