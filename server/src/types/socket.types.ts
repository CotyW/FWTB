import { BettingAction } from '../../../shared/types/game.types';

// Socket event payload types
export interface CreateRoomPayload {
  playerName: string;
  config: {
    maxPlayers: number;
    startingChips: number;
    smallBlind: number;
    bigBlind: number;
  };
}

export interface JoinRoomPayload {
  roomCode: string;
  playerName: string;
}

export interface PlayerActionPayload {
  roomId: string;
  playerId: string;
  action: BettingAction;
}

export interface SocketResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}