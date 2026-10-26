import { io, Socket } from 'socket.io-client';
import type { ClientGameState, PublicPlayer } from '../../../shared/types/game.types';
import { SOCKET_EVENTS } from '../../../shared/constants/socketEvents';

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

        this.socket.on(SOCKET_EVENTS.CONNECT, () => {
          this.isConnected = true;
          console.log('Connected to server');
          resolve();
        });

        this.socket.on(SOCKET_EVENTS.CONNECT_ERROR, (error) => {
          console.error('Connection error:', error);
          reject(error);
        });

        this.socket.on(SOCKET_EVENTS.DISCONNECT, () => {
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
    this.socket.emit(SOCKET_EVENTS.CREATE_ROOM, { playerName, buyIn, levelMinutes });
  }

  updateSettings(settings: { levelMinutes?: number; startingChips?: number }): void {
    this.socket?.emit(SOCKET_EVENTS.UPDATE_SETTINGS, settings);
  }

  spectateRoom(roomCode: string): void {
    this.socket?.emit(SOCKET_EVENTS.SPECTATE_ROOM, { roomCode });
  }

  onSpectateJoined(callback: (data: { roomId: string; roomCode: string; gameState: GameState }) => void): void {
    if (!this.socket) return;
    this.socket.on(SOCKET_EVENTS.SPECTATE_JOINED, callback);
  }

  rebuy(): void {
    this.socket?.emit(SOCKET_EVENTS.REBUY, {});
  }

  sitIn(): void {
    this.socket?.emit(SOCKET_EVENTS.SIT_IN, {});
  }

  joinRoom(roomCode: string, playerName: string): void {
    if (!this.socket) {
      console.error('Socket not connected');
      return;
    }
    this.socket.emit(SOCKET_EVENTS.JOIN_ROOM, { roomCode, playerName });
  }

  setPlayerReady(ready: boolean): void {
    if (!this.socket) {
      console.error('Socket not connected');
      return;
    }
    this.socket.emit(SOCKET_EVENTS.PLAYER_READY, { ready });
  }

  startGame(): void {
    if (!this.socket) {
      console.error('Socket not connected');
      return;
    }
    this.socket.emit(SOCKET_EVENTS.START_GAME, {});
  }

  playerAction(action: 'fold' | 'check' | 'call' | 'raise' | 'all_in', amount?: number): void {
    if (!this.socket) {
      console.error('Socket not connected');
      return;
    }
    // Convert all_in to all-in for backend compatibility
    const serverAction = action === 'all_in' ? 'all-in' : action;
    this.socket.emit(SOCKET_EVENTS.PLAYER_ACTION, { action: serverAction, amount: amount || 0 });
  }

  leaveRoom(): void {
    if (!this.socket) {
      console.error('Socket not connected');
      return;
    }
    this.socket.emit(SOCKET_EVENTS.LEAVE_ROOM, {});
  }

  // Event listeners
  onRoomCreated(callback: (data: PlayerJoinedEvent) => void): void {
    if (!this.socket) return;
    this.socket.on(SOCKET_EVENTS.ROOM_CREATED, callback);
  }

  onRoomJoined(callback: (data: PlayerJoinedEvent) => void): void {
    if (!this.socket) return;
    this.socket.on(SOCKET_EVENTS.ROOM_JOINED, callback);
  }

  onPlayerJoined(callback: (data: PlayerJoinedEvent) => void): void {
    if (!this.socket) return;
    this.socket.on(SOCKET_EVENTS.PLAYER_JOINED, callback);
  }

  onGameStarted(callback: (data: GameStartedEvent) => void): void {
    if (!this.socket) return;
    this.socket.on(SOCKET_EVENTS.GAME_STARTED, callback);
  }

  // Server uses 'game_update' for ongoing state; mirror it to game_state handler
  onGameUpdate(callback: (data: { gameState: GameState }) => void): void {
    if (!this.socket) return;
    this.socket.on(SOCKET_EVENTS.GAME_UPDATE, callback);
  }

  onNextHand(callback: (data: { gameState: GameState }) => void): void {
    if (!this.socket) return;
    this.socket.on(SOCKET_EVENTS.NEXT_HAND, callback);
  }

  onRoomUpdate(callback: (data: any) => void): void {
    if (!this.socket) return;
    this.socket.on(SOCKET_EVENTS.ROOM_UPDATE, callback);
  }

  onGameState(callback: (state: GameState) => void): void {
    if (!this.socket) return;
    this.socket.on(SOCKET_EVENTS.GAME_STATE, callback);
  }

  onError(callback: (error: any) => void): void {
    if (!this.socket) return;
    this.socket.on(SOCKET_EVENTS.ROOM_ERROR, callback);
    this.socket.on(SOCKET_EVENTS.GAME_ERROR, callback);
  }

  onGameEnded(callback: (data: GameEndedEvent) => void): void {
    if (!this.socket) return;
    this.socket.on(SOCKET_EVENTS.GAME_ENDED, callback);
  }

  onPlayerDisconnected(callback: (data: any) => void): void {
    if (!this.socket) return;
    this.socket.on(SOCKET_EVENTS.PLAYER_DISCONNECTED, callback);
  }

  // Remove event listeners
  offRoomCreated(): void {
    if (!this.socket) return;
    this.socket.off(SOCKET_EVENTS.ROOM_CREATED);
  }

  offPlayerJoined(): void {
    if (!this.socket) return;
    this.socket.off(SOCKET_EVENTS.PLAYER_JOINED);
  }

  offGameStarted(): void {
    if (!this.socket) return;
    this.socket.off(SOCKET_EVENTS.GAME_STARTED);
  }

  offGameState(): void {
    if (!this.socket) return;
    this.socket.off(SOCKET_EVENTS.GAME_STATE);
  }

  offError(): void {
    if (!this.socket) return;
    this.socket.off(SOCKET_EVENTS.ERROR);
  }

  getIsConnected(): boolean {
    return this.isConnected;
  }
}

export const socketService = new SocketService();
