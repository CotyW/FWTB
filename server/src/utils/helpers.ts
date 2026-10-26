// server/src/utils/logger.ts
export class Logger {
  static info(message: string, ...args: any[]) {
    console.log(`[INFO] ${new Date().toISOString()} - ${message}`, ...args);
  }

  static error(message: string, ...args: any[]) {
    console.error(`[ERROR] ${new Date().toISOString()} - ${message}`, ...args);
  }

  static warn(message: string, ...args: any[]) {
    console.warn(`[WARN] ${new Date().toISOString()} - ${message}`, ...args);
  }

  static debug(message: string, ...args: any[]) {
    if (process.env.NODE_ENV === 'development') {
      console.debug(`[DEBUG] ${new Date().toISOString()} - ${message}`, ...args);
    }
  }
}

// server/src/utils/helpers.ts
export const generateId = (): string => {
  return Math.random().toString(36).substring(2, 15) + 
         Math.random().toString(36).substring(2, 15);
};

export const delay = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

export const formatCurrency = (amount: number): string => {
  return `$${amount.toLocaleString()}`;
};

// client/src/utils/cardUtils.ts
import { Card } from '../../../shared/types/game.types';

export const getSuitSymbol = (suit: Card['suit']): string => {
  const symbols: Record<Card['suit'], string> = {
    hearts: '♥',
    diamonds: '♦',
    clubs: '♣',
    spades: '♠'
  };
  return symbols[suit];
};

export const getSuitColor = (suit: Card['suit']): 'red' | 'black' => {
  return suit === 'hearts' || suit === 'diamonds' ? 'red' : 'black';
};

export const formatCardRank = (rank: string): string => {
  return rank;
};

// client/src/utils/constants.ts
export const GAME_CONSTANTS = {
  MIN_PLAYERS: 2,
  MAX_PLAYERS: 9,
  DEFAULT_STARTING_CHIPS: 1000,
  DEFAULT_SMALL_BLIND: 10,
  DEFAULT_BIG_BLIND: 20,
  TURN_TIMEOUT: 30, // seconds
};

export const CARD_SUITS = ['hearts', 'diamonds', 'clubs', 'spades'] as const;
export const CARD_RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'] as const;