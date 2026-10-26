import { io, Socket } from 'socket.io-client';
import type { ClientGameState, PublicPlayer } from '../../../shared/types/game.types';

export type GameState = ClientGameState;

export interface PlayerJoinedEvent {
  roomId: string;
  roomCode: string;
  players: PublicPlayer[];
  hostId: string;
  playerId: string;
  config: {
    startingChips: number;
    levelMinutes?: number;
  };
}

export interface GameStartedEvent {
  gameState: GameState;
}

export interface GameEndedEvent {
  winner?: {
    playerId: string;
    playerName: string;
    chips: number;
  };
  reason: string;
}

class SocketService {
  private socket: Socket | null = null;
  private isConnected = false;

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // In production the client is served by the same server, so connect to the page's own origin
        const serverUrl = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? window.location.origin : 'http://localhost:3001');
        this.socket = io(serverUrl, {
          transports: ['websocket', 'polling'],
          reconnection: true,
          reconnectionDelay: 1000,
          reconnectionDelayMax: 5000,
          reconnectionAttempts: 5,
        });

        this.socket.on('connect', () => {
          this.isConnected = true;
          console.log('Connected to server');
          resolve();
        });

        this.socket.on('connect_error', (error) => {
          console.error('Connection error:', error);
          reject(error);
        });

        this.socket.on('disconnect', () => {
          this.isConnected = false;
          console.log('Disconnected from server');
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.isConnected = false;
    }
  }

  createRoom(playerName: string, buyIn: number, levelMinutes: number): void {
    if (!this.socket) {
      console.error('Socket not connected');
      return;
    }
    this.socket.emit('create_room', { playerName, buyIn, levelMinutes });
  }

  updateSettings(settings: { levelMinutes?: number; startingChips?: number }): void {
    this.socket?.emit('update_settings', settings);
  }

  spectateRoom(roomCode: string): void {
    this.socket?.emit('spectate_room', { roomCode });
  }

  onSpectateJoined(callback: (data: { roomId: string; roomCode: string; gameState: GameState }) => void): void {
    if (!this.socket) return;
    this.socket.on('spectate_joined', callback);
  }

  rebuy(): void {
    this.socket?.emit('rebuy', {});
  }

  joinRoom(roomCode: string, playerName: string): void {
    if (!this.socket) {
      console.error('Socket not connected');
      return;
    }
    this.socket.emit('join_room', { roomCode, playerName });
  }

  setPlayerReady(ready: boolean): void {
    if (!this.socket) {
      console.error('Socket not connected');
      return;
    }
    this.socket.emit('player_ready', { ready });
  }

  startGame(): void {
    if (!this.socket) {
      console.error('Socket not connected');
      return;
    }
    this.socket.emit('start_game', {});
  }

  playerAction(action: 'fold' | 'check' | 'call' | 'raise' | 'all_in', amount?: number): void {
    if (!this.socket) {
      console.error('Socket not connected');
      return;
    }
    // Convert all_in to all-in for backend compatibility
    const serverAction = action === 'all_in' ? 'all-in' : action;
    this.socket.emit('player_action', { action: serverAction, amount: amount || 0 });
  }

  leaveRoom(): void {
    if (!this.socket) {
      console.error('Socket not connected');
      return;
    }
    this.socket.emit('leave_room', {});
  }

  // Event listeners
  onRoomCreated(callback: (data: PlayerJoinedEvent) => void): void {
    if (!this.socket) return;
    this.socket.on('room_created', callback);
  }

  onRoomJoined(callback: (data: PlayerJoinedEvent) => void): void {
    if (!this.socket) return;
    this.socket.on('room_joined', callback);
  }

  onPlayerJoined(callback: (data: PlayerJoinedEvent) => void): void {
    if (!this.socket) return;
    this.socket.on('player_joined', callback);
  }

  onGameStarted(callback: (data: GameStartedEvent) => void): void {
    if (!this.socket) return;
    this.socket.on('game_started', callback);
  }

  // Server uses 'game_update' for ongoing state; mirror it to game_state handler
  onGameUpdate(callback: (data: { gameState: GameState }) => void): void {
    if (!this.socket) return;
    this.socket.on('game_update', callback);
  }

  onNextHand(callback: (data: { gameState: GameState }) => void): void {
    if (!this.socket) return;
    this.socket.on('next_hand', callback);
  }

  onRoomUpdate(callback: (data: any) => void): void {
    if (!this.socket) return;
    this.socket.on('room_update', callback);
  }

  onGameState(callback: (state: GameState) => void): void {
    if (!this.socket) return;
    this.socket.on('game_state', callback);
  }

  onError(callback: (error: any) => void): void {
    if (!this.socket) return;
    this.socket.on('room_error', callback);
    this.socket.on('game_error', callback);
  }

  onGameEnded(callback: (data: GameEndedEvent) => void): void {
    if (!this.socket) return;
    this.socket.on('game_ended', callback);
  }

  onPlayerDisconnected(callback: (data: any) => void): void {
    if (!this.socket) return;
    this.socket.on('player_disconnected', callback);
  }

  // Remove event listeners
  offRoomCreated(): void {
    if (!this.socket) return;
    this.socket.off('room_created');
  }

  offPlayerJoined(): void {
    if (!this.socket) return;
    this.socket.off('player_joined');
  }

  offGameStarted(): void {
    if (!this.socket) return;
    this.socket.off('game_started');
  }

  offGameState(): void {
    if (!this.socket) return;
    this.socket.off('game_state');
  }

  offError(): void {
    if (!this.socket) return;
    this.socket.off('error');
  }

  getIsConnected(): boolean {
    return this.isConnected;
  }
}

export const socketService = new SocketService();
