// database.ts
// Placeholder for future database integration
export const databaseConfig = {
  // If you want to add PostgreSQL/MongoDB later
  enabled: false,
  connectionString: process.env.DATABASE_URL || '',
};

export const initializeDatabase = async () => {
  if (!databaseConfig.enabled) {
    console.log('Database not configured - using in-memory storage');
    return;
  }
  
  // Add database initialization logic here
  console.log('Database initialized');
};

// socket.ts
import { ServerOptions } from 'socket.io';

export const socketConfig: Partial<ServerOptions> = {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true
  },
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000,
  connectTimeout: 45000,
};