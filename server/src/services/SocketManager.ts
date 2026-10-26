import { Server, Socket } from 'socket.io';
import { RoomManager } from './RoomManager';
import { Room } from '../models/Room';
import { GameEngine } from './gameEngine/GameEngine';
import { SOCKET_EVENTS } from '../../../shared/constants/socketEvents';
import { GAME_CONFIG, clampStartingChips, blindsForStack } from '../../../shared/constants/gameConfig';
import { BettingAction, RoomConfig } from '../../../shared/types/game.types';
import { logger } from '../utils/logger';

export class SocketManager {
  private io: Server;
  private roomManager: RoomManager;
  private activeGames: Map<string, GameEngine>;
  private playerSockets: Map<string, string>; // playerId -> socketId mapping
  private actionLocks: Map<string, boolean>; // roomId -> lock flag
  private turnTimers: Map<string, NodeJS.Timeout> = new Map();
  private spectators: Map<string, string> = new Map(); // socketId -> roomId
  private timeoutStreaks: Map<string, number> = new Map(); // playerId -> consecutive turn timeouts
  private cleanupInterval: NodeJS.Timeout | null = null;
  private suitSymbols: Record<string, string> = {
    hearts: '♥',
    diamonds: '♦',
    clubs: '♣',
    spades: '♠'
  };

  constructor(io: Server) {
    this.io = io;
    this.roomManager = new RoomManager();
    this.activeGames = new Map();
    this.playerSockets = new Map();
    this.actionLocks = new Map();
  }

  // Convert server-side game state cards to client-friendly strings
  // Note: Each player only sees their own hole cards, not opponents' cards
  private serializeGameState(gameState: any, currentPlayerId?: string) {
    const formatCard = (card: any) => {
      if (!card) return '';
      const suit = this.suitSymbols[card.suit] || card.suit || '';
      return `${card.rank ?? ''}${suit}`;
    };

    return {
      ...gameState,
      communityCards: (gameState.communityCards || []).map(formatCard),
      players: (gameState.players || []).map((p: any) => ({
        ...p,
        // Only show hole cards if it's the current player's own cards
        // Others see empty array until showdown
        cards: p.id === currentPlayerId ? (p.cards || []).map(formatCard) : []
      }))
    };
  }

  initialize(): void {
    this.io.on(SOCKET_EVENTS.CONNECTION, (socket: Socket) => {
      logger.info(`Client connected: ${socket.id}`);

      this.handleCreateRoom(socket);
      this.handleJoinRoom(socket);
      this.handleLeaveRoom(socket);
      this.handleSpectate(socket);
      this.handleStartGame(socket);
      this.handleUpdateSettings(socket);
      this.handleRebuy(socket);
      this.handleSitIn(socket);
      this.handlePlayerAction(socket);
      this.handlePlayerReady(socket);
      this.handleDisconnect(socket);
    });

    // Start periodic cleanup
    this.startCleanupTimer();
  }

  private startCleanupTimer(): void {
    if (this.cleanupInterval) clearInterval(this.cleanupInterval);
    
    // Cleanup every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.roomManager.cleanupOldRooms();
      logger.debug('Cleaned up old rooms');
    }, 5 * 60 * 1000);
  }

  private handleCreateRoom(socket: Socket): void {
    socket.on(SOCKET_EVENTS.CREATE_ROOM, (data: any) => {
      try {
        const { playerName, buyIn, levelMinutes } = data;
        const startingChips = clampStartingChips(buyIn);
        // Convert frontend format to RoomConfig
        const config: RoomConfig = {
          maxPlayers: GAME_CONFIG.MAX_PLAYERS,
          startingChips,
          ...blindsForStack(startingChips),
          levelMinutes: this.clampLevelMinutes(levelMinutes)
        };
        const room = this.roomManager.createRoom(socket.id, playerName, config);
        
        socket.join(room.id);
        const hostPlayer = room.players[0];
        if (hostPlayer) {
          this.playerSockets.set(hostPlayer.id, socket.id);
        }
        
        socket.emit(SOCKET_EVENTS.ROOM_CREATED, {
          roomId: room.id,
          roomCode: room.code,
          hostId: room.hostId,
          playerId: hostPlayer?.id,
          config: room.config,
          players: room.players.map(p => p.toJSON())
        });

        // Broadcast current room state
        this.io.to(room.id).emit(SOCKET_EVENTS.ROOM_UPDATE, {
          room: room.toJSON()
        });
        
        logger.info(`Room created: ${room.code} by ${playerName}`);
      } catch (error) {
        socket.emit(SOCKET_EVENTS.ROOM_ERROR, { 
          message: error instanceof Error ? error.message : 'Failed to create room' 
        });
      }
    });
  }

  private handleJoinRoom(socket: Socket): void {
    socket.on(SOCKET_EVENTS.JOIN_ROOM, (data: { roomCode: string; playerName: string }) => {
      try {
        const { roomCode, playerName } = data;
        const room = this.roomManager.joinRoom(roomCode, socket.id, playerName);
        
        socket.join(room.id);
        const joinedPlayer = room.players[room.players.length - 1];
        if (joinedPlayer) {
          this.playerSockets.set(joinedPlayer.id, socket.id);
        }
        
        // Notify the joining player
        socket.emit(SOCKET_EVENTS.ROOM_JOINED, {
          roomId: room.id,
          roomCode: room.code,
          hostId: room.hostId,
          playerId: joinedPlayer?.id,
          config: room.config,
          players: room.players.map(p => p.toJSON())
        });
        
        // Notify other players in the room
        socket.to(room.id).emit(SOCKET_EVENTS.PLAYER_JOINED, {
          player: joinedPlayer?.toJSON(),
          totalPlayers: room.players.length
        });

        // Broadcast full room state to everyone
        this.io.to(room.id).emit(SOCKET_EVENTS.ROOM_UPDATE, {
          room: room.toJSON()
        });
        
        logger.info(`${playerName} joined room: ${room.code}`);
      } catch (error) {
        socket.emit(SOCKET_EVENTS.ROOM_ERROR, { 
          message: error instanceof Error ? error.message : 'Failed to join room' 
        });
      }
    });
  }

  private spectatorChannel(roomId: string): string {
    return `spectators:${roomId}`;
  }

  // Players get their own hole cards; spectators get a view with every hand hidden
  private broadcastGameState(room: Room, event: string, gameState: any): void {
    room.players.forEach(p => {
      const playerSocket = this.io.sockets.sockets.get(p.socketId);
      if (playerSocket) {
        playerSocket.emit(event, { gameState: this.serializeGameState(gameState, p.id) });
      }
    });
    this.io.to(this.spectatorChannel(room.id)).emit(event, { gameState: this.serializeGameState(gameState) });
  }

  private handleSpectate(socket: Socket): void {
    socket.on(SOCKET_EVENTS.SPECTATE_ROOM, (data: { roomCode: string }) => {
      try {
        const room = this.roomManager.getRoomByCode(String(data?.roomCode || '').trim().toUpperCase());
        if (!room) throw new Error('Room not found');
        if (room.getPlayerBySocketId(socket.id)) throw new Error('You are already playing in a room');
        const gameEngine = this.activeGames.get(room.id);
        if (room.status !== 'playing' || !gameEngine) {
          throw new Error('No game in progress to watch in that room');
        }

        this.leaveSpectating(socket);
        socket.join(this.spectatorChannel(room.id));
        this.spectators.set(socket.id, room.id);
        socket.emit(SOCKET_EVENTS.SPECTATE_JOINED, {
          roomId: room.id,
          roomCode: room.code,
          gameState: this.serializeGameState(gameEngine.getGameState())
        });
        logger.info(`Spectator joined room: ${room.code}`);
      } catch (error) {
        socket.emit(SOCKET_EVENTS.ROOM_ERROR, {
          message: error instanceof Error ? error.message : 'Failed to spectate room'
        });
      }
    });
  }

  private leaveSpectating(socket: Socket): boolean {
    const roomId = this.spectators.get(socket.id);
    if (!roomId) return false;
    socket.leave(this.spectatorChannel(roomId));
    this.spectators.delete(socket.id);
    return true;
  }

  private handleLeaveRoom(socket: Socket): void {
    socket.on(SOCKET_EVENTS.LEAVE_ROOM, () => {
      this.removePlayerFromRoom(socket, 'Player left voluntarily');
    });
  }

  private handlePlayerReady(socket: Socket): void {
    socket.on('player_ready', (data: { ready: boolean }) => {
      try {
        const room = this.roomManager.findRoomBySocketId(socket.id);
        if (!room) return;

        const player = room.getPlayerBySocketId(socket.id);
        if (!player) return;

        player.setReady(data.ready);

        // Notify all players in room
        this.io.to(room.id).emit('room_update', {
          room: room.toJSON()
        });

        // Check if all players are ready
        if (this.canStartGame(room)) {
          logger.info(`All players ready in room ${room.code}`);
          this.io.to(room.id).emit('all_players_ready');
        }
      } catch (error) {
        logger.error('Error handling player ready', error);
      }
    });
  }

  private handleStartGame(socket: Socket): void {
    socket.on(SOCKET_EVENTS.START_GAME, () => {
      try {
        const room = this.roomManager.findRoomBySocketId(socket.id);
        if (!room) {
          throw new Error('Room not found');
        }

        const player = room.getPlayerBySocketId(socket.id);
        // Host is tracked by player.id, not socket.id
        if (!player || player.id !== room.hostId) {
          throw new Error('Only the host can start the game');
        }

        if (room.players.length < 2) {
          throw new Error('Need at least 2 players to start');
        }

        room.startGame();

        // Create game engine
        const gameEngine = new GameEngine(
          room.id,
          room.players.map((p, idx) => ({
            id: p.id,
            socketId: p.socketId,
            name: p.name,
            chips: room.config.startingChips,
            cards: [],
            position: idx,
            isFolded: false,
            isAllIn: false,
            currentBet: 0,
            isReady: p.isReady
          })),
          room.config
        );

        this.activeGames.set(room.id, gameEngine);
        gameEngine.startHand();
        this.armTurnTimer(room, gameEngine);

        // Notify all players with their own view
        const gameState = gameEngine.getGameState();
        this.broadcastGameState(room, SOCKET_EVENTS.GAME_STARTED, gameState);
        if (gameState.stage === 'showdown') {
          this.scheduleNextHand(room, gameEngine);
        }
        
        logger.info(`Game started in room: ${room.code} with ${room.players.length} players`);
      } catch (error) {
        socket.emit(SOCKET_EVENTS.GAME_ERROR, { 
          message: error instanceof Error ? error.message : 'Failed to start game' 
        });
      }
    });
  }

  private handlePlayerAction(socket: Socket): void {
    socket.on(SOCKET_EVENTS.PLAYER_ACTION, (data: { action: string; amount?: number }) => {
      try {
        const room = this.roomManager.findRoomBySocketId(socket.id);
        if (!room) {
          throw new Error('Room not found');
        }

        const gameEngine = this.activeGames.get(room.id);
        if (!gameEngine) {
          throw new Error('Game not active');
        }

        // Prevent concurrent action handling per room
        if (this.actionLocks.get(room.id)) {
          throw new Error('Action in progress. Please wait.');
        }
        this.actionLocks.set(room.id, true);

        const player = room.getPlayerBySocketId(socket.id);
        if (!player) {
          throw new Error('Player not found');
        }

        // Convert action string to BettingAction object
        const bettingAction: BettingAction = {
          type: data.action as 'fold' | 'check' | 'call' | 'raise' | 'all-in',
          amount: data.amount
        };

        gameEngine.handlePlayerAction(player.id, bettingAction);
        this.timeoutStreaks.delete(player.id);
        gameEngine.setSittingOut(player.id, false);
        this.publishState(room, gameEngine);

      } catch (error) {
        socket.emit(SOCKET_EVENTS.GAME_ERROR, { 
          message: error instanceof Error ? error.message : 'Invalid action' 
        });
      } finally {
        // Release lock if held
        const room = this.roomManager.findRoomBySocketId(socket.id);
        if (room) {
          this.actionLocks.delete(room.id);
        }
      }
    });
  }

  private clampLevelMinutes(value: unknown): number {
    const minutes = Math.round(Number(value));
    if (!Number.isFinite(minutes)) return GAME_CONFIG.DEFAULT_LEVEL_MINUTES;
    return Math.min(GAME_CONFIG.MAX_LEVEL_MINUTES, Math.max(GAME_CONFIG.MIN_LEVEL_MINUTES, minutes));
  }

  private handleUpdateSettings(socket: Socket): void {
    socket.on(SOCKET_EVENTS.UPDATE_SETTINGS, (data: { levelMinutes?: number; startingChips?: number }) => {
      try {
        const room = this.roomManager.findRoomBySocketId(socket.id);
        if (!room) throw new Error('Room not found');
        const player = room.getPlayerBySocketId(socket.id);
        if (!player || player.id !== room.hostId) {
          throw new Error('Only the host can change settings');
        }
        if (room.status !== 'waiting') {
          throw new Error('Settings cannot change once the game has started');
        }
        if (data?.levelMinutes !== undefined) {
          room.config.levelMinutes = this.clampLevelMinutes(data.levelMinutes);
        }
        if (data?.startingChips !== undefined) {
          const startingChips = clampStartingChips(data.startingChips);
          Object.assign(room.config, { startingChips }, blindsForStack(startingChips));
          room.players.forEach(p => { p.chips = startingChips; });
        }
        this.io.to(room.id).emit(SOCKET_EVENTS.ROOM_UPDATE, { room: room.toJSON() });
      } catch (error) {
        socket.emit(SOCKET_EVENTS.ROOM_ERROR, {
          message: error instanceof Error ? error.message : 'Failed to update settings'
        });
      }
    });
  }

  private handleRebuy(socket: Socket): void {
    socket.on(SOCKET_EVENTS.REBUY, () => {
      try {
        const room = this.roomManager.findRoomBySocketId(socket.id);
        const player = room?.getPlayerBySocketId(socket.id);
        const gameEngine = room && this.activeGames.get(room.id);
        if (!room || !player || !gameEngine) throw new Error('Game not active');

        const gameState = gameEngine.rebuy(player.id);
        this.broadcastGameState(room, SOCKET_EVENTS.GAME_UPDATE, gameState);
      } catch (error) {
        socket.emit(SOCKET_EVENTS.GAME_ERROR, {
          message: error instanceof Error ? error.message : 'Rebuy failed'
        });
      }
    });
  }

  // Re-arm the turn clock, broadcast the new state, and queue the next hand if this one just ended
  private publishState(room: Room, gameEngine: GameEngine): void {
    this.armTurnTimer(room, gameEngine);
    const gameState = gameEngine.getGameState();
    this.broadcastGameState(room, SOCKET_EVENTS.GAME_UPDATE, gameState);
    if (gameState.stage === 'showdown' && gameState.winners) {
      this.scheduleNextHand(room, gameEngine);
    }
  }

  private handleSitIn(socket: Socket): void {
    socket.on(SOCKET_EVENTS.SIT_IN, () => {
      const room = this.roomManager.findRoomBySocketId(socket.id);
      const player = room?.getPlayerBySocketId(socket.id);
      const gameEngine = room && this.activeGames.get(room.id);
      if (!room || !player || !gameEngine) return;
      this.timeoutStreaks.delete(player.id);
      gameEngine.setSittingOut(player.id, false);
      this.broadcastGameState(room, SOCKET_EVENTS.GAME_UPDATE, gameEngine.getGameState());
    });
  }

  private clearTurnTimer(roomId: string): void {
    const timer = this.turnTimers.get(roomId);
    if (timer) clearTimeout(timer);
    this.turnTimers.delete(roomId);
  }

  // Starts a fresh countdown for whoever is to act; the deadline is sent to clients in the game state
  private armTurnTimer(room: NonNullable<ReturnType<RoomManager['getRoom']>>, gameEngine: GameEngine): void {
    this.clearTurnTimer(room.id);
    const state = gameEngine.getGameState();
    const stage = state.stage;
    if (this.activeGames.get(room.id) !== gameEngine || stage === 'showdown' || stage === 'waiting') {
      gameEngine.setTurnDeadline(0);
      return;
    }
    // Sitting-out players don't get the full clock; they are auto-checked/folded quickly
    const sittingOut = !!state.players[state.currentPlayerIndex]?.isSittingOut;
    const delay = sittingOut ? GAME_CONFIG.SITTING_OUT_DELAY_MS : GAME_CONFIG.TURN_TIME_MS;
    gameEngine.setTurnDeadline(Date.now() + delay);
    const timer = setTimeout(() => this.handleTurnTimeout(room, gameEngine), delay);
    this.turnTimers.set(room.id, timer);
  }

  private handleTurnTimeout(room: NonNullable<ReturnType<RoomManager['getRoom']>>, gameEngine: GameEngine): void {
    this.turnTimers.delete(room.id);
    if (this.activeGames.get(room.id) !== gameEngine) return;

    try {
      const state = gameEngine.getGameState();
      const current = state.players[state.currentPlayerIndex];
      if (!current) return;
      const type = state.currentBet > current.currentBet ? 'fold' : 'check';
      gameEngine.handlePlayerAction(current.id, { type } as BettingAction);
      logger.info(`Auto-${type} for ${current.name} in room ${room.code} (turn timer)`);

      if (!current.isSittingOut) {
        const streak = (this.timeoutStreaks.get(current.id) || 0) + 1;
        this.timeoutStreaks.set(current.id, streak);
        if (streak >= GAME_CONFIG.AUTO_SIT_OUT_TIMEOUTS) {
          gameEngine.setSittingOut(current.id, true);
          logger.info(`${current.name} is now sitting out in room ${room.code}`);
        }
      }

      this.publishState(room, gameEngine);
    } catch (error) {
      logger.warn('Turn timeout action failed', error);
    }
  }

  private scheduleNextHand(room: ReturnType<RoomManager['getRoom']>, gameEngine: GameEngine): void {
    // Give busted players time to rebuy while rebuys are still open
    const rebuyWindow = gameEngine.isRebuyOpen() && gameEngine.getBustedPlayers().length > 0;
    const delay = rebuyWindow ? GAME_CONFIG.REBUY_WINDOW_MS : 5000;
    setTimeout(() => {
      const tournamentWinner = gameEngine.getTournamentWinner();
      if (tournamentWinner) {
        room.endGame();
        this.io.to(room.id).to(this.spectatorChannel(room.id)).emit(SOCKET_EVENTS.GAME_ENDED, {
          winner: {
            playerId: tournamentWinner.id,
            playerName: tournamentWinner.name,
            chips: tournamentWinner.chips
          },
          reason: 'tournament_complete'
        });
        this.activeGames.delete(room.id);
        logger.info(`${tournamentWinner.name} won sit-and-go ${room.code}`);
        return;
      }

      try {
        gameEngine.nextHand();
        this.armTurnTimer(room, gameEngine);
        const nextGameState = gameEngine.getGameState();
        this.broadcastGameState(room, SOCKET_EVENTS.NEXT_HAND, nextGameState);
        if (nextGameState.stage === 'showdown') {
          this.scheduleNextHand(room, gameEngine);
        }
      } catch (error) {
        logger.warn('Sit-and-go ended before a winner was determined', error);
        room.endGame();
        this.io.to(room.id).to(this.spectatorChannel(room.id)).emit(SOCKET_EVENTS.GAME_ENDED, {
          reason: 'Not enough players to continue'
        });
        this.activeGames.delete(room.id);
      }
    }, delay);
  }

  private handleDisconnect(socket: Socket): void {
    socket.on(SOCKET_EVENTS.DISCONNECT, () => {
      logger.info(`Client disconnected: ${socket.id}`);
      this.removePlayerFromRoom(socket, 'Player disconnected');
    });
  }

  private removePlayerFromRoom(socket: Socket, reason: string = 'Unknown'): void {
    if (this.leaveSpectating(socket)) return;
    const room = this.roomManager.findRoomBySocketId(socket.id);
    if (!room) return;

    const player = room.getPlayerBySocketId(socket.id);
    
    // Remove player from room
    this.roomManager.removePlayer(room.id, socket.id);
    socket.leave(room.id);

    // Clean up player socket mapping
    if (player) {
      this.playerSockets.delete(player.id);
    }
    
    if (room.players.length > 0) {
      // Notify other players
      this.io.to(room.id).emit(SOCKET_EVENTS.PLAYER_LEFT, {
        playerId: player?.id,
        playerName: player?.name,
        remainingPlayers: room.players.length,
        reason
      });
      this.io.to(room.id).emit(SOCKET_EVENTS.ROOM_UPDATE, { room: room.toJSON() });

      // If game is playing and player was in it, fold them out through the engine
      if (room.status === 'playing' && this.activeGames.has(room.id) && player) {
        const gameEngine = this.activeGames.get(room.id)!;
        this.timeoutStreaks.delete(player.id);
        const wasLive = !['showdown', 'waiting'].includes(gameEngine.getGameState().stage);
        gameEngine.forfeitPlayer(player.id);
        if (wasLive) {
          this.publishState(room, gameEngine);
        } else {
          this.broadcastGameState(room, SOCKET_EVENTS.GAME_UPDATE, gameEngine.getGameState());
        }
      }
    } else {
      // Room is now empty
      this.clearTurnTimer(room.id);
      this.activeGames.delete(room.id);
      logger.info(`Room ${room?.code} is now empty and deleted`);
    }
  }

  private canStartGame(room: any): boolean {
    if (room.players.length < 2) return false;
    return room.players.every((p: any) => p.isReady || p.id === room.hostId);
  }

  /**
   * Gracefully shutdown SocketManager
   */
  shutdown(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    
    this.io.disconnectSockets();
    logger.info('SocketManager shutdown complete');
  }
}
