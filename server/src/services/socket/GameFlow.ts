import { Server } from 'socket.io';
import { Room } from '../../models/Room';
import { GameEngine } from '../gameEngine/GameEngine';
import { SOCKET_EVENTS } from '../../../../shared/constants/socketEvents';
import { GAME_CONFIG } from '../../../../shared/constants/gameConfig';
import { BettingAction } from '../../../../shared/types/game.types';
import { logger } from '../../utils/logger';
import { serializeGameState } from './serializeGameState';

export const spectatorChannel = (roomId: string): string => `spectators:${roomId}`;

// What was frozen when the host paused: time left on the turn clock and on the queued next hand
interface PauseState {
  turnRemaining: number | null;
  nextHand: { remaining: number; run: () => void } | null;
}

/**
 * Drives a running game: per-player state broadcasts, the turn clock,
 * auto sit-out and scheduling of the next hand.
 */
export class GameFlow {
  private turnTimers: Map<string, NodeJS.Timeout> = new Map();
  private timeoutStreaks: Map<string, number> = new Map(); // playerId -> consecutive turn timeouts
  private nextHandTimers: Map<string, { timer: NodeJS.Timeout; dueAt: number; run: () => void }> = new Map();
  private pauses: Map<string, PauseState> = new Map();

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
      const paused = this.pauses.get(room.id);
      if (paused) paused.turnRemaining = null;
      return;
    }
    // Sitting-out players don't get the full clock; they are auto-checked/folded quickly
    const sittingOut = !!state.players[state.currentPlayerIndex]?.isSittingOut;
    const delay = sittingOut ? GAME_CONFIG.SITTING_OUT_DELAY_MS : GAME_CONFIG.TURN_TIME_MS;
    gameEngine.setTurnDeadline(Date.now() + delay);
    const pause = this.pauses.get(room.id);
    if (pause) {
      pause.turnRemaining = delay;
      return;
    }
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
    // Winning hand stays up; busted players get extra time to rebuy while rebuys are still open
    const rebuyWindow = gameEngine.isRebuyOpen() && gameEngine.getBustedPlayers().length > 0;
    const delay = GAME_CONFIG.SHOWDOWN_DISPLAY_MS + (rebuyWindow ? GAME_CONFIG.REBUY_WINDOW_MS : 0);
    this.queueNextHand(room, gameEngine, delay, () => this.startNextHand(room, gameEngine));
  }

  private queueNextHand(room: Room, gameEngine: GameEngine, delay: number, run: () => void): void {
    const existing = this.nextHandTimers.get(room.id);
    if (existing) clearTimeout(existing.timer);
    this.nextHandTimers.delete(room.id);

    gameEngine.setNextHandAt(Date.now() + delay);
    const pause = this.pauses.get(room.id);
    if (pause) {
      pause.nextHand = { remaining: delay, run };
      return;
    }
    const timer = setTimeout(() => {
      this.nextHandTimers.delete(room.id);
      gameEngine.setNextHandAt(0);
      run();
    }, delay);
    this.nextHandTimers.set(room.id, { timer, dueAt: Date.now() + delay, run });
  }

  // Freezes (or restores) the turn clock, the queued next hand and the blind-level clock
  setPaused(room: Room, gameEngine: GameEngine, paused: boolean): void {
    if (paused === this.pauses.has(room.id)) return;
    const now = Date.now();

    if (paused) {
      const entry: PauseState = { turnRemaining: null, nextHand: null };
      if (this.turnTimers.has(room.id)) {
        entry.turnRemaining = Math.max(0, gameEngine.getGameState().turnEndsAt - now);
      }
      this.clearTurnTimer(room.id);
      const queued = this.nextHandTimers.get(room.id);
      if (queued) {
        clearTimeout(queued.timer);
        this.nextHandTimers.delete(room.id);
        entry.nextHand = { remaining: Math.max(0, queued.dueAt - now), run: queued.run };
      }
      this.pauses.set(room.id, entry);
      gameEngine.pause();
      // Clients show the frozen remaining time relative to the frozen server clock
      if (entry.turnRemaining !== null) gameEngine.setTurnDeadline(now + entry.turnRemaining);
      if (entry.nextHand) gameEngine.setNextHandAt(now + entry.nextHand.remaining);
    } else {
      const entry = this.pauses.get(room.id)!;
      this.pauses.delete(room.id);
      gameEngine.resume();
      if (entry.turnRemaining !== null) {
        gameEngine.setTurnDeadline(Date.now() + entry.turnRemaining);
        this.turnTimers.set(
          room.id,
          setTimeout(() => this.handleTurnTimeout(room, gameEngine), entry.turnRemaining)
        );
      }
      if (entry.nextHand) this.queueNextHand(room, gameEngine, entry.nextHand.remaining, entry.nextHand.run);
    }

    this.broadcastGameState(room, SOCKET_EVENTS.GAME_UPDATE, gameEngine.getGameState());
  }

  private startNextHand(room: Room, gameEngine: GameEngine): void {
    {
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
    }
  }
}
