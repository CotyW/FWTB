import { Server, Socket } from 'socket.io';
import { RoomManager } from './RoomManager';
import { GameEngine } from './gameEngine/GameEngine';
import { SOCKET_EVENTS } from '../../../shared/constants/socketEvents';
import { logger } from '../utils/logger';
import { SocketContext } from './socket/context';
import { GameFlow } from './socket/GameFlow';
import { registerRoomHandlers } from './socket/roomHandlers';
import { registerGameHandlers } from './socket/gameHandlers';

export class SocketManager {
  private ctx: SocketContext;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(private io: Server) {
    const activeGames = new Map<string, GameEngine>();
    this.ctx = {
      io,
      roomManager: new RoomManager(),
      activeGames,
      playerSockets: new Map(),
      spectators: new Map(),
      actionLocks: new Map(),
      flow: new GameFlow(io, activeGames)
    };
  }

  initialize(): void {
    this.io.on(SOCKET_EVENTS.CONNECTION, (socket: Socket) => {
      logger.info(`Client connected: ${socket.id}`);
      registerRoomHandlers(this.ctx, socket);
      registerGameHandlers(this.ctx, socket);
    });

    this.startCleanupTimer();
  }

  private startCleanupTimer(): void {
    if (this.cleanupInterval) clearInterval(this.cleanupInterval);

    // Cleanup every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.ctx.roomManager.cleanupOldRooms();
      logger.debug('Cleaned up old rooms');
    }, 5 * 60 * 1000);
  }

  shutdown(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    this.io.disconnectSockets();
    logger.info('SocketManager shutdown complete');
  }
}
