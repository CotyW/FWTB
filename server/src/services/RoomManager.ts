import { v4 as uuidv4 } from 'uuid';
import { Room } from '../models/Room';
import { Player } from '../models/Player';
import { RoomConfig } from '../../../shared/types/game.types';
import { ROOM } from '../../../shared/constants/gameConfig';
import { logger } from '../utils/logger';

export class RoomManager {
  private rooms: Map<string, Room>;
  private roomsByCode: Map<string, string>; // roomCode -> roomId mapping
  private playerRooms: Map<string, string>; // socketId -> roomId mapping
  private roomExpiryTime: number = ROOM.MAX_ROOM_AGE_HOURS * 60 * 60 * 1000;

  constructor() {
    this.rooms = new Map();
    this.roomsByCode = new Map();
    this.playerRooms = new Map();
  }

  /**
   * Create a new room
   */
  createRoom(hostSocketId: string, hostName: string, config: RoomConfig): Room {
    const roomId = uuidv4();
    const roomCode = this.generateRoomCode();
    const room = new Room(roomId, roomCode, hostSocketId, config);
    
    // Create host player
    const hostPlayer = new Player(
      uuidv4(),
      hostSocketId,
      hostName,
      config.startingChips,
      0
    );
    
    room.addPlayer(hostPlayer);
    // Host should be tracked by player id (not socket id)
    room.hostId = hostPlayer.id;
    this.rooms.set(room.id, room);
    this.roomsByCode.set(roomCode, roomId);
    this.playerRooms.set(hostSocketId, roomId);
    
    logger.info(`Room created: ${room.code} (${roomId}) by ${hostName}`);
    return room;
  }

  /**
   * Join an existing room
   */
  joinRoom(roomCode: string, socketId: string, playerName: string): Room {
    const room = this.getRoomByCode(roomCode);
    
    if (!room) {
      throw new Error('Room not found');
    }
    
    if (room.isFull()) {
      throw new Error('Room is full');
    }
    
    if (room.status !== 'waiting') {
      throw new Error('Game already in progress');
    }

    if (room.getPlayerBySocketId(socketId)) {
      throw new Error('Player is already in this room');
    }

    const player = new Player(
      uuidv4(),
      socketId,
      playerName,
      room.config.startingChips,
      room.players.length
    );

    room.addPlayer(player);
    this.playerRooms.set(socketId, room.id);
    
    logger.info(`Player ${playerName} joined room: ${room.code}`);
    return room;
  }

  /**
   * Get room by ID
   */
  getRoom(roomId: string): Room {
    const room = this.rooms.get(roomId);
    if (!room) {
      throw new Error('Room not found');
    }
    return room;
  }

  /**
   * Get room by room code
   */
  getRoomByCode(code: string): Room | undefined {
    const roomId = this.roomsByCode.get(code);
    return roomId ? this.rooms.get(roomId) : undefined;
  }

  /**
   * Find room by player's socket ID
   */
  findRoomBySocketId(socketId: string): Room | undefined {
    const roomId = this.playerRooms.get(socketId);
    return roomId ? this.rooms.get(roomId) : undefined;
  }

  /**
   * Remove player from room
   */
  removePlayer(roomId: string, socketId: string): void {
    const room = this.rooms.get(roomId);
    if (!room) return;

    const player = room.getPlayerBySocketId(socketId);
    if (player) {
      room.removePlayer(player.id);
      this.playerRooms.delete(socketId);
      logger.info(`Player ${player.name} removed from room: ${room.code}`);

      // If host leaves, assign new host
      if (socketId === room.hostId && room.players.length > 0) {
        room.hostId = room.players[0].socketId;
        logger.info(`New host assigned in room ${room.code}: ${room.players[0].name}`);
      }
    }
    
    // Delete room if empty
    if (room.players.length === 0) {
      this.deleteRoom(roomId);
    }
  }

  /**
   * Delete a room
   */
  deleteRoom(roomId: string): void {
    const room = this.rooms.get(roomId);
    if (room) {
      // Remove all player mappings
      for (const player of room.players) {
        this.playerRooms.delete(player.socketId);
      }
      
      this.roomsByCode.delete(room.code);
      this.rooms.delete(roomId);
      logger.info(`Room ${room.code} deleted`);
    }
  }

  /**
   * Generate a unique room code
   */
  private generateRoomCode(): string {
    let code = '';
    for (let i = 0; i < ROOM.CODE_LENGTH; i++) {
      code += ROOM.CODE_CHARS.charAt(Math.floor(Math.random() * ROOM.CODE_CHARS.length));
    }
    
    // Ensure uniqueness
    if (this.roomsByCode.has(code)) {
      return this.generateRoomCode();
    }
    
    return code;
  }

  /**
   * Clean up old/stale rooms
   */
  cleanupOldRooms(): void {
    const now = Date.now();
    const roomsToDelete: string[] = [];

    for (const [roomId, room] of this.rooms) {
      const roomAge = now - room.createdAt.getTime();
      
      // Delete empty rooms that are older than expiry time
      if (room.players.length === 0 && roomAge > this.roomExpiryTime) {
        roomsToDelete.push(roomId);
      }

      // Delete rooms in waiting state that haven't been touched for a long time
      if (room.status === 'waiting' && roomAge > this.roomExpiryTime) {
        roomsToDelete.push(roomId);
      }
    }

    for (const roomId of roomsToDelete) {
      this.deleteRoom(roomId);
    }

    if (roomsToDelete.length > 0) {
      logger.debug(`Cleaned up ${roomsToDelete.length} old rooms`);
    }
  }

  /**
   * Get all active rooms
   */
  getActiveRooms(): Room[] {
    return Array.from(this.rooms.values()).filter(r => r.players.length > 0);
  }

  /**
   * Get all waiting rooms (not playing yet)
   */
  getWaitingRooms(): Room[] {
    return Array.from(this.rooms.values()).filter(r => r.status === 'waiting');
  }

  /**
   * Get all playing rooms
   */
  getPlayingRooms(): Room[] {
    return Array.from(this.rooms.values()).filter(r => r.status === 'playing');
  }

  /**
   * Get room statistics
   */
  getRoomStats(): {
    totalRooms: number;
    waitingRooms: number;
    playingRooms: number;
    totalPlayers: number;
  } {
    const allRooms = Array.from(this.rooms.values());
    const totalPlayers = allRooms.reduce((sum, room) => sum + room.players.length, 0);

    return {
      totalRooms: allRooms.length,
      waitingRooms: allRooms.filter(r => r.status === 'waiting').length,
      playingRooms: allRooms.filter(r => r.status === 'playing').length,
      totalPlayers
    };
  }

  /**
   * Update room status
   */
  updateRoomStatus(roomId: string, status: 'waiting' | 'playing' | 'finished'): void {
    const room = this.rooms.get(roomId);
    if (room) {
      room.status = status;
      logger.debug(`Room ${room.code} status updated to: ${status}`);
    }
  }

  /**
   * Restore player session (reconnection)
   */
  restorePlayerSession(oldSocketId: string, newSocketId: string): Player | null {
    const roomId = this.playerRooms.get(oldSocketId);
    if (!roomId) return null;

    const room = this.rooms.get(roomId);
    if (!room) return null;

    const player = room.getPlayerBySocketId(oldSocketId);
    if (!player) return null;

    // Update player's socket ID
    player.updateSocketId(newSocketId);
    
    // Update mappings
    this.playerRooms.delete(oldSocketId);
    this.playerRooms.set(newSocketId, roomId);

    logger.info(`Player ${player.name} reconnected in room ${room.code}`);
    return player;
  }
}