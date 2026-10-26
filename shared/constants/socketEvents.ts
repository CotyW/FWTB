// Socket Event Names
// Centralized constant definitions for all socket events
// Used by both client and server to ensure consistency

export const SOCKET_EVENTS = {
  // Connection Events
  CONNECTION: 'connection',
  DISCONNECT: 'disconnect',
  CONNECT_ERROR: 'connect_error',
  
  // Room Management Events
  CREATE_ROOM: 'create_room',
  JOIN_ROOM: 'join_room',
  SPECTATE_ROOM: 'spectate_room',
  SPECTATE_JOINED: 'spectate_joined',
  LEAVE_ROOM: 'leave_room',
  ROOM_CREATED: 'room_created',
  ROOM_JOINED: 'room_joined',
  PLAYER_JOINED: 'player_joined',
  PLAYER_LEFT: 'player_left',
  ROOM_UPDATE: 'room_update',
  
  // Game Lifecycle Events
  START_GAME: 'start_game',
  UPDATE_SETTINGS: 'update_settings',
  REBUY: 'rebuy',
  SIT_IN: 'sit_in',
  GAME_STARTED: 'game_started',
  GAME_UPDATE: 'game_update',
  HAND_COMPLETE: 'hand_complete',
  NEXT_HAND: 'next_hand',
  GAME_ENDED: 'game_ended',
  
  // Player Action Events
  PLAYER_ACTION: 'player_action',
  PLAYER_FOLD: 'player_fold',
  PLAYER_CHECK: 'player_check',
  PLAYER_CALL: 'player_call',
  PLAYER_RAISE: 'player_raise',
  PLAYER_ALL_IN: 'player_all_in',
  
  // Game State Events
  DEAL_CARDS: 'deal_cards',
  FLOP: 'flop',
  TURN: 'turn',
  RIVER: 'river',
  SHOWDOWN: 'showdown',
  
  // Error Events
  ERROR: 'error',
  ROOM_ERROR: 'room_error',
  GAME_ERROR: 'game_error',
  ACTION_ERROR: 'action_error',
  
  // Chat Events (future enhancement)
  CHAT_MESSAGE: 'chat_message',
  CHAT_BROADCAST: 'chat_broadcast',
} as const;

export type SocketEvent = typeof SOCKET_EVENTS[keyof typeof SOCKET_EVENTS];

// Helper function to validate event names
export function isValidSocketEvent(event: string): event is SocketEvent {
  return Object.values(SOCKET_EVENTS).includes(event as SocketEvent);
}
