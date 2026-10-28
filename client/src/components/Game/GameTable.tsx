import React, { useEffect, useState } from 'react';
import { GameState } from '../../services/socketService';
import PlayerSeat from './PlayerSeat';
import CommunityCards from './CommunityCards';
import PotDisplay from './PotDisplay';
import PlayerControls from './PlayerControls';
import './GameTable.css';

interface GameTableProps {
  gameState: GameState;
  currentPlayerId: string;
  onAction: (action: string, amount?: number) => void;
  onRebuy: () => void;
  onSitIn: () => void;
  isSpectator?: boolean;
  onLeaveGame: () => void;
}

const SEAT_COUNT = 6;

const formatTime = (ms: number) => {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
};

// Seats sit on a fixed hexagonal ring; the viewer's own seat is always at the bottom
const seatStyle = (seat: number, viewerSeat: number): React.CSSProperties => {
  const relative = (seat - viewerSeat + SEAT_COUNT) % SEAT_COUNT;
  const rad = ((180 + relative * (360 / SEAT_COUNT)) * Math.PI) / 180;
  return {
    left: `${50 + 50 * Math.sin(rad)}%`,
    top: `${50 - 50 * Math.cos(rad)}%`
  };
};

const GameTable: React.FC<GameTableProps> = ({ gameState, currentPlayerId, onAction, onRebuy, onSitIn, isSpectator = false, onLeaveGame }) => {
  // Use server-relative time so client clock skew doesn't matter
  const [remainingMs, setRemainingMs] = useState(gameState.levelEndsAt - gameState.serverTime);
  useEffect(() => {
    const receivedAt = Date.now();
    const initial = gameState.levelEndsAt - gameState.serverTime;
    setRemainingMs(initial);
    const timer = setInterval(() => setRemainingMs(initial - (Date.now() - receivedAt)), 500);
    return () => clearInterval(timer);
  }, [gameState.levelEndsAt, gameState.serverTime]);

  const [turnRemainingMs, setTurnRemainingMs] = useState(0);
  useEffect(() => {
    if (!gameState.turnEndsAt) {
      setTurnRemainingMs(0);
      return;
    }
    const receivedAt = Date.now();
    const initial = gameState.turnEndsAt - gameState.serverTime;
    setTurnRemainingMs(initial);
    const timer = setInterval(() => setTurnRemainingMs(initial - (Date.now() - receivedAt)), 250);
    return () => clearInterval(timer);
  }, [gameState.turnEndsAt, gameState.serverTime]);
  const turnPlayer = gameState.players[gameState.currentPlayerIndex];
  const myPlayer = gameState.players.find(p => p.id === currentPlayerId);
  const isMyTurn = !!myPlayer && turnPlayer?.id === currentPlayerId;
  const isShowdown = gameState.stage === 'showdown';
  const canRebuy = isShowdown && myPlayer?.chips === 0 && gameState.rebuyOpen;
  const dealer = gameState.players[gameState.dealerPosition];

  // Seats keep their original number for the whole game, so eliminated players leave an empty seat
  const playerBySeat = new Map(gameState.players.map(p => [p.position, p]));
  const viewerSeat = myPlayer?.position ?? 0;

  return (
    <div className="game-container">
      <div className="table-header">
        <div className="hud-group">
          <span className="stage-badge">{gameState.stage.toUpperCase()}</span>
          <span className="hud-item">Hand {gameState.handNumber}</span>
          <span className="hud-item hud-strong">
            Level {gameState.blindLevel} · Blinds {gameState.smallBlind}/{gameState.bigBlind}
          </span>
        </div>
        <div className="hud-group">
          <span className="hud-item">
            {remainingMs > 0 ? `Next level ${formatTime(remainingMs)}` : 'Blinds up next hand'}
          </span>
          <span className="hud-item">{gameState.rebuyOpen ? 'Rebuys open' : 'Rebuys closed'}</span>
        </div>
        <div className="hud-group">
          {gameState.turnEndsAt > 0 && turnPlayer && (
            <span className={`turn-timer ${turnRemainingMs <= 10000 ? 'urgent' : ''}`}>
              ⏱ {turnPlayer.id === currentPlayerId ? 'Your turn' : turnPlayer.name} {formatTime(turnRemainingMs)}
            </span>
          )}
          <button className="leave-btn" onClick={onLeaveGame}>Leave</button>
        </div>
      </div>

      <div className="table-stage">
        <div className="table-fit">
          <div className="table-layout" />

          <div className="center-stack">
            <PotDisplay pot={gameState.pot} />
            <CommunityCards cards={gameState.communityCards} />

            {isSpectator ? (
              <p className="table-notice">👀 Watching as a spectator. Hole cards are hidden.</p>
            ) : !myPlayer ? (
              <p className="table-notice">
                You've been eliminated. You'll keep watching until the tournament ends.
              </p>
            ) : myPlayer.isSittingOut && (
              <div className="table-notice">
                <span>You missed two turns and are sitting out.</span>
                <button className="btn btn-primary" onClick={onSitIn}>I'm Back</button>
              </div>
            )}
          </div>

          <div className="players-section">
            {Array.from({ length: SEAT_COUNT }, (_, seat) => {
              const player = playerBySeat.get(seat);
              return (
                <div
                  key={seat}
                  className="player-seat-wrapper"
                  style={seatStyle(seat, viewerSeat)}
                >
                  {player && dealer?.id === player.id && <div className="dealer-button">D</div>}
                  <PlayerSeat
                    player={player}
                    isMe={player?.id === currentPlayerId}
                    isCurrentPlayer={!!player && player.id === turnPlayer?.id && gameState.stage !== 'showdown'}
                  />
                </div>
              );
            })}
          </div>

          {isShowdown && gameState.winners && gameState.winners.length > 0 && (
            <div className="winners-overlay">
              <div className="winners-section">
                {gameState.winners.map((winner) => (
                  <div key={winner.playerId} className="winner-info">
                    <span className="winner-name">{winner.playerName}</span>
                    <span className="winner-hand">{winner.handDescription}</span>
                    <span className="winner-amount">+${winner.amount}</span>
                  </div>
                ))}
                <p className="reset-message">
                  {canRebuy ? 'Rebuy now to stay in. ' : ''}Next hand starts shortly.
                </p>
                {canRebuy && (
                  <button className="btn btn-primary" onClick={onRebuy}>Rebuy</button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {!isSpectator && myPlayer && !isShowdown && (
        <div className="controls-section">
          <PlayerControls
            currentPlayer={isMyTurn ? myPlayer : undefined}
            isMyTurn={isMyTurn}
            amountToCall={Math.max(0, gameState.currentBet - (myPlayer?.currentBet || 0))}
            tableBet={gameState.currentBet}
            minRaiseTo={gameState.minRaiseTo}
            canRaise={gameState.canRaise}
            bigBlind={gameState.bigBlind}
            pot={gameState.pot}
            onAction={onAction}
          />
        </div>
      )}
    </div>
  );
};

export default GameTable;
