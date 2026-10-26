// Game Configuration Constants
export const GAME_CONFIG = {
  MIN_PLAYERS: 2,
  MAX_PLAYERS: 6,
  DEFAULT_STARTING_CHIPS: 1000,
  DEFAULT_SMALL_BLIND: 10,
  DEFAULT_BIG_BLIND: 20,
  TURN_TIMEOUT: 30, // seconds
  HAND_DELAY: 3000, // milliseconds between hands
  DEFAULT_LEVEL_MINUTES: 10,
  MIN_LEVEL_MINUTES: 1,
  MAX_LEVEL_MINUTES: 60,
  REBUY_LEVELS: 4, // rebuys allowed while the blind level is at or below this
  REBUY_WINDOW_MS: 15000, // time busted players get to rebuy between hands
  TURN_TIME_MS: 30000, // time a player has to act before being auto-checked/folded
  MIN_STARTING_CHIPS: 100,
  MAX_STARTING_CHIPS: 1000000,
  AUTO_SIT_OUT_TIMEOUTS: 2, // consecutive turn timeouts before a player is sat out
  SITTING_OUT_DELAY_MS: 1500, // how long a sitting-out player's turn lasts before auto-acting
} as const;

// Clamp a requested starting stack to the allowed range
export function clampStartingChips(value: unknown): number {
  const chips = Math.round(Number(value));
  if (!Number.isFinite(chips)) return GAME_CONFIG.DEFAULT_STARTING_CHIPS;
  return Math.min(GAME_CONFIG.MAX_STARTING_CHIPS, Math.max(GAME_CONFIG.MIN_STARTING_CHIPS, chips));
}

// Starting blinds scale with the stack: big blind is ~1/50 of it (1000 chips -> 10/20), rounded to a 1/2/5 step
export function blindsForStack(startingChips: number): { smallBlind: number; bigBlind: number } {
  const target = Math.max(2, startingChips / 50);
  const magnitude = Math.pow(10, Math.floor(Math.log10(target)));
  const step = [1, 2, 5, 10].find(s => s * magnitude >= target * 0.9) ?? 10;
  const bigBlind = Math.max(2, step * magnitude);
  return { smallBlind: Math.max(1, Math.floor(bigBlind / 2)), bigBlind };
}

// Multipliers applied to the starting blinds for each level; the last one keeps doubling
export const BLIND_SCHEDULE = [1, 1.5, 2.5, 5, 7.5, 10, 15, 20, 30, 40, 50, 75, 100] as const;

// Chip Denominations for UI
export const CHIP_COLORS = {
  1: '#FFFFFF',      // White
  5: '#FF0000',      // Red
  10: '#0000FF',     // Blue
  25: '#00FF00',     // Green
  100: '#000000',    // Black
  500: '#800080',    // Purple
  1000: '#FFA500',   // Orange
} as const;

// Card Suits and Ranks
export const SUITS = ['hearts', 'diamonds', 'clubs', 'spades'] as const;
export const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'] as const;

// Betting Limits
export const BETTING = {
  MIN_RAISE_MULTIPLIER: 2, // Minimum raise is 2x the previous bet
  MAX_RAISE_MULTIPLIER: 10, // Maximum raise is 10x the pot (for UI slider)
} as const;

// Room Settings
export const ROOM = {
  CODE_LENGTH: 6,
  CODE_CHARS: 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', // Excluding similar looking chars
  MAX_ROOM_AGE_HOURS: 24, // Clean up rooms older than 24 hours
} as const;
