import { Player } from './Player';

export interface RoomConfig {
  maxPlayers: number;
  startingChips: number;
  smallBlind: number;
  bigBlind: number;
  levelMinutes: number;
}

export class Room {
  id: string;
  code: string;
  hostId: string;
  players: Player[];
  config: RoomConfig;
  status: 'waiting' | 'playing' | 'finished';
  createdAt: Date;

  constructor(
    id: string,
    code: string,
    hostId: string,
    config: RoomConfig
  ) {
    this.id = id;
    this.code = code;
    this.hostId = hostId;
    this.players = [];
    this.config = config;
    this.status = 'waiting';
    this.createdAt = new Date();
  }

  addPlayer(player: Player): void {
    if (this.players.length >= this.config.maxPlayers) {
      throw new Error('Room is full');
    }
    if (this.status !== 'waiting') {
      throw new Error('Game already in progress');
    }
    this.players.push(player);
  }

  removePlayer(playerId: string): void {
    const index = this.players.findIndex(p => p.id === playerId);
    if (index !== -1) {
      this.players.splice(index, 1);
    }
    
    // If host leaves, assign new host or close room
    if (this.hostId === playerId && this.players.length > 0) {
      this.hostId = this.players[0].id;
    }
  }

  getPlayer(playerId: string): Player | undefined {
    return this.players.find(p => p.id === playerId);
  }

  getPlayerBySocketId(socketId: string): Player | undefined {
    return this.players.find(p => p.socketId === socketId);
  }

  isHost(playerId: string): boolean {
    return this.hostId === playerId;
  }

  isFull(): boolean {
    return this.players.length >= this.config.maxPlayers;
  }

  canStart(): boolean {
    return this.players.length >= 2 && this.status === 'waiting';
  }

  startGame(): void {
    if (!this.canStart()) {
      throw new Error('Cannot start game: not enough players or game already started');
    }
    this.status = 'playing';
  }

  endGame(): void {
    this.status = 'finished';
  }

  toJSON() {
    return {
      id: this.id,
      code: this.code,
      hostId: this.hostId,
      players: this.players.map(p => p.toJSON(true)),
      config: this.config,
      status: this.status,
      createdAt: this.createdAt
    };
  }
}
