import { describe, it, expect } from 'vitest';
import { blindsForStack, clampStartingChips, GAME_CONFIG } from '../../shared/constants/gameConfig';

describe('starting stack settings', () => {
  it('keeps the default 10/20 blinds for a 1000 stack', () => {
    expect(blindsForStack(1000)).toEqual({ smallBlind: 10, bigBlind: 20 });
  });

  it('scales blinds with the stack using clean values', () => {
    expect(blindsForStack(500)).toEqual({ smallBlind: 5, bigBlind: 10 });
    expect(blindsForStack(2500)).toEqual({ smallBlind: 25, bigBlind: 50 });
    expect(blindsForStack(10000)).toEqual({ smallBlind: 100, bigBlind: 200 });
    expect(blindsForStack(100).bigBlind).toBeGreaterThanOrEqual(2);
  });

  it('always gives a big blind well below the stack and twice the small blind', () => {
    for (const stack of [100, 333, 750, 1234, 3000, 50000, 1000000]) {
      const { smallBlind, bigBlind } = blindsForStack(stack);
      expect(bigBlind).toBe(smallBlind * 2);
      expect(bigBlind).toBeLessThan(stack / 20);
    }
  });

  it('clamps and sanitises the requested stack', () => {
    expect(clampStartingChips(5)).toBe(GAME_CONFIG.MIN_STARTING_CHIPS);
    expect(clampStartingChips(99999999)).toBe(GAME_CONFIG.MAX_STARTING_CHIPS);
    expect(clampStartingChips('2500')).toBe(2500);
    expect(clampStartingChips(undefined)).toBe(GAME_CONFIG.DEFAULT_STARTING_CHIPS);
    expect(clampStartingChips(1234.6)).toBe(1235);
  });
});
