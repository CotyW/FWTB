// Game constants for client-side use
export const GAME_CONSTANTS = {
  // Player limits
  MIN_PLAYERS: 2,
  MAX_PLAYERS: 6,
  
  // Chip values
  DEFAULT_STARTING_CHIPS: 1000,
  DEFAULT_SMALL_BLIND: 10,
  DEFAULT_BIG_BLIND: 20,
  
  // Timeouts (in milliseconds)
  ACTION_TIMEOUT: 30000,
  HAND_DELAY: 3000,
  ANIMATION_DURATION: 500,
  
  // Betting
  MIN_RAISE: 2, // Minimum raise is 2x
  MAX_RAISE: 10,
} as const;

// UI Constants
export const UI_CONSTANTS = {
  // Card display
  CARD_WIDTH: 80,
  CARD_HEIGHT: 120,
  CARD_BORDER_RADIUS: 8,
  
  // Chip sizes
  CHIP_SIZE: 50,
  CHIP_STACK_OFFSET: 15,
  
  // Animation timings (milliseconds)
  CARD_DEAL_DURATION: 300,
  CHIP_ANIMATION_DURATION: 500,
  POT_UPDATE_DURATION: 300,
  
  // Colors
  COLORS: {
    PRIMARY: '#1a472a',      // Dark green (poker table)
    SECONDARY: '#2d5a3d',    // Lighter green
    ACCENT: '#f39c12',       // Orange (chips)
    RED: '#e74c3c',
    GREEN: '#27ae60',
    WHITE: '#ffffff',
    BLACK: '#000000',
    GRAY: '#7f8c8d',
    LIGHT_GRAY: '#ecf0f1',
  },
  
  // Z-index layers
  Z_INDEX: {
    BACKGROUND: 0,
    TABLE: 1,
    PLAYER_SEATS: 2,
    CARDS: 3,
    CHIPS: 4,
    OVERLAY: 5,
    MODAL: 6,
    TOOLTIP: 7,
  },
} as const;

// Game stages
export const GAME_STAGES = {
  WAITING: 'waiting',
  PREFLOP: 'preflop',
  FLOP: 'flop',
  TURN: 'turn',
  RIVER: 'river',
  SHOWDOWN: 'showdown',
} as const;

// Betting actions
export const BETTING_ACTIONS = {
  FOLD: 'fold',
  CHECK: 'check',
  CALL: 'call',
  RAISE: 'raise',
  ALL_IN: 'all-in',
} as const;

// Hand rankings
export const HAND_RANKINGS = {
  HIGH_CARD: 'High Card',
  PAIR: 'Pair',
  TWO_PAIR: 'Two Pair',
  THREE_OF_A_KIND: 'Three of a Kind',
  STRAIGHT: 'Straight',
  FLUSH: 'Flush',
  FULL_HOUSE: 'Full House',
  FOUR_OF_A_KIND: 'Four of a Kind',
  STRAIGHT_FLUSH: 'Straight Flush',
  ROYAL_FLUSH: 'Royal Flush',
} as const;

// Card suits and ranks
export const CARD_SUITS = ['hearts', 'diamonds', 'clubs', 'spades'] as const;
export const CARD_RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'] as const;

// Room settings
export const ROOM_CONSTANTS = {
  CODE_LENGTH: 6,
  MAX_ROOM_AGE_MINUTES: 60,
} as const;
