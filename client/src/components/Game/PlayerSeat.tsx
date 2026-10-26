import React from 'react';
import './PlayerSeat.css';

import type { PublicPlayer } from '../../../../shared/types/game.types';

type Player = Pick<PublicPlayer, 'id' | 'name' | 'chips' | 'cards' | 'isFolded' | 'isAllIn' | 'isReady' | 'isSittingOut'>;

interface PlayerSeatProps {
  player: Player;
  isCurrentPlayer: boolean;
}

const PlayerSeat: React.FC<PlayerSeatProps> = ({ player, isCurrentPlayer }) => {
  return (
    <div className={`player-seat ${isCurrentPlayer ? 'current' : ''}`}>
      <div className="seat-card">
        <div className="player-name">{player.name}</div>
        <div className="chips-display">${player.chips}</div>
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
        {isCurrentPlayer && <div className="status-current">YOUR TURN</div>}
      </div>
    </div>
  );
};

export default PlayerSeat;
