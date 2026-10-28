import React from 'react';
import './PlayerSeat.css';

import type { PublicPlayer } from '../../../../shared/types/game.types';

type Player = Pick<PublicPlayer, 'id' | 'name' | 'chips' | 'cards' | 'isFolded' | 'isAllIn' | 'isReady' | 'isSittingOut' | 'currentBet'>;

interface PlayerSeatProps {
  player?: Player;
  isMe?: boolean;
  isCurrentPlayer: boolean;
}

const PlayerSeat: React.FC<PlayerSeatProps> = ({ player, isMe = false, isCurrentPlayer }) => {
  if (!player) {
    return (
      <div className="player-seat empty">
        <div className="seat-card">
          <div className="player-name">Empty</div>
        </div>
      </div>
    );
  }

  return (
    <div className={`player-seat ${isCurrentPlayer ? 'current' : ''} ${isMe ? 'me' : ''} ${player.isFolded ? 'folded' : ''}`}>
      <div className="seat-card">
        <div className="player-name">{player.name}{isMe ? ' (you)' : ''}</div>
        <div className="chips-display">${player.chips}</div>
        {player.currentBet > 0 && <div className="seat-bet">Bet ${player.currentBet}</div>}
        {player.cards && player.cards.length > 0 && (
          <div className="player-cards">
            {player.cards.map((card, i) => (
              <span key={i} className="card-code">
                {card}
              </span>
            ))}
          </div>
        )}
        {player.isFolded && <div className="status-folded">FOLDED</div>}
        {player.isSittingOut && <div className="status-folded">SITTING OUT</div>}
        {player.isAllIn && <div className="status-allin">ALL IN</div>}
        {isCurrentPlayer && <div className="status-current">{isMe ? 'YOUR TURN' : 'TO ACT'}</div>}
      </div>
    </div>
  );
};

export default PlayerSeat;
