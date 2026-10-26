import { HandEvaluator } from './HandEvaluator';
import { Card, Player, WinnerInfo } from '../../../../shared/types/game.types';

interface SidePot {
  amount: number;
  eligiblePlayers: Player[];
}

/**
 * Splits everything the players put in this hand into a main pot and side pots,
 * based on each player's total contribution. Chips from folded players stay in
 * the pots but they can't win them.
 */
export function buildPots(
  players: Player[],
  contributions: Map<string, number>,
  fallbackEligible: Player[]
): SidePot[] {
  const contributionOf = (player: Player) => contributions.get(player.id) || 0;
  const levels = Array.from(new Set(players.map(contributionOf).filter(amount => amount > 0)))
    .sort((a, b) => a - b);

  const pots: SidePot[] = [];
  let previousLevel = 0;

  for (const level of levels) {
    const contributors = players.filter(player => contributionOf(player) >= level);
    const eligiblePlayers = contributors.filter(player => !player.isFolded);
    const amount = (level - previousLevel) * contributors.length;
    const lastPot = pots[pots.length - 1];

    if (eligiblePlayers.length > 0) {
      pots.push({ amount, eligiblePlayers });
    } else if (lastPot) {
      lastPot.amount += amount;
    } else {
      pots.push({ amount, eligiblePlayers: fallbackEligible });
    }
    previousLevel = level;
  }

  return pots;
}

/**
 * Awards every pot to its best eligible hand(s), splitting ties (odd chips go to the
 * first winners). Mutates player chips and returns one entry per winning player.
 */
export function settleShowdown(
  players: Player[],
  communityCards: Card[],
  contributions: Map<string, number>,
  evaluator: HandEvaluator
): WinnerInfo[] {
  const activePlayers = players.filter(p => !p.isFolded);
  const hands = activePlayers.map(player => ({
    player,
    hand: evaluator.evaluateHand([...player.cards, ...communityCards])
  }));

  const handByPlayerId = new Map(hands.map(entry => [entry.player.id, entry.hand]));
  const winnings = new Map<string, number>();

  for (const pot of buildPots(players, contributions, activePlayers)) {
    const eligibleHands = hands.filter(({ player }) => pot.eligiblePlayers.includes(player));
    const bestHand = eligibleHands.reduce((best, entry) =>
      evaluator.compareHands(entry.hand, best) > 0 ? entry.hand : best,
    eligibleHands[0].hand);
    const winners = eligibleHands.filter(({ hand }) => evaluator.compareHands(hand, bestHand) === 0);
    const share = Math.floor(pot.amount / winners.length);
    const remainder = pot.amount % winners.length;

    winners.forEach(({ player }, index) => {
      const amount = share + (index < remainder ? 1 : 0);
      player.chips += amount;
      winnings.set(player.id, (winnings.get(player.id) || 0) + amount);
    });
  }

  return Array.from(winnings, ([playerId, amount]) => ({
    playerId,
    playerName: players.find(candidate => candidate.id === playerId)!.name,
    amount,
    handDescription: handByPlayerId.get(playerId)?.descr || 'Hand'
  }));
}
