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

const formatTime = (ms: number) => {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
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
  // Find the current user's player object
  const myPlayer = gameState.players.find(p => p.id === currentPlayerId);
  // Check if it's my turn
  const isMyTurn = !!myPlayer && gameState.players[gameState.currentPlayerIndex]?.id === currentPlayerId;
  const canRebuy = gameState.stage === 'showdown' && myPlayer?.chips === 0 && gameState.rebuyOpen;
  return (
    <div className="game-container">
      <div className="game-table">
        <div className="table-header">
          <h2>Sit &amp; Go · Texas Hold'em</h2>
          <div className="table-info">
            <span className="stage-badge">{gameState.stage.toUpperCase()}</span>
            <span className="current-bet">Hand {gameState.handNumber} · Blind level {gameState.blindLevel}</span>
            <span className="current-bet">
              {remainingMs > 0 ? `Next level in ${formatTime(remainingMs)}` : 'Blinds up next hand'}
            </span>
            <span className="current-bet">{gameState.rebuyOpen ? 'Rebuys open' : 'Rebuys closed'}</span>
            <span className="current-bet">Blinds: {gameState.smallBlind} / {gameState.bigBlind}</span>
            <span className="current-bet">Current Bet: ${gameState.currentBet}</span>
            {gameState.turnEndsAt > 0 && turnPlayer && (
              <span className={`turn-timer ${turnRemainingMs <= 10000 ? 'urgent' : ''}`}>
                ⏱ {turnPlayer.id === currentPlayerId ? 'Your turn' : turnPlayer.name}: {formatTime(turnRemainingMs)}
              </span>
            )}
          </div>
        </div>

        <div className="table-layout">
          {/* Center stack: community cards above pot */}
          <div className="center-stack">
            <div className="pot-section">
              <PotDisplay pot={gameState.pot} />
            </div>

            <div className="community-section">
              <CommunityCards cards={gameState.communityCards} />
            </div>
          </div>

          {/* Winner Display */}
          {gameState.stage === 'showdown' && gameState.winners && gameState.winners.length > 0 && (
            <div className="winners-section">
              <h3>Hand Winner(s)</h3>
              {gameState.winners.map((winner) => (
                <div key={winner.playerId} className="winner-info">
                  <span className="winner-name">{winner.playerName}</span>
                  <span className="winner-hand">{winner.handDescription}</span>
                  <span className="winner-amount">+${winner.amount}</span>
                </div>
              ))}
              <p className="reset-message">
                {canRebuy ? 'Rebuy now to stay in. ' : ''}Next hand starts shortly; blinds rise on the level timer.
              </p>
              {canRebuy && (
                <button className="btn btn-primary" onClick={onRebuy}>Rebuy</button>
              )}
            </div>
          )}

          {isSpectator ? (
            <div className="winners-section">
              <p className="reset-message">👀 You are watching as a spectator. Hole cards are hidden.</p>
            </div>
          ) : !myPlayer ? (
            <div className="winners-section">
              <p className="reset-message">
                You have been eliminated. You'll keep watching until the tournament ends — hole cards stay hidden.
              </p>
            </div>
          ) : myPlayer.isSittingOut && (
            <div className="winners-section">
              <p className="reset-message">You missed two turns in a row and are sitting out. Your hands are auto-folded.</p>
              <button className="btn btn-primary" onClick={onSitIn}>I'm Back</button>
            </div>
          )}

          {/* Player Seats - fixed 6-position ring */}
          <div className="players-section">
            {gameState.players.map((player, index) => {
              const seatAngles = [270, 330, 30, 90, 150, 210];
              const angle = seatAngles[index % 6];
              const rad = (angle * Math.PI) / 180;
              // Elliptical ring so seats scale with the table's width and height
              const style: React.CSSProperties = {
                left: `${50 + 50 * Math.sin(rad)}%`,
                top: `${50 - 50 * Math.cos(rad)}%`,
                transform: 'translate(-50%, -50%)'
              };
              return (
                <div
                  key={player.id}
                  className={`player-seat-wrapper ${gameState.dealerPosition === index ? 'is-dealer' : ''}`}
                  style={style}
                >
                  {gameState.dealerPosition === index && <div className="dealer-button">D</div>}
                  <PlayerSeat
                    player={player}
                    isCurrentPlayer={index === gameState.currentPlayerIndex}
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* Player Controls */}
        {!isSpectator && myPlayer && (
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

        {/* Leave Button */}
        <button className="leave-btn" onClick={onLeaveGame}>
          Leave Game
        </button>
      </div>
    </div>
  );
};

export default GameTable;
