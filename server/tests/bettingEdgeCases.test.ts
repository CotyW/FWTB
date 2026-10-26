import { describe, it, expect } from 'vitest';
import { GameEngine } from '../src/services/gameEngine/GameEngine';

const createEngine = (names: string[], chips: number[] = []) => {
  const engine = new GameEngine(
    'room',
    names.map((name, position) => ({
      id: name,
      name,
      chips: chips[position] ?? 1000,
      cards: [],
      position,
      isFolded: false,
      isAllIn: false,
      currentBet: 0
    })) as any,
    { startingChips: 1000, smallBlind: 10, bigBlind: 20, levelMinutes: 10, maxPlayers: 6 } as any
  );
  const internals = engine as any;
  chips.forEach((amount, i) => (internals.gameState.players[i].chips = amount));
  engine.now = () => 0;
  return engine;
};

const state = (engine: GameEngine) => engine.getGameState();
const current = (engine: GameEngine) => state(engine).players[state(engine).currentPlayerIndex];
const act = (engine: GameEngine, type: string, amount?: number) =>
  engine.handlePlayerAction(current(engine).id, { type, amount } as any);

// A (dealer), B, C all see the flop; B acts first. C has a short stack (55 left after the big blind).
const toFlop = (chips: number[]) => {
  const engine = createEngine(['A', 'B', 'C'], chips);
  engine.startHand();
  act(engine, 'call');
  act(engine, 'call');
  act(engine, 'check');
  expect(state(engine).stage).toBe('flop');
  expect(current(engine).id).toBe('B');
  return engine;
};

describe('short all-ins do not re-open betting', () => {
  it('locks out players who already acted, but not players yet to act', () => {
    const engine = toFlop([1000, 1000, 75]);
    act(engine, 'raise', 40);
    act(engine, 'all-in'); // C: 55 total, only 15 more than B's 40 (a short raise)
    expect(state(engine).currentBet).toBe(55);

    // A has not acted yet, so A may still raise (a full raise: at least 40 more)
    expect(current(engine).id).toBe('A');
    expect(state(engine).canRaise).toBe(true);
    expect(state(engine).minRaiseTo).toBe(95);
    act(engine, 'call');

    // B already bet and only faces a short all-in: call or fold only
    expect(current(engine).id).toBe('B');
    expect(state(engine).canRaise).toBe(false);
    expect(() => act(engine, 'raise', 200)).toThrow(/not re-opened/);
    expect(() => act(engine, 'all-in')).toThrow(/not re-opened/);
    act(engine, 'call');
    expect(state(engine).stage).toBe('turn');
    expect(state(engine).canRaise).toBe(true);
  });

  it('a full raise re-opens the betting for everyone', () => {
    const engine = toFlop([1000, 1000, 1000]);
    act(engine, 'raise', 40);
    act(engine, 'raise', 100);
    act(engine, 'call');
    expect(current(engine).id).toBe('B');
    expect(state(engine).canRaise).toBe(true);
    act(engine, 'raise', 200);
    expect(state(engine).currentBet).toBe(200);
  });

  it('keeps the previous minimum raise after a short all-in', () => {
    const engine = toFlop([1000, 1000, 75]);
    act(engine, 'raise', 40);
    act(engine, 'all-in');
    expect(state(engine).minRaiseTo).toBe(55 + 40);
  });
});

describe('players leaving mid-hand', () => {
  it('folds the leaver on their turn and passes the action on', () => {
    const engine = createEngine(['A', 'B', 'C']);
    engine.startHand();
    expect(current(engine).id).toBe('A');
    engine.forfeitPlayer('A');
    expect(state(engine).players[0].isFolded).toBe(true);
    expect(current(engine).id).toBe('B');
  });

  it('folds the leaver out of turn without stalling the hand', () => {
    const engine = createEngine(['A', 'B', 'C']);
    engine.startHand();
    engine.forfeitPlayer('C');
    expect(state(engine).players[2].isFolded).toBe(true);
    expect(current(engine).id).toBe('A');
    act(engine, 'call');
    act(engine, 'call');
    expect(state(engine).stage).toBe('flop');
  });

  it('ends the hand when everyone else leaves', () => {
    const engine = createEngine(['A', 'B', 'C']);
    engine.startHand();
    engine.forfeitPlayer('B');
    engine.forfeitPlayer('C');
    const s = state(engine);
    expect(s.stage).toBe('showdown');
    expect(s.winners?.[0]).toMatchObject({ playerId: 'A', handDescription: 'Won by fold' });
    expect(engine.getTournamentWinner()?.id).toBe('A');
  });

  it('drops the leaver before the next hand and does not offer them a rebuy', () => {
    const engine = createEngine(['A', 'B', 'C']);
    engine.startHand();
    engine.forfeitPlayer('C');
    act(engine, 'fold'); // A
    act(engine, 'fold'); // B leaves C (already gone) with no opponents; hand ends
    expect(state(engine).stage).toBe('showdown');
    expect(engine.getBustedPlayers().map(p => p.id)).not.toContain('C');
    engine.nextHand();
    expect(state(engine).players.map(p => p.id)).not.toContain('C');
  });

  it('does not fold an all-in player who leaves', () => {
    const engine = createEngine(['A', 'B', 'C']);
    engine.startHand();
    act(engine, 'all-in'); // A
    engine.forfeitPlayer('A');
    expect(state(engine).players[0].isFolded).toBe(false);
    expect(state(engine).players[0].isDisconnected).toBe(true);
  });
});
