import type { Card } from '../../../shared/types/game.types';

/**
 * Convert card rank to display name
 */
export function getRankDisplay(rank: string): string {
  const rankMap: Record<string, string> = {
    '2': '2',
    '3': '3',
    '4': '4',
    '5': '5',
    '6': '6',
    '7': '7',
    '8': '8',
    '9': '9',
    '10': 'T',
    'J': 'J',
    'Q': 'Q',
    'K': 'K',
    'A': 'A'
  };
  return rankMap[rank] || rank;
}

/**
 * Get Unicode suit symbol
 */
export function getSuitSymbol(suit: string): string {
  const suitMap: Record<string, string> = {
    'hearts': '♥',
    'diamonds': '♦',
    'clubs': '♣',
    'spades': '♠'
  };
  return suitMap[suit] || suit;
}

/**
 * Get suit color for CSS styling
 */
export function getSuitColor(suit: string): string {
  const colorMap: Record<string, string> = {
    'hearts': '#E63946',    // Red
    'diamonds': '#E63946',  // Red
    'clubs': '#000000',     // Black
    'spades': '#000000'     // Black
  };
  return colorMap[suit] || '#000000';
}

/**
 * Get background color for suit
 */
export function getSuitBackgroundColor(suit: string): string {
  const bgMap: Record<string, string> = {
    'hearts': '#FFE8EC',
    'diamonds': '#FFE8EC',
    'clubs': '#F0F0F0',
    'spades': '#F0F0F0'
  };
  return bgMap[suit] || '#FFFFFF';
}

/**
 * Format card for display (e.g., "A♠")
 */
export function formatCard(card: Card): string {
  return `${getRankDisplay(card.rank)}${getSuitSymbol(card.suit)}`;
}

/**
 * Format multiple cards as string (e.g., "A♠ K♥ Q♦")
 */
export function formatCards(cards: Card[]): string {
  return cards.map(formatCard).join(' ');
}

/**
 * Get card background class for styling
 */
export function getCardClass(card: Card): string {
  const suit = card.suit.toLowerCase();
  const rank = card.rank.toLowerCase();
  return `card card-${suit} card-${rank}`;
}

/**
 * Check if card is red suit
 */
export function isRedSuit(suit: string): boolean {
  return suit === 'hearts' || suit === 'diamonds';
}

/**
 * Get rank value for comparison
 */
export function getRankValue(rank: string): number {
  const valueMap: Record<string, number> = {
    '2': 2,
    '3': 3,
    '4': 4,
    '5': 5,
    '6': 6,
    '7': 7,
    '8': 8,
    '9': 9,
    '10': 10,
    'J': 11,
    'Q': 12,
    'K': 13,
    'A': 14
  };
  return valueMap[rank] || 0;
}

/**
 * Sort cards by rank (high to low)
 */
export function sortCardsByRank(cards: Card[]): Card[] {
  return [...cards].sort((a, b) => getRankValue(b.rank) - getRankValue(a.rank));
}

/**
 * Group cards by suit
 */
export function groupCardsBySuit(cards: Card[]): Record<string, Card[]> {
  const groups: Record<string, Card[]> = {
    hearts: [],
    diamonds: [],
    clubs: [],
    spades: []
  };

  cards.forEach(card => {
    groups[card.suit].push(card);
  });

  return groups;
}
