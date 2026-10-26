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
} as const;

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
