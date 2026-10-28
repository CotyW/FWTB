import { describe, it, expect } from 'vitest';
import { LevelClock } from '../src/services/gameEngine/LevelClock';
import { GameEngine } from '../src/services/gameEngine/GameEngine';
import { GAME_CONFIG } from '../../shared/constants/gameConfig';

describe('pausing', () => {
  it('freezes the blind-level clock and shifts the level end on resume', () => {
    let t = 0;
    const clock = new LevelClock(1, () => t); // 1 minute levels
    clock.start();
    t = 30_000;
    clock.pause();
    t = 90_000; // 60s pass while paused
    expect(clock.currentLevel()).toBe(1);
    expect(clock.snapshot().serverTime).toBe(30_000);
    clock.resume();
    expect(clock.snapshot().levelEndsAt).toBe(120_000);
    t = 119_000;
    expect(clock.currentLevel()).toBe(1);
    t = 120_000;
    expect(clock.currentLevel()).toBe(2);
  });

  it('rejects player actions while paused', () => {
    const players = ['a', 'b'].map((id, i) => ({
      id, socketId: id, name: id, chips: 1000, cards: [], position: i,
      isFolded: false, isAllIn: false, currentBet: 0, isReady: true
    }));
    const engine = new GameEngine('r', players as any, {
      smallBlind: 10, bigBlind: 20, startingChips: 1000, levelMinutes: 10
    } as any);
    engine.startHand();
    const state = engine.getGameState();
    const actor = state.players[state.currentPlayerIndex].id;
    engine.pause();
    expect(engine.getGameState().paused).toBe(true);
    expect(() => engine.handlePlayerAction(actor, { type: 'fold' } as any)).toThrow('paused');
    engine.resume();
    expect(() => engine.handlePlayerAction(actor, { type: 'fold' } as any)).not.toThrow();
  });

  it('shows the winning hand 10s and gives busted players a further 60s', () => {
    expect(GAME_CONFIG.SHOWDOWN_DISPLAY_MS).toBe(10000);
    expect(GAME_CONFIG.REBUY_WINDOW_MS).toBe(60000);
  });
});
