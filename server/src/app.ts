import express, { Express, Request, Response, NextFunction } from 'express';
import { createServer } from 'http';
import fs from 'fs';
import path from 'path';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { SocketManager } from './services/SocketManager';
import { logger } from './utils/logger';

console.log('Starting poker server...');

dotenv.config();
console.log('Environment loaded');

const app: Express = express();
console.log('Express app created');

const httpServer = createServer(app);
console.log('HTTP server created');

const io = new Server(httpServer, {
  cors: {
    origin: (origin, callback) => {
      // CLIENT_URL may hold several comma-separated origins (e.g. a deployed site)
      const allowedOrigins = [
        'http://localhost:3000',
        'http://localhost:3001',  // Vite may use this if 3000 is taken
        'http://localhost:5173',
        'http://127.0.0.1:3000',
        'http://127.0.0.1:3001',
        'http://127.0.0.1:5173',
        ...(process.env.CLIENT_URL || '').split(',').map(s => s.trim().replace(/\/$/, '')).filter(Boolean),
        // Render sets this to the service's public URL
        ...(process.env.RENDER_EXTERNAL_URL ? [process.env.RENDER_EXTERNAL_URL.replace(/\/$/, '')] : [])
      ];
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: ['GET', 'POST'],
    credentials: true
  },
  transports: ['websocket', 'polling']
});
console.log('Socket.io server created');

// Middleware
app.use(cors());
app.use(express.json());

// Request logging middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  logger.debug(`${req.method} ${req.path}`);
  next();
});

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Server info endpoint
app.get('/api/info', (req: Request, res: Response) => {
  res.json({
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString()
  });
});

// Serve the built client (single-deployment hosting). Skipped in dev when client/dist doesn't exist.
const clientDist = [
  process.env.CLIENT_DIST,
  path.resolve(__dirname, '../../../../client/dist'),
  path.resolve(__dirname, '../../client/dist')
].find((dir): dir is string => !!dir && fs.existsSync(path.join(dir, 'index.html')));

if (clientDist) {
  app.use(express.static(clientDist));
  app.get('*', (req: Request, res: Response) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
  console.log(`Serving client from ${clientDist}`);
}

// Basic error handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  logger.error('Unhandled error', err);
  res.status(500).json({ 
    error: process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : err.message 
  });
});

// Initialize Socket Manager
console.log('Initializing SocketManager...');
let socketManager: SocketManager;
try {
  socketManager = new SocketManager(io);
  socketManager.initialize();
  console.log('SocketManager initialized successfully');
} catch (error) {
  console.error('Failed to initialize SocketManager:', error);
  process.exit(1);
}

const PORT = process.env.PORT || 3001;
const NODE_ENV = process.env.NODE_ENV || 'development';

console.log('About to call listen...');
httpServer.listen(PORT, () => {
  console.log(`🎮 Poker Server started in ${NODE_ENV} mode`);
  console.log(`📡 Listening on port ${PORT}`);
  console.log(`🔗 Socket.io ready for connections`);
  console.log(`🌐 Client URL: ${process.env.CLIENT_URL || 'http://localhost:5173'}`);
  
  logger.info(`🎮 Poker Server started in ${NODE_ENV} mode`);
  logger.info(`📡 Listening on port ${PORT}`);
  logger.info(`🔗 Socket.io ready for connections`);
  logger.info(`🌐 Client URL: ${process.env.CLIENT_URL || 'http://localhost:5173'}`);
  
  console.log('Listen callback finished. Server should be running...');
});

// Graceful Shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received');
  logger.info('SIGTERM signal received: closing HTTP server');
  socketManager.shutdown();
  httpServer.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received');
  logger.info('SIGINT signal received: closing HTTP server');
  socketManager.shutdown();
  httpServer.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  logger.error('Unhandled Rejection:', reason);
});

console.log('Server initialization complete. Process should stay alive...');