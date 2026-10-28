import { describe, it, expect } from 'vitest';
import { GameEngine } from '../src/services/gameEngine/GameEngine';
import { clampBlinds, GAME_CONFIG } from '../../shared/constants/gameConfig';

const makeEngine = (startingChips: number, smallBlind: number, bigBlind: number) => {
  const players = ['a', 'b'].map((id, i) => ({
    id, socketId: id, name: id, chips: startingChips, cards: [], position: i,
    isFolded: false, isAllIn: false, currentBet: 0, isReady: true
  }));
  return new GameEngine('r', players as any, { smallBlind, bigBlind, startingChips, levelMinutes: 10 } as any);
};

describe('custom blinds', () => {
  it('allows a 10k stack with 10/20 blinds', () => {
    expect(clampBlinds(10, 20, 10000)).toEqual({ smallBlind: 10, bigBlind: 20 });
    const engine = makeEngine(10000, 10, 20);
    engine.startHand();
    const s = engine.getGameState();
    expect([s.smallBlind, s.bigBlind]).toEqual([10, 20]);
    expect(s.players.reduce((n, p) => n + p.chips + p.currentBet, 0)).toBe(20000);
  });

  it('sanitises nonsense blinds', () => {
    expect(clampBlinds(50, 20, 1000)).toEqual({ smallBlind: 20, bigBlind: 20 });
    expect(clampBlinds(0, 0, 1000)).toEqual({ smallBlind: 1, bigBlind: 2 });
    expect(clampBlinds(5, 5000, 1000)).toEqual({ smallBlind: 5, bigBlind: 1000 });
    expect(clampBlinds('x', undefined, 1000)).toEqual({ smallBlind: 10, bigBlind: 20 });
  });
});

describe('host blind adjustment', () => {
  it('shows pending blinds and applies them on the next hand only', () => {
    const engine = makeEngine(1000, 10, 20);
    engine.startHand();
    engine.adjustBlinds(1);
    let s = engine.getGameState();
    expect([s.smallBlind, s.bigBlind]).toEqual([10, 20]);
    expect([s.nextSmallBlind, s.nextBigBlind]).toEqual([15, 30]);
    engine.startHand();
    s = engine.getGameState();
    expect([s.smallBlind, s.bigBlind]).toEqual([15, 30]);
  });

  it('can lower back down but never below the first level', () => {
    const engine = makeEngine(1000, 10, 20);
    engine.startHand();
    engine.adjustBlinds(-1);
    expect(engine.getGameState().nextBigBlind).toBe(20);
    engine.adjustBlinds(1);
    engine.adjustBlinds(1);
    engine.adjustBlinds(-1);
    expect(engine.getGameState().nextBigBlind).toBe(30);
  });

  it('caps how high the host can push the blinds', () => {
    const engine = makeEngine(1000, 10, 20);
    for (let i = 0; i < 100; i++) engine.adjustBlinds(1);
    const capped = engine.getGameState().nextBigBlind;
    engine.adjustBlinds(1);
    expect(engine.getGameState().nextBigBlind).toBe(capped);
    expect(GAME_CONFIG.MAX_BLIND_LEVEL).toBe(30);
  });
});
