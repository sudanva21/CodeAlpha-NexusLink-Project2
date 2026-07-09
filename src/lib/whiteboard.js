// Collaborative Whiteboard Engine
import { getSocket } from './socket.js';

export class WhiteboardEngine {
  constructor(canvas, roomId) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.roomId = roomId;
    this.isDrawing = false;
    this.tool = 'pen'; // pen, eraser, rect, circle, line
    this.color = '#1A1A2E';
    this.lineWidth = 3;
    this.strokes = [];
    this.currentStroke = null;
    this.undoStack = [];

    this.resize();
    this.setupEvents();
    this.setupSocket();
  }

  resize() {
    const parent = this.canvas.parentElement;
    const rect = parent.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    // Leave some padding
    const w = rect.width - 40;
    const h = rect.height - 40;

    this.canvas.width = w * dpr;
    this.canvas.height = h * dpr;
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';

    this.ctx.scale(dpr, dpr);
    this.redraw();
  }

  setupEvents() {
    this.canvas.addEventListener('pointerdown', (e) => this.onPointerDown(e));
    this.canvas.addEventListener('pointermove', (e) => this.onPointerMove(e));
    this.canvas.addEventListener('pointerup', (e) => this.onPointerUp(e));
    this.canvas.addEventListener('pointerleave', (e) => this.onPointerUp(e));

    window.addEventListener('resize', () => this.resize());
  }

  setupSocket() {
    const socket = getSocket();
    if (!socket) return;

    socket.emit('whiteboard-join', { roomId: this.roomId });

    socket.on('whiteboard-state', ({ strokes }) => {
      this.strokes = strokes || [];
      this.redraw();
    });

    socket.on('whiteboard-draw', ({ stroke }) => {
      this.strokes.push(stroke);
      this.drawStroke(stroke);
    });

    socket.on('whiteboard-clear', () => {
      this.strokes = [];
      this.redraw();
    });

    socket.on('whiteboard-undo', () => {
      this.strokes.pop();
      this.redraw();
    });

    socket.on('whiteboard-erase', ({ eraseData }) => {
      this.strokes = this.strokes.filter((s) => !eraseData.strokeIds.includes(s.id));
      this.redraw();
    });
  }

  getPos(e) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  }

  onPointerDown(e) {
    this.isDrawing = true;
    const pos = this.getPos(e);

    if (this.tool === 'eraser') {
      this.eraseAt(pos);
      return;
    }

    this.currentStroke = {
      id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
      tool: this.tool,
      color: this.color,
      lineWidth: this.lineWidth,
      points: [pos],
    };
  }

  onPointerMove(e) {
    if (!this.isDrawing) return;
    const pos = this.getPos(e);

    if (this.tool === 'eraser') {
      this.eraseAt(pos);
      return;
    }

    if (this.currentStroke) {
      this.currentStroke.points.push(pos);

      // Live preview
      this.redraw();
      this.drawStroke(this.currentStroke);
    }
  }

  onPointerUp(e) {
    if (!this.isDrawing) return;
    this.isDrawing = false;

    if (this.currentStroke && this.currentStroke.points.length > 1) {
      this.strokes.push(this.currentStroke);

      // Send to socket
      const socket = getSocket();
      if (socket) {
        socket.emit('whiteboard-draw', {
          roomId: this.roomId,
          stroke: this.currentStroke,
        });
      }
    }

    this.currentStroke = null;
    this.redraw();
  }

  eraseAt(pos) {
    const eraseRadius = 20;
    const toRemove = [];

    for (const stroke of this.strokes) {
      for (const point of stroke.points) {
        const dist = Math.sqrt((point.x - pos.x) ** 2 + (point.y - pos.y) ** 2);
        if (dist < eraseRadius) {
          toRemove.push(stroke.id);
          break;
        }
      }
    }

    if (toRemove.length > 0) {
      this.strokes = this.strokes.filter((s) => !toRemove.includes(s.id));
      this.redraw();

      const socket = getSocket();
      if (socket) {
        socket.emit('whiteboard-erase', {
          roomId: this.roomId,
          eraseData: { strokeIds: toRemove },
        });
      }
    }
  }

  drawStroke(stroke) {
    const { ctx } = this;
    const { points, color, lineWidth, tool } = stroke;

    if (points.length < 2) return;

    ctx.save();
    ctx.strokeStyle = tool === 'eraser' ? '#FFFFFF' : color;
    ctx.lineWidth = tool === 'eraser' ? lineWidth * 3 : lineWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalCompositeOperation = tool === 'eraser' ? 'destination-out' : 'source-over';

    if (tool === 'rect' && points.length >= 2) {
      const start = points[0];
      const end = points[points.length - 1];
      ctx.beginPath();
      ctx.rect(start.x, start.y, end.x - start.x, end.y - start.y);
      ctx.stroke();
    } else if (tool === 'circle' && points.length >= 2) {
      const start = points[0];
      const end = points[points.length - 1];
      const rx = Math.abs(end.x - start.x) / 2;
      const ry = Math.abs(end.y - start.y) / 2;
      const cx = Math.min(start.x, end.x) + rx;
      const cy = Math.min(start.y, end.y) + ry;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      ctx.stroke();
    } else if (tool === 'line' && points.length >= 2) {
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
      ctx.stroke();
    } else {
      // Freehand with smoothing
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);

      for (let i = 1; i < points.length - 1; i++) {
        const midX = (points[i].x + points[i + 1].x) / 2;
        const midY = (points[i].y + points[i + 1].y) / 2;
        ctx.quadraticCurveTo(points[i].x, points[i].y, midX, midY);
      }

      if (points.length > 1) {
        const last = points[points.length - 1];
        ctx.lineTo(last.x, last.y);
      }

      ctx.stroke();
    }

    ctx.restore();
  }

  redraw() {
    const { ctx, canvas } = this;
    const dpr = window.devicePixelRatio || 1;
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);

    // Draw white background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width / dpr, canvas.height / dpr);

    // Draw all strokes
    for (const stroke of this.strokes) {
      this.drawStroke(stroke);
    }
  }

  setTool(tool) {
    this.tool = tool;
  }

  setColor(color) {
    this.color = color;
  }

  setLineWidth(width) {
    this.lineWidth = width;
  }

  clear() {
    this.strokes = [];
    this.redraw();
    const socket = getSocket();
    if (socket) socket.emit('whiteboard-clear', { roomId: this.roomId });
  }

  undo() {
    if (this.strokes.length > 0) {
      this.strokes.pop();
      this.redraw();
      const socket = getSocket();
      if (socket) socket.emit('whiteboard-undo', { roomId: this.roomId });
    }
  }

  exportPNG() {
    return this.canvas.toDataURL('image/png');
  }

  destroy() {
    const socket = getSocket();
    if (socket) {
      socket.off('whiteboard-state');
      socket.off('whiteboard-draw');
      socket.off('whiteboard-clear');
      socket.off('whiteboard-undo');
      socket.off('whiteboard-erase');
    }
  }
}
