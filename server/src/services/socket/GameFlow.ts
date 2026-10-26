import { Server } from 'socket.io';
import { Room } from '../../models/Room';
import { GameEngine } from '../gameEngine/GameEngine';
import { SOCKET_EVENTS } from '../../../../shared/constants/socketEvents';
import { GAME_CONFIG } from '../../../../shared/constants/gameConfig';
import { BettingAction } from '../../../../shared/types/game.types';
import { logger } from '../../utils/logger';
import { serializeGameState } from './serializeGameState';

export const spectatorChannel = (roomId: string): string => `spectators:${roomId}`;

/**
 * Drives a running game: per-player state broadcasts, the turn clock,
 * auto sit-out and scheduling of the next hand.
 */
export class GameFlow {
  private turnTimers: Map<string, NodeJS.Timeout> = new Map();
  private timeoutStreaks: Map<string, number> = new Map(); // playerId -> consecutive turn timeouts

  constructor(private io: Server, private activeGames: Map<string, GameEngine>) {}

  // Players get their own hole cards; spectators get a view with every hand hidden
  broadcastGameState(room: Room, event: string, gameState: any): void {
    room.players.forEach(p => {
      const playerSocket = this.io.sockets.sockets.get(p.socketId);
      if (playerSocket) {
        playerSocket.emit(event, { gameState: serializeGameState(gameState, p.id) });
      }
    });
    this.io.to(spectatorChannel(room.id)).emit(event, { gameState: serializeGameState(gameState) });
  }

  // Re-arm the turn clock, broadcast the new state, and queue the next hand if this one just ended
  publishState(room: Room, gameEngine: GameEngine): void {
    this.armTurnTimer(room, gameEngine);
    const gameState = gameEngine.getGameState();
    this.broadcastGameState(room, SOCKET_EVENTS.GAME_UPDATE, gameState);
    if (gameState.stage === 'showdown' && gameState.winners) {
      this.scheduleNextHand(room, gameEngine);
    }
  }

  // A manual action (or "I'm back") ends any sit-out
  playerIsActive(gameEngine: GameEngine, playerId: string): void {
    this.timeoutStreaks.delete(playerId);
    gameEngine.setSittingOut(playerId, false);
  }

  forgetPlayer(playerId: string): void {
    this.timeoutStreaks.delete(playerId);
  }

  clearTurnTimer(roomId: string): void {
    const timer = this.turnTimers.get(roomId);
    if (timer) clearTimeout(timer);
    this.turnTimers.delete(roomId);
  }

  // Starts a fresh countdown for whoever is to act; the deadline is sent to clients in the game state
  armTurnTimer(room: Room, gameEngine: GameEngine): void {
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

  private handleTurnTimeout(room: Room, gameEngine: GameEngine): void {
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

  scheduleNextHand(room: Room, gameEngine: GameEngine): void {
    // Give busted players time to rebuy while rebuys are still open
    const rebuyWindow = gameEngine.isRebuyOpen() && gameEngine.getBustedPlayers().length > 0;
    const delay = rebuyWindow ? GAME_CONFIG.REBUY_WINDOW_MS : 5000;
    setTimeout(() => {
      const tournamentWinner = gameEngine.getTournamentWinner();
      if (tournamentWinner) {
        room.endGame();
        this.io.to(room.id).to(spectatorChannel(room.id)).emit(SOCKET_EVENTS.GAME_ENDED, {
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
        this.io.to(room.id).to(spectatorChannel(room.id)).emit(SOCKET_EVENTS.GAME_ENDED, {
          reason: 'Not enough players to continue'
        });
        this.activeGames.delete(room.id);
      }
    }, delay);
  }
}
