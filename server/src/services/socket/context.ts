import { Server } from 'socket.io';
import { RoomManager } from '../RoomManager';
import { GameEngine } from '../gameEngine/GameEngine';
import { GameFlow } from './GameFlow';

// State shared by all socket handler modules
export interface SocketContext {
  io: Server;
  roomManager: RoomManager;
  activeGames: Map<string, GameEngine>;
  playerSockets: Map<string, string>; // playerId -> socketId
  spectators: Map<string, string>; // socketId -> roomId
  actionLocks: Map<string, boolean>; // roomId -> action in progress
  flow: GameFlow;
}
