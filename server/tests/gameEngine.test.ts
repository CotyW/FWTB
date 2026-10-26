import { describe, it, expect } from 'vitest';
import { GameEngine } from '../src/services/gameEngine/GameEngine';
import { GAME_CONFIG } from '../../shared/constants/gameConfig';

const SUITS: Record<string, string> = { h: 'hearts', d: 'diamonds', c: 'clubs', s: 'spades' };
const VALUES: Record<string, number> = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, J: 11, Q: 12, K: 13, A: 14
};

// 'Ah' -> ace of hearts
const card = (code: string) => {
  const rank = code.slice(0, -1);
  return { rank, suit: SUITS[code.slice(-1)], value: VALUES[rank] };
};

interface Options {
  chips?: number[];
  smallBlind?: number;
  bigBlind?: number;
  levelMinutes?: number;
  startingChips?: number;
}

const createEngine = (names: string[], options: Options = {}) => {
  const startingChips = options.startingChips ?? 1000;
  const engine = new GameEngine(
    'room',
    names.map((name, position) => ({
      id: name,
      name,
      chips: startingChips,
      cards: [],
      position,
      isFolded: false,
      isAllIn: false,
      currentBet: 0
    })) as any,
    {
      startingChips,
      smallBlind: options.smallBlind ?? 10,
      bigBlind: options.bigBlind ?? 20,
      levelMinutes: options.levelMinutes ?? 10,
      maxPlayers: 6
    } as any
  );
  const internals = engine as any;
  options.chips?.forEach((chips, i) => (internals.gameState.players[i].chips = chips));
  const clock = { time: 0 };
  engine.now = () => clock.time;
  return { engine, internals, clock };
};

// Deal order: each player's two hole cards in seat order, then flop (3), turn, river
const stackDeck = (engine: GameEngine, codes: string[]) => {
  const queue = codes.map(card);
  (engine as any).deck = {
    shuffle: () => undefined,
    drawCard: () => {
      const next = queue.shift();
      if (!next) throw new Error('Stacked deck ran out of cards');
      return next;
    }
  };
};

const state = (engine: GameEngine) => engine.getGameState();
const current = (engine: GameEngine) => state(engine).players[state(engine).currentPlayerIndex];
const act = (engine: GameEngine, type: string, amount?: number) =>
  engine.handlePlayerAction(current(engine).id, { type, amount } as any);
const chipsOf = (engine: GameEngine) =>
  Object.fromEntries(state(engine).players.map(p => [p.id, p.chips]));

const BOARD = ['3c', '7d', '9h', 'Js', '5c'];

describe('blinds and turn order', () => {
  it('three players: dealer acts first, then small and big blind', () => {
    const { engine } = createEngine(['A', 'B', 'C']);
    engine.startHand();
    const s = state(engine);
    expect(s.players.map(p => p.currentBet)).toEqual([0, 10, 20]);
    expect(s.pot).toBe(30);
    expect(current(engine).id).toBe('A');
  });

  it('heads-up: dealer is the small blind and acts first preflop', () => {
    const { engine } = createEngine(['A', 'B']);
    engine.startHand();
    expect(state(engine).players.map(p => p.currentBet)).toEqual([10, 20]);
    expect(current(engine).id).toBe('A');
  });

  it('heads-up: big blind keeps the option after the small blind calls', () => {
    const { engine } = createEngine(['A', 'B']);
    engine.startHand();
    act(engine, 'call');
    expect(state(engine).stage).toBe('preflop');
    expect(current(engine).id).toBe('B');
    act(engine, 'check');
    expect(state(engine).stage).toBe('flop');
  });

  it('heads-up: big blind acts first after the flop', () => {
    const { engine } = createEngine(['A', 'B']);
    engine.startHand();
    act(engine, 'call');
    act(engine, 'check');
    expect(current(engine).id).toBe('B');
  });

  it('works with 2 to 6 players', () => {
    for (const names of [['A', 'B'], ['A', 'B', 'C', 'D', 'E', 'F']]) {
      const { engine } = createEngine(names);
      engine.startHand();
      expect(state(engine).pot).toBe(30);
    }
  });
});

describe('folding', () => {
  it('ends the hand immediately when everyone else folds', () => {
    const { engine } = createEngine(['A', 'B', 'C']);
    engine.startHand();
    act(engine, 'fold');
    act(engine, 'fold');
    const s = state(engine);
    expect(s.stage).toBe('showdown');
    expect(s.winners?.[0]).toMatchObject({ playerId: 'C', amount: 30, handDescription: 'Won by fold' });
    expect(chipsOf(engine)).toEqual({ A: 1000, B: 990, C: 1010 });
  });
});

describe('raise rules', () => {
  it('rejects raises smaller than the last raise and tracks the new minimum', () => {
    const { engine } = createEngine(['A', 'B', 'C']);
    engine.startHand();
    expect(state(engine).minRaiseTo).toBe(40);
    expect(() => act(engine, 'raise', 30)).toThrow(/Minimum raise is to 40/);
    act(engine, 'raise', 40);
    expect(state(engine).minRaiseTo).toBe(60);
    expect(() => act(engine, 'raise', 50)).toThrow(/Minimum raise is to 60/);
    act(engine, 'raise', 100);
    expect(state(engine).minRaiseTo).toBe(160);
  });

  it('allows a short raise when it is all in', () => {
    const { engine } = createEngine(['A', 'B', 'C'], { chips: [30, 1000, 1000] });
    engine.startHand();
    expect(() => act(engine, 'raise', 30)).not.toThrow();
  });

  it('resets the minimum raise on each new street', () => {
    const { engine } = createEngine(['A', 'B', 'C']);
    engine.startHand();
    act(engine, 'raise', 100);
    act(engine, 'call');
    act(engine, 'call');
    expect(state(engine).stage).toBe('flop');
    expect(state(engine).minRaiseTo).toBe(20);
  });
});

describe('side pots', () => {
  it('pays each pot to the best eligible hand and returns uncalled chips', () => {
    const { engine } = createEngine(['A', 'B', 'C'], { chips: [100, 200, 300] });
    // A: pocket aces, B: pocket kings, C: pocket deuces
    stackDeck(engine, ['Ah', 'Ad', 'Kh', 'Kd', '2h', '2d', ...BOARD]);
    engine.startHand();
    act(engine, 'all-in');
    act(engine, 'all-in');
    act(engine, 'all-in');

    const s = state(engine);
    expect(s.stage).toBe('showdown');
    expect(s.pot).toBe(600);
    // Main pot 300 -> A, side pot 200 -> B, C's uncalled 100 comes back
    expect(chipsOf(engine)).toEqual({ A: 300, B: 200, C: 100 });
    expect(Object.values(chipsOf(engine)).reduce((a, b) => a + b, 0)).toBe(600);
  });

  it('splits a pot between tied hands', () => {
    const { engine } = createEngine(['A', 'B']);
    // Both play the board straight
    stackDeck(engine, ['2h', '3d', '2c', '3s', '5h', '6d', '7c', '8s', '4h']);
    engine.startHand();
    act(engine, 'all-in');
    act(engine, 'all-in');
    expect(state(engine).stage).toBe('showdown');
    expect(chipsOf(engine)).toEqual({ A: 1000, B: 1000 });
  });
});

describe('tournament flow', () => {
  const bustPlayerB = () => {
    const ctx = createEngine(['A', 'B']);
    stackDeck(ctx.engine, ['Ah', 'Ad', '2h', '2d', ...BOARD]);
    ctx.engine.startHand();
    act(ctx.engine, 'all-in');
    act(ctx.engine, 'all-in');
    return ctx;
  };

  it('declares a winner when one player holds all the chips', () => {
    const { engine } = bustPlayerB();
    expect(chipsOf(engine)).toEqual({ A: 2000, B: 0 });
    expect(engine.getTournamentWinner()?.id).toBe('A');
    expect(() => engine.nextHand()).toThrow();
  });

  it('removes busted players and keeps the dealer rotating on the next hand', () => {
    const { engine } = createEngine(['A', 'B', 'C']);
    engine.startHand();
    act(engine, 'fold');
    act(engine, 'fold');
    (engine as any).gameState.players[1].chips = 0;
    engine.nextHand();
    const s = state(engine);
    expect(s.players.map(p => p.id)).toEqual(['A', 'C']);
    expect(s.dealerPosition).toBe(1);
  });
});

describe('blind levels', () => {
  it('advances levels on the timer and follows the blind schedule', () => {
    const { engine, clock } = createEngine(['A', 'B'], { levelMinutes: 5 });
    expect(engine.getCurrentLevel()).toBe(1);
    engine.startHand();
    expect(state(engine).bigBlind).toBe(20);

    clock.time = 5 * 60_000 - 1;
    expect(engine.getCurrentLevel()).toBe(1);
    clock.time = 5 * 60_000;
    expect(engine.getCurrentLevel()).toBe(2);

    const expectedBigBlinds = [20, 30, 50, 100, 150, 200];
    expectedBigBlinds.forEach((bigBlind, i) => {
      clock.time = i * 5 * 60_000;
      (engine as any).gameState.stage = 'showdown';
      (engine as any).startHand();
      expect(state(engine).blindLevel).toBe(i + 1);
      expect(state(engine).bigBlind).toBe(bigBlind);
    });
  });

  it('only changes blinds when the next hand starts', () => {
    const { engine, clock } = createEngine(['A', 'B'], { levelMinutes: 1 });
    engine.startHand();
    clock.time = 2 * 60_000;
    expect(state(engine).bigBlind).toBe(20);
    expect(engine.getCurrentLevel()).toBe(3);
  });

  it('reports when the current level ends', () => {
    const { engine, clock } = createEngine(['A', 'B'], { levelMinutes: 10 });
    engine.startHand();
    clock.time = 4 * 60_000;
    const s = state(engine);
    expect(s.levelEndsAt - s.serverTime).toBe(6 * 60_000);
  });

  it('keeps doubling after the end of the schedule', () => {
    const { engine, clock } = createEngine(['A', 'B'], { levelMinutes: 1 });
    engine.startHand();
    clock.time = 13 * 60_000;
    (engine as any).startHand();
    expect(state(engine).blindLevel).toBe(14);
    expect(state(engine).bigBlind).toBe(20 * 200);
  });
});

describe('rebuys', () => {
  const bustedAtShowdown = (levelMinutes = 5) => {
    const ctx = createEngine(['A', 'B', 'C'], { levelMinutes });
    ctx.engine.startHand();
    ctx.internals.gameState.stage = 'showdown';
    ctx.internals.gameState.players[0].chips = 0;
    return ctx;
  };

  it('restores the starting stack for a busted player through level 4', () => {
    const { engine, clock } = bustedAtShowdown();
    clock.time = 4 * 5 * 60_000 - 1;
    expect(engine.isRebuyOpen()).toBe(true);
    expect(state(engine).rebuyOpen).toBe(true);
    engine.rebuy('A');
    expect(chipsOf(engine).A).toBe(1000);
  });

  it('closes rebuys at level 5', () => {
    const { engine, clock } = bustedAtShowdown();
    clock.time = 4 * 5 * 60_000;
    expect(engine.isRebuyOpen()).toBe(false);
    expect(() => engine.rebuy('A')).toThrow(new RegExp(`closed after level ${GAME_CONFIG.REBUY_LEVELS}`));
  });

  it('rejects rebuys from players who still have chips', () => {
    const { engine } = bustedAtShowdown();
    expect(() => engine.rebuy('B')).toThrow(/still have chips/);
  });

  it('rejects rebuys in the middle of a hand', () => {
    const { engine, internals } = bustedAtShowdown();
    internals.gameState.stage = 'flop';
    expect(() => engine.rebuy('A')).toThrow(/between hands/);
  });

  it('lists busted players', () => {
    const { engine } = bustedAtShowdown();
    expect(engine.getBustedPlayers().map(p => p.id)).toEqual(['A']);
  });
});
