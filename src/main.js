// NexusLink — Main Entry Point
import './styles/index.css';
import './styles/whiteboard.css';
import { registerRoute, initRouter } from './lib/router.js';
import { renderLanding } from './pages/landing.js';
import { renderAuth } from './pages/auth.js';
import { renderDashboard } from './pages/dashboard.js';
import { renderRoom } from './pages/room.js';

// Register routes
registerRoute('/', renderLanding);
registerRoute('/auth', renderAuth);
registerRoute('/dashboard', renderDashboard);
registerRoute('/room/:id', renderRoom);

// Initialize router
initRouter();
