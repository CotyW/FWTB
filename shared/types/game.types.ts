export interface Card {
  suit: 'hearts' | 'diamonds' | 'clubs' | 'spades';
  rank: '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A';
  value: number;
}

export interface Player {
  id: string;
  socketId: string;
  name: string;
  chips: number;
  cards: Card[];
  position: number;
  isFolded: boolean;
  isAllIn: boolean;
  currentBet: number;
  isReady?: boolean;
}

export interface GameState {
  roomId: string;
  players: Player[];
  communityCards: Card[];
  pot: number;
  currentBet: number;
  dealerPosition: number;
  currentPlayerIndex: number;
  stage: GameStage;
  smallBlind: number;
  bigBlind: number;
  handNumber: number;
  blindLevel: number;
  levelEndsAt: number;
  serverTime: number;
  rebuyOpen: boolean;
  minRaiseTo: number;
  turnEndsAt: number;
  winners?: WinnerInfo[];
}

// Wire format: cards are serialized to display strings (e.g. "A♠") before being sent to clients
export type PublicPlayer = Omit<Player, 'cards'> & { cards: string[] };

export type ClientGameState = Omit<GameState, 'players' | 'communityCards'> & {
  players: PublicPlayer[];
  communityCards: string[];
  message?: string;
};

export type GameStage = 'waiting' | 'preflop' | 'flop' | 'turn' | 'river' | 'showdown';

export interface WinnerInfo {
  playerId: string;
  playerName: string;
  amount: number;
  handDescription: string;
}

export interface BettingAction {
  type: 'fold' | 'check' | 'call' | 'raise' | 'all-in';
  amount?: number;
}

export interface Room {
  id: string;
  code: string;
  hostId: string;
  players: Player[];
  config: RoomConfig;
  status: 'waiting' | 'playing' | 'finished';
  createdAt: Date;
}

export interface RoomConfig {
  maxPlayers: number;
  startingChips: number;
  smallBlind: number;
  bigBlind: number;
  levelMinutes: number;
}

export interface GameConfig {
  startingChips: number;
  smallBlind: number;
  bigBlind: number;
  levelMinutes?: number;
  turnTimeout?: number; // seconds
}