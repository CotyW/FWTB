import React, { useEffect, useState } from 'react';
import { GAME_CONFIG, clampStartingChips, clampBlinds, blindsForStack } from '../../../../shared/constants/gameConfig';
import './LobbyView.css';

const STACK_PRESETS = [500, 1000, 1500, 2500, 5000, 10000];

// Number input that lets you type freely and only clamps/commits on blur or Enter
const StackInput: React.FC<{ value: number; onCommit: (chips: number) => void }> = ({ value, onCommit }) => {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);

  const commit = () => {
    const chips = clampStartingChips(text);
    setText(String(chips));
    if (chips !== value) onCommit(chips);
  };

  return (
    <>
      <input
        type="number"
        value={text}
        min={GAME_CONFIG.MIN_STARTING_CHIPS}
        max={GAME_CONFIG.MAX_STARTING_CHIPS}
        step={100}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            commit();
          }
        }}
      />
      <div className="stack-presets">
        {STACK_PRESETS.map((preset) => (
          <button
            key={preset}
            type="button"
            className={`btn btn-outline${preset === value ? ' active' : ''}`}
            onClick={() => {
              setText(String(preset));
              if (preset !== value) onCommit(preset);
            }}
          >
            {preset.toLocaleString()}
          </button>
        ))}
      </div>
    </>
  );
};

// Small/big blind inputs; commit on blur or Enter so typing isn't clamped mid-edit
const BlindsInput: React.FC<{
  smallBlind: number;
  bigBlind: number;
  startingChips: number;
  onCommit: (smallBlind: number, bigBlind: number) => void;
}> = ({ smallBlind, bigBlind, startingChips, onCommit }) => {
  const [small, setSmall] = useState(String(smallBlind));
  const [big, setBig] = useState(String(bigBlind));
  useEffect(() => setSmall(String(smallBlind)), [smallBlind]);
  useEffect(() => setBig(String(bigBlind)), [bigBlind]);

  const commit = () => {
    const next = clampBlinds(small, big, startingChips);
    setSmall(String(next.smallBlind));
    setBig(String(next.bigBlind));
    if (next.smallBlind !== smallBlind || next.bigBlind !== bigBlind) onCommit(next.smallBlind, next.bigBlind);
  };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commit();
    }
  };

  return (
    <div className="blinds-inputs">
      <label>
        Small
        <input type="number" min={1} value={small} onChange={(e) => setSmall(e.target.value)} onBlur={commit} onKeyDown={onKey} />
      </label>
      <label>
        Big
        <input type="number" min={2} value={big} onChange={(e) => setBig(e.target.value)} onBlur={commit} onKeyDown={onKey} />
      </label>
    </div>
  );
};

interface LandingProps {
  onCreateRoom: (
    playerName: string,
    buyIn: number,
    levelMinutes: number,
    blinds?: { smallBlind: number; bigBlind: number }
  ) => void;
  onJoinRoom: (playerName: string, roomCode: string) => void;
  onSpectate: (roomCode: string) => void;
}

interface LobbyPlayer {
  id: string;
  name: string;
}

interface RoomLobbyProps {
  roomCode: string;
  players: LobbyPlayer[];
  hostId: string;
  currentPlayerId: string;
  startingChips: number;
  smallBlind: number;
  bigBlind: number;
  levelMinutes: number;
  onUpdateSettings: (settings: { levelMinutes?: number; startingChips?: number; smallBlind?: number; bigBlind?: number }) => void;
  onStartGame: () => void;
  onLeaveRoom: () => void;
}

export const Landing: React.FC<LandingProps> = ({ onCreateRoom, onJoinRoom, onSpectate }) => {
  const [view, setView] = useState<'choice' | 'create' | 'join'>('choice');
  const [playerName, setPlayerName] = useState('');
  const [buyIn, setBuyIn] = useState(1000);
  // null = blinds follow the stack automatically until the host types their own
  const [customBlinds, setCustomBlinds] = useState<{ smallBlind: number; bigBlind: number } | null>(null);
  const blinds = customBlinds
    ? clampBlinds(customBlinds.smallBlind, customBlinds.bigBlind, buyIn)
    : blindsForStack(buyIn);
  const [levelMinutes, setLevelMinutes] = useState(10);
  const [roomCode, setRoomCode] = useState('');

  const handleCreateRoom = () => {
    if (!playerName.trim()) {
      alert('Please enter your name');
      return;
    }
    onCreateRoom(playerName.trim(), buyIn, levelMinutes, customBlinds ? blinds : undefined);
  };

  const handleJoinRoom = () => {
    if (!playerName.trim()) {
      alert('Please enter your name');
      return;
    }
    if (!roomCode.trim()) {
      alert('Please enter a room code');
      return;
    }
    onJoinRoom(playerName.trim(), roomCode.trim().toUpperCase());
  };

  return (
    <div className="lobby-view">
      {view === 'choice' && (
        <div className="lobby-choice">
          <p className="eyebrow">Texas Hold'em · Sit &amp; Go</p>
          <h2>One table. One champion.</h2>
          <p>Start a private tournament for 2–6 players. Everyone gets the same stack, blinds rise on a timer, and play continues until one player has all the chips.</p>
          <button className="btn btn-primary" onClick={() => setView('create')}>
            Create Room
          </button>
          <button className="btn btn-secondary" onClick={() => setView('join')}>
            Join Room
          </button>
        </div>
      )}

      {view === 'create' && (
        <div className="lobby-form">
          <h2>Create Room</h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleCreateRoom();
            }}
          >
            <div className="form-group">
              <label>Player Name</label>
              <input
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="Your name"
                maxLength={20}
              />
            </div>

            <div className="form-group">
              <label>Starting Stack (chips)</label>
              <StackInput value={buyIn} onCommit={setBuyIn} />
            </div>

            <div className="form-group">
              <label>Starting Blinds</label>
              <BlindsInput
                smallBlind={blinds.smallBlind}
                bigBlind={blinds.bigBlind}
                startingChips={buyIn}
                onCommit={(smallBlind, bigBlind) => setCustomBlinds({ smallBlind, bigBlind })}
              />
              <p className="form-hint">Blinds rise each level. Defaults scale with the stack until you change them.</p>
            </div>

            <div className="form-group">
              <label>Blind Level Length (minutes)</label>
              <input
                type="number"
                value={levelMinutes}
                onChange={(e) => setLevelMinutes(Math.min(60, Math.max(1, parseInt(e.target.value) || 1)))}
                min={1}
                max={60}
              />
            </div>

            <div className="form-buttons">
              <button type="submit" className="btn btn-primary">
                Create Room
              </button>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => {
                  setView('choice');
                  setPlayerName('');
                  setBuyIn(1000);
                  setCustomBlinds(null);
                }}
              >
                Back
              </button>
            </div>
          </form>
        </div>
      )}

      {view === 'join' && (
        <div className="lobby-form">
          <h2>Join Room</h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleJoinRoom();
            }}
          >
            <div className="form-group">
              <label>Player Name</label>
              <input
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="Your name"
                maxLength={20}
              />
            </div>

            <div className="form-group">
              <label>Room Code</label>
              <input
                type="text"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                placeholder="e.g., ABC123"
                maxLength={6}
              />
            </div>

            <p className="form-hint">The host sets the equal starting stack for everyone.</p>

            <div className="form-buttons">
              <button type="submit" className="btn btn-primary">
                Join Room
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  if (!roomCode.trim()) {
                    alert('Please enter a room code');
                    return;
                  }
                  onSpectate(roomCode.trim().toUpperCase());
                }}
              >
                Watch Only
              </button>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => {
                  setView('choice');
                  setPlayerName('');
                  setRoomCode('');
                  setBuyIn(1000);
                }}
              >
                Back
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export const RoomLobby: React.FC<RoomLobbyProps> = ({ roomCode, players, hostId, currentPlayerId, startingChips, smallBlind, bigBlind, levelMinutes, onUpdateSettings, onStartGame, onLeaveRoom }) => {
  const isHost = currentPlayerId === hostId;
  return (
    <div className="room-lobby">
      <p className="eyebrow">Sit &amp; Go lobby</p>
      <h2>Room: {roomCode}</h2>
      <p>{players.length} / 6 players · {startingChips.toLocaleString()} starting chips</p>
      <div className="tournament-summary">
        <span>Texas Hold'em</span>
        <span>Starting blinds: {smallBlind} / {bigBlind}</span>
        <span>Blinds rise every {levelMinutes} min</span>
        <span>Rebuys through level 4</span>
      </div>
      {isHost && (
        <div className="form-group">
          <label>Starting Stack (chips)</label>
          <StackInput value={startingChips} onCommit={(chips) => onUpdateSettings({ startingChips: chips })} />
        </div>
      )}
      {isHost && (
        <div className="form-group">
          <label>Starting Blinds</label>
          <BlindsInput
            smallBlind={smallBlind}
            bigBlind={bigBlind}
            startingChips={startingChips}
            onCommit={(sb, bb) => onUpdateSettings({ smallBlind: sb, bigBlind: bb })}
          />
        </div>
      )}
      {isHost && (
        <div className="form-group">
          <label>Blind Level Length (minutes)</label>
          <input
            type="number"
            value={levelMinutes}
            min={1}
            max={60}
            onChange={(e) => {
              const m = parseInt(e.target.value);
              if (m >= 1 && m <= 60) onUpdateSettings({ levelMinutes: m });
            }}
          />
        </div>
      )}
      <div className="player-list">
        {players && players.length > 0 ? (
          players.map((p) => (
            <div key={p.id} className="player-row">
              <span>{p.name}</span>
              {p.id === hostId && <span className="badge">Host</span>}
              {p.id === currentPlayerId && <span className="badge">You</span>}
            </div>
          ))
        ) : (
          <p>Players will appear here</p>
        )}
      </div>
      {currentPlayerId === hostId && players.length >= 2 && (
        <button className="btn btn-primary" onClick={onStartGame}>
          Start Sit &amp; Go
        </button>
      )}
      {players.length < 2 && <p className="form-hint">At least 2 players are needed to start.</p>}
      <button className="btn btn-outline" onClick={onLeaveRoom}>
        Leave Room
      </button>
    </div>
  );
};

const LobbyView = { Landing, RoomLobby };

export default LobbyView;
