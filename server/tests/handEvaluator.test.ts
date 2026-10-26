import { describe, it, expect } from 'vitest';
import { HandEvaluator } from '../src/services/gameEngine/HandEvaluator';

const SUITS: Record<string, string> = { h: 'hearts', d: 'diamonds', c: 'clubs', s: 'spades' };
const VALUES: Record<string, number> = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, J: 11, Q: 12, K: 13, A: 14
};
const cards = (codes: string[]) =>
  codes.map(code => {
    const rank = code.slice(0, -1);
    return { rank, suit: SUITS[code.slice(-1)], value: VALUES[rank] } as any;
  });

const evaluator = new HandEvaluator();
const board = ['3c', '7d', '9h', 'Js', '5c'];

describe('HandEvaluator', () => {
  it('recognises hands containing a ten', () => {
    const hand = evaluator.evaluateHand(cards(['10h', 'Jh', 'Qh', 'Kh', 'Ah']));
    expect(hand.descr).toBe('Royal Flush');
    expect(hand.rank).toBe(9);
  });

  it('ranks hand categories', () => {
    const pair = evaluator.evaluateHand(cards(['Ah', 'Ad', ...board]));
    const high = evaluator.evaluateHand(cards(['2h', '4d', ...board]));
    expect(evaluator.compareHands(pair, high)).toBeGreaterThan(0);
    expect(evaluator.compareHands(high, pair)).toBeLessThan(0);
  });

  it('breaks ties within the same category', () => {
    const aces = evaluator.evaluateHand(cards(['Ah', 'Ad', ...board]));
    const kings = evaluator.evaluateHand(cards(['Kh', 'Kd', ...board]));
    expect(evaluator.compareHands(aces, kings)).toBeGreaterThan(0);
    expect(evaluator.compareHands(kings, aces)).toBeLessThan(0);
  });

  it('breaks ties by kicker', () => {
    const shared = ['Ad', '3c', '7d', '9h', '5c'];
    const better = evaluator.evaluateHand(cards(['Ah', 'Kd', ...shared]));
    const worse = evaluator.evaluateHand(cards(['As', 'Qd', ...shared]));
    expect(evaluator.compareHands(better, worse)).toBeGreaterThan(0);
    expect(evaluator.compareHands(worse, better)).toBeLessThan(0);
  });

  it('treats identical hands as a tie', () => {
    const a = evaluator.evaluateHand(cards(['2h', '3d', '4c', '5s', '6h', '9d', 'Kc']));
    const b = evaluator.evaluateHand(cards(['2d', '3s', '4h', '5c', '6d', '9s', 'Kh']));
    expect(evaluator.compareHands(a, b)).toBe(0);
  });
});
