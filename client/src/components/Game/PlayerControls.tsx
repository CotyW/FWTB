import React, { useState } from 'react';
import './PlayerControls.css';

import type { PublicPlayer } from '../../../../shared/types/game.types';

type Player = Pick<PublicPlayer, 'id' | 'name' | 'chips' | 'currentBet' | 'isAllIn' | 'isFolded'>;

interface PlayerControlsProps {
  currentPlayer: Player | undefined;
  isMyTurn: boolean;
  amountToCall: number;
  tableBet: number;
  minRaiseTo: number;
  canRaise: boolean;
  bigBlind: number;
  pot: number;
  onAction: (action: string, amount?: number) => void;
}

const PlayerControls: React.FC<PlayerControlsProps> = ({ currentPlayer, isMyTurn, amountToCall, tableBet, minRaiseTo, canRaise: raiseAllowed, bigBlind, pot, onAction }) => {
  const [raiseInput, setRaiseInput] = useState(0);

  if (!currentPlayer) {
    return (
      <div className="player-controls">
        <p>Waiting for your turn...</p>
      </div>
    );
  }

  if (!isMyTurn) {
    return (
      <div className="player-controls">
        <p>Other player's turn...</p>
      </div>
    );
  }

  if (currentPlayer.isFolded || currentPlayer.isAllIn) {
    return (
      <div className="player-controls">
        <p>{currentPlayer.isFolded ? 'You folded' : 'You are all in'}</p>
      </div>
    );
  }

  const maxRaise = currentPlayer.chips + currentPlayer.currentBet;
  const minRaise = Math.min(minRaiseTo, maxRaise);
  const raiseAmount = Math.min(maxRaise, Math.max(minRaise, raiseInput));
  const canRaise = raiseAllowed && maxRaise > tableBet;
  // After a short all-in that didn't re-open betting, shoving more than a call counts as a raise
  const canAllIn = raiseAllowed || maxRaise <= tableBet;
  const presets = [
    { label: 'Min', value: minRaise },
    { label: '½ Pot', value: tableBet + Math.round(pot / 2) },
    { label: 'Pot', value: tableBet + pot },
    { label: 'Max', value: maxRaise },
  ];

  return (
    <div className="player-controls">
      <div className="player-info">
        <span className="player-name">Your turn - {currentPlayer.name}</span>
        <span className="player-chips">Chips: ${currentPlayer.chips}</span>
      </div>

      <div className="action-buttons">
        <button className="btn btn-fold" onClick={() => onAction('fold')}>
          Fold
        </button>

        {amountToCall === 0 ? (
          <button className="btn btn-check" onClick={() => onAction('check')}>
            Check
          </button>
        ) : (
          <button className="btn btn-call" onClick={() => onAction('call')}>
            Call {Math.min(amountToCall, currentPlayer.chips)}
          </button>
        )}

        <button
          className="btn btn-raise"
          onClick={() => {
            onAction('raise', raiseAmount);
            setRaiseInput(0);
          }}
          disabled={!canRaise}
        >
          Raise to {raiseAmount}
        </button>

        <button
          className="btn btn-allin"
          onClick={() => onAction('all_in')}
          disabled={!canAllIn}
          title={canAllIn ? undefined : 'Betting was not re-opened by a short all-in: call or fold'}
        >
          All In
        </button>
      </div>

      {canRaise && (
        <div className="raise-input">
          <div className="raise-presets">
            {presets.map((preset) => (
              <button
                key={preset.label}
                type="button"
                className="btn-preset"
                onClick={() => setRaiseInput(Math.min(maxRaise, Math.max(minRaise, preset.value)))}
              >
                {preset.label}
              </button>
            ))}
          </div>
          <input
            type="range"
            className="raise-slider"
            value={raiseAmount}
            onChange={(e) => setRaiseInput(parseInt(e.target.value))}
            min={minRaise}
            max={maxRaise}
            step={Math.max(1, Math.min(bigBlind, maxRaise - minRaise))}
          />
          <input
            type="number"
            value={raiseAmount}
            onChange={(e) => setRaiseInput(parseInt(e.target.value) || 0)}
            min={minRaise}
            max={maxRaise}
          />
        </div>
      )}
    </div>
  );
};

export default PlayerControls;
