import { Socket } from 'socket.io';
import { Room } from '../../models/Room';
import { SOCKET_EVENTS } from '../../../../shared/constants/socketEvents';
import { GAME_CONFIG, clampStartingChips, clampBlinds, blindsForStack } from '../../../../shared/constants/gameConfig';
import { RoomConfig } from '../../../../shared/types/game.types';
import { logger } from '../../utils/logger';
import { SocketContext } from './context';
import { serializeGameState } from './serializeGameState';
import { spectatorChannel } from './GameFlow';

const errorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error ? error.message : fallback;

export function clampLevelMinutes(value: unknown): number {
  const minutes = Math.round(Number(value));
  if (!Number.isFinite(minutes)) return GAME_CONFIG.DEFAULT_LEVEL_MINUTES;
  return Math.min(GAME_CONFIG.MAX_LEVEL_MINUTES, Math.max(GAME_CONFIG.MIN_LEVEL_MINUTES, minutes));
}

const canStartGame = (room: Room): boolean =>
  room.players.length >= 2 && room.players.every(p => p.isReady || p.id === room.hostId);

function leaveSpectating(ctx: SocketContext, socket: Socket): boolean {
  const roomId = ctx.spectators.get(socket.id);
  if (!roomId) return false;
  socket.leave(spectatorChannel(roomId));
  ctx.spectators.delete(socket.id);
  return true;
}

export function removePlayerFromRoom(ctx: SocketContext, socket: Socket, reason: string = 'Unknown'): void {
  const { io, roomManager, activeGames, playerSockets, flow } = ctx;
  if (leaveSpectating(ctx, socket)) return;
  const room = roomManager.findRoomBySocketId(socket.id);
  if (!room) return;

  const player = room.getPlayerBySocketId(socket.id);

  roomManager.removePlayer(room.id, socket.id);
  socket.leave(room.id);

  if (player) {
    playerSockets.delete(player.id);
  }

  if (room.players.length > 0) {
    io.to(room.id).emit(SOCKET_EVENTS.PLAYER_LEFT, {
      playerId: player?.id,
      playerName: player?.name,
      remainingPlayers: room.players.length,
      reason
    });
    io.to(room.id).emit(SOCKET_EVENTS.ROOM_UPDATE, { room: room.toJSON() });

    // If game is playing and player was in it, fold them out through the engine
    const gameEngine = activeGames.get(room.id);
    if (room.status === 'playing' && gameEngine && player) {
      flow.forgetPlayer(player.id);
      const wasLive = !['showdown', 'waiting'].includes(gameEngine.getGameState().stage);
      gameEngine.forfeitPlayer(player.id);
      if (wasLive) {
        flow.publishState(room, gameEngine);
      } else {
        flow.broadcastGameState(room, SOCKET_EVENTS.GAME_UPDATE, gameEngine.getGameState());
      }
    }
  } else {
    flow.clearTurnTimer(room.id);
    activeGames.delete(room.id);
    logger.info(`Room ${room.code} is now empty and deleted`);
  }
}

export function registerRoomHandlers(ctx: SocketContext, socket: Socket): void {
  const { io, roomManager, activeGames, playerSockets, spectators } = ctx;

  socket.on(SOCKET_EVENTS.CREATE_ROOM, (data: any) => {
    try {
      const { playerName, buyIn, levelMinutes, smallBlind, bigBlind } = data;
      const startingChips = clampStartingChips(buyIn);
      const custom = smallBlind !== undefined || bigBlind !== undefined;
      const config: RoomConfig = {
        maxPlayers: GAME_CONFIG.MAX_PLAYERS,
        startingChips,
        ...(custom ? clampBlinds(smallBlind, bigBlind, startingChips) : blindsForStack(startingChips)),
        blindsCustom: custom,
        levelMinutes: clampLevelMinutes(levelMinutes)
      };
      const room = roomManager.createRoom(socket.id, playerName, config);

      socket.join(room.id);
      const hostPlayer = room.players[0];
      if (hostPlayer) {
        playerSockets.set(hostPlayer.id, socket.id);
      }

      socket.emit(SOCKET_EVENTS.ROOM_CREATED, {
        roomId: room.id,
        roomCode: room.code,
        hostId: room.hostId,
        playerId: hostPlayer?.id,
        config: room.config,
        players: room.players.map(p => p.toJSON())
      });
      io.to(room.id).emit(SOCKET_EVENTS.ROOM_UPDATE, { room: room.toJSON() });

      logger.info(`Room created: ${room.code} by ${playerName}`);
    } catch (error) {
      socket.emit(SOCKET_EVENTS.ROOM_ERROR, { message: errorMessage(error, 'Failed to create room') });
    }
  });

  socket.on(SOCKET_EVENTS.JOIN_ROOM, (data: { roomCode: string; playerName: string }) => {
    try {
      const { roomCode, playerName } = data;
      const room = roomManager.joinRoom(roomCode, socket.id, playerName);

      socket.join(room.id);
      const joinedPlayer = room.players[room.players.length - 1];
      if (joinedPlayer) {
        playerSockets.set(joinedPlayer.id, socket.id);
      }

      socket.emit(SOCKET_EVENTS.ROOM_JOINED, {
        roomId: room.id,
        roomCode: room.code,
        hostId: room.hostId,
        playerId: joinedPlayer?.id,
        config: room.config,
        players: room.players.map(p => p.toJSON())
      });
      socket.to(room.id).emit(SOCKET_EVENTS.PLAYER_JOINED, {
        player: joinedPlayer?.toJSON(),
        totalPlayers: room.players.length
      });
      io.to(room.id).emit(SOCKET_EVENTS.ROOM_UPDATE, { room: room.toJSON() });

      logger.info(`${playerName} joined room: ${room.code}`);
    } catch (error) {
      socket.emit(SOCKET_EVENTS.ROOM_ERROR, { message: errorMessage(error, 'Failed to join room') });
    }
  });

  socket.on(SOCKET_EVENTS.SPECTATE_ROOM, (data: { roomCode: string }) => {
    try {
      const room = roomManager.getRoomByCode(String(data?.roomCode || '').trim().toUpperCase());
      if (!room) throw new Error('Room not found');
      if (room.getPlayerBySocketId(socket.id)) throw new Error('You are already playing in a room');
      const gameEngine = activeGames.get(room.id);
      if (room.status !== 'playing' || !gameEngine) {
        throw new Error('No game in progress to watch in that room');
      }

      leaveSpectating(ctx, socket);
      socket.join(spectatorChannel(room.id));
      spectators.set(socket.id, room.id);
      socket.emit(SOCKET_EVENTS.SPECTATE_JOINED, {
        roomId: room.id,
        roomCode: room.code,
        gameState: serializeGameState(gameEngine.getGameState())
      });
      logger.info(`Spectator joined room: ${room.code}`);
    } catch (error) {
      socket.emit(SOCKET_EVENTS.ROOM_ERROR, { message: errorMessage(error, 'Failed to spectate room') });
    }
  });

  socket.on(SOCKET_EVENTS.LEAVE_ROOM, () => {
    removePlayerFromRoom(ctx, socket, 'Player left voluntarily');
  });

  socket.on(SOCKET_EVENTS.PLAYER_READY, (data: { ready: boolean }) => {
    try {
      const room = roomManager.findRoomBySocketId(socket.id);
      const player = room?.getPlayerBySocketId(socket.id);
      if (!room || !player) return;

      player.setReady(data.ready);
      io.to(room.id).emit(SOCKET_EVENTS.ROOM_UPDATE, { room: room.toJSON() });

      if (canStartGame(room)) {
        logger.info(`All players ready in room ${room.code}`);
        io.to(room.id).emit(SOCKET_EVENTS.ALL_PLAYERS_READY);
      }
    } catch (error) {
      logger.error('Error handling player ready', error);
    }
  });

  socket.on(SOCKET_EVENTS.UPDATE_SETTINGS, (data: { levelMinutes?: number; startingChips?: number; smallBlind?: number; bigBlind?: number }) => {
    try {
      const room = roomManager.findRoomBySocketId(socket.id);
      if (!room) throw new Error('Room not found');
      const player = room.getPlayerBySocketId(socket.id);
      if (!player || player.id !== room.hostId) {
        throw new Error('Only the host can change settings');
      }
      if (room.status !== 'waiting') {
        throw new Error('Settings cannot change once the game has started');
      }
      if (data?.levelMinutes !== undefined) {
        room.config.levelMinutes = clampLevelMinutes(data.levelMinutes);
      }
      if (data?.startingChips !== undefined) {
        const startingChips = clampStartingChips(data.startingChips);
        room.config.startingChips = startingChips;
        room.players.forEach(p => { p.chips = startingChips; });
        // Auto blinds follow the stack; hand-picked blinds are kept (but never exceed the new stack)
        Object.assign(
          room.config,
          room.config.blindsCustom
            ? clampBlinds(room.config.smallBlind, room.config.bigBlind, startingChips)
            : blindsForStack(startingChips)
        );
      }
      if (data?.smallBlind !== undefined || data?.bigBlind !== undefined) {
        Object.assign(room.config, clampBlinds(
          data.smallBlind ?? room.config.smallBlind,
          data.bigBlind ?? room.config.bigBlind,
          room.config.startingChips
        ), { blindsCustom: true });
      }
      io.to(room.id).emit(SOCKET_EVENTS.ROOM_UPDATE, { room: room.toJSON() });
    } catch (error) {
      socket.emit(SOCKET_EVENTS.ROOM_ERROR, { message: errorMessage(error, 'Failed to update settings') });
    }
  });

  socket.on(SOCKET_EVENTS.DISCONNECT, () => {
    logger.info(`Client disconnected: ${socket.id}`);
    removePlayerFromRoom(ctx, socket, 'Player disconnected');
  });
}
