import { Socket } from 'socket.io';
import { GameEngine } from '../gameEngine/GameEngine';
import { SOCKET_EVENTS } from '../../../../shared/constants/socketEvents';
import { BettingAction } from '../../../../shared/types/game.types';
import { logger } from '../../utils/logger';
import { SocketContext } from './context';

const errorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error ? error.message : fallback;

export function registerGameHandlers(ctx: SocketContext, socket: Socket): void {
  const { roomManager, activeGames, actionLocks, flow } = ctx;

  socket.on(SOCKET_EVENTS.START_GAME, () => {
    try {
      const room = roomManager.findRoomBySocketId(socket.id);
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

      activeGames.set(room.id, gameEngine);
      gameEngine.startHand();
      flow.armTurnTimer(room, gameEngine);

      const gameState = gameEngine.getGameState();
      flow.broadcastGameState(room, SOCKET_EVENTS.GAME_STARTED, gameState);
      if (gameState.stage === 'showdown') {
        flow.scheduleNextHand(room, gameEngine);
      }

      logger.info(`Game started in room: ${room.code} with ${room.players.length} players`);
    } catch (error) {
      socket.emit(SOCKET_EVENTS.GAME_ERROR, { message: errorMessage(error, 'Failed to start game') });
    }
  });

  socket.on(SOCKET_EVENTS.PLAYER_ACTION, (data: { action: string; amount?: number }) => {
    try {
      const room = roomManager.findRoomBySocketId(socket.id);
      if (!room) {
        throw new Error('Room not found');
      }

      const gameEngine = activeGames.get(room.id);
      if (!gameEngine) {
        throw new Error('Game not active');
      }

      // Prevent concurrent action handling per room
      if (actionLocks.get(room.id)) {
        throw new Error('Action in progress. Please wait.');
      }
      actionLocks.set(room.id, true);

      const player = room.getPlayerBySocketId(socket.id);
      if (!player) {
        throw new Error('Player not found');
      }

      const bettingAction: BettingAction = {
        type: data.action as 'fold' | 'check' | 'call' | 'raise' | 'all-in',
        amount: data.amount
      };

      gameEngine.handlePlayerAction(player.id, bettingAction);
      flow.playerIsActive(gameEngine, player.id);
      flow.publishState(room, gameEngine);
    } catch (error) {
      socket.emit(SOCKET_EVENTS.GAME_ERROR, { message: errorMessage(error, 'Invalid action') });
    } finally {
      const room = roomManager.findRoomBySocketId(socket.id);
      if (room) {
        actionLocks.delete(room.id);
      }
    }
  });

  socket.on(SOCKET_EVENTS.REBUY, () => {
    try {
      const room = roomManager.findRoomBySocketId(socket.id);
      const player = room?.getPlayerBySocketId(socket.id);
      const gameEngine = room && activeGames.get(room.id);
      if (!room || !player || !gameEngine) throw new Error('Game not active');

      const gameState = gameEngine.rebuy(player.id);
      flow.broadcastGameState(room, SOCKET_EVENTS.GAME_UPDATE, gameState);
    } catch (error) {
      socket.emit(SOCKET_EVENTS.GAME_ERROR, { message: errorMessage(error, 'Rebuy failed') });
    }
  });

  socket.on(SOCKET_EVENTS.SIT_IN, () => {
    const room = roomManager.findRoomBySocketId(socket.id);
    const player = room?.getPlayerBySocketId(socket.id);
    const gameEngine = room && activeGames.get(room.id);
    if (!room || !player || !gameEngine) return;
    flow.playerIsActive(gameEngine, player.id);
    flow.broadcastGameState(room, SOCKET_EVENTS.GAME_UPDATE, gameEngine.getGameState());
  });
}
