const SUIT_SYMBOLS: Record<string, string> = {
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
  spades: '♠'
};

const formatCard = (card: any): string => {
  if (!card) return '';
  const suit = SUIT_SYMBOLS[card.suit] || card.suit || '';
  return `${card.rank ?? ''}${suit}`;
};

// Converts engine cards to client strings. Only `viewerId`'s own hole cards are included;
// everyone else (and spectators, who pass no viewer) see empty hands.
export function serializeGameState(gameState: any, viewerId?: string) {
  return {
    ...gameState,
    communityCards: (gameState.communityCards || []).map(formatCard),
    players: (gameState.players || []).map((p: any) => ({
      ...p,
      cards: p.id === viewerId ? (p.cards || []).map(formatCard) : []
    }))
  };
}
