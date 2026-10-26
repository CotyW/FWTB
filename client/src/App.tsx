import React, { useEffect, useState } from 'react';
import { socketService, GameEndedEvent, GameState } from './services/socketService';
import { Landing, RoomLobby } from './components/Lobby/LobbyView';
import GameTable from './components/Game/GameTable';
import './App.css';

type AppView = 'landing' | 'lobby' | 'game' | 'finished';

export interface AppState {
  view: AppView;
  playerName: string;
  roomCode: string;
  roomId: string;
  players: any[];
  hostId: string;
  playerId: string;
  gameState: GameState | null;
  startingChips: number;
  levelMinutes: number;
  isSpectator: boolean;
  tournamentWinner: GameEndedEvent['winner'] | null;
  error: string | null;
}

function App() {
  const [appState, setAppState] = useState<AppState>({
    view: 'landing',
    playerName: '',
    roomCode: '',
    roomId: '',
    players: [],
    hostId: '',
    playerId: '',
    gameState: null,
    startingChips: 1000,
    levelMinutes: 10,
    isSpectator: false,
    tournamentWinner: null,
    error: null,
  });

  useEffect(() => {
    // Connect to server on mount
    socketService.connect().catch((error) => {
      console.error('Failed to connect:', error);
      setAppState((prev) => ({ ...prev, error: 'Failed to connect to server' }));
    });

    // Setup event listeners
    socketService.onRoomCreated((data) => {
      setAppState((prev) => ({
        ...prev,
        view: 'lobby',
        roomId: data.roomId,
        roomCode: data.roomCode,
        hostId: data.hostId,
        playerId: data.playerId,
        players: data.players || [],
        startingChips: data.config?.startingChips || prev.startingChips,
        levelMinutes: data.config?.levelMinutes || prev.levelMinutes,
        tournamentWinner: null,
      }));
    });

    socketService.onRoomJoined((data) => {
      setAppState((prev) => ({
        ...prev,
        view: 'lobby',
        roomId: data.roomId,
        roomCode: data.roomCode,
        hostId: data.hostId,
        playerId: data.playerId,
        players: data.players || [],
        startingChips: data.config?.startingChips || prev.startingChips,
        levelMinutes: data.config?.levelMinutes || prev.levelMinutes,
        tournamentWinner: null,
      }));
    });

    socketService.onPlayerJoined((data) => {
      setAppState((prev) => ({
        ...prev,
        roomId: data.roomId,
        roomCode: data.roomCode,
        players: data.players || prev.players,
      }));
    });

    socketService.onRoomUpdate((data) => {
      setAppState((prev) => ({
        ...prev,
        roomId: data.room?.id || prev.roomId,
        roomCode: data.room?.code || prev.roomCode,
        hostId: data.room?.hostId || prev.hostId,
        players: data.room?.players || prev.players,
        startingChips: data.room?.config?.startingChips || prev.startingChips,
        levelMinutes: data.room?.config?.levelMinutes || prev.levelMinutes,
      }));
    });

    socketService.onGameStarted((data) => {
      setAppState((prev) => ({
        ...prev,
        view: 'game',
        gameState: data.gameState,
      }));
    });

    socketService.onGameUpdate((data) => {
      setAppState((prev) => ({
        ...prev,
        view: 'game',
        gameState: data.gameState || prev.gameState,
      }));
    });

    socketService.onNextHand((data) => {
      setAppState((prev) => ({
        ...prev,
        view: 'game',
        gameState: data.gameState || prev.gameState,
      }));
    });

    socketService.onGameState((state) => {
      setAppState((prev) => ({
        ...prev,
        gameState: state,
      }));
    });

    socketService.onSpectateJoined((data) => {
      setAppState((prev) => ({
        ...prev,
        view: 'game',
        isSpectator: true,
        roomId: data.roomId,
        roomCode: data.roomCode,
        playerId: '',
        gameState: data.gameState,
        tournamentWinner: null,
        error: null,
      }));
    });

    socketService.onGameEnded((data) => {
      setAppState((prev) => ({
        ...prev,
        view: 'finished',
        tournamentWinner: data.winner || null,
      }));
    });

    socketService.onError((error) => {
      setAppState((prev) => ({
        ...prev,
        error: error.message || 'An error occurred',
      }));
    });

    return () => {
      socketService.disconnect();
    };
  }, []);

  const handleCreateRoom = (playerName: string, buyIn: number, levelMinutes: number) => {
    setAppState((prev) => ({ ...prev, playerName }));
    socketService.createRoom(playerName, buyIn, levelMinutes);
  };

  const handleJoinRoom = (playerName: string, roomCode: string) => {
    setAppState((prev) => ({ ...prev, playerName, roomCode }));
    socketService.joinRoom(roomCode, playerName);
  };

  const handleLeaveRoom = () => {
    socketService.leaveRoom();
    setAppState((prev) => ({
      ...prev,
      view: 'landing',
      isSpectator: false,
      roomCode: '',
      roomId: '',
      gameState: null,
      tournamentWinner: null,
    }));
  };

  const handleGameAction = (action: string, amount?: number) => {
    socketService.playerAction(action as any, amount);
  };

  const handleStartGame = () => {
    socketService.startGame();
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>🎰 Texas Hold'em Poker</h1>
        <div className="connection-status">
          {socketService.getIsConnected() ? (
            <span className="status-online">● Online</span>
          ) : (
            <span className="status-offline">● Offline</span>
          )}
        </div>
      </header>

      {appState.error && (
        <div className="error-banner">
          <p>{appState.error}</p>
          <button onClick={() => setAppState((prev) => ({ ...prev, error: null }))}>
            Dismiss
          </button>
        </div>
      )}

      <main className="app-main">
        {appState.view === 'landing' && (
          <Landing
            onCreateRoom={handleCreateRoom}
            onJoinRoom={handleJoinRoom}
            onSpectate={(code) => socketService.spectateRoom(code)}
          />
        )}

        {appState.view === 'lobby' && (
          <RoomLobby
            roomCode={appState.roomCode}
            players={appState.players}
            hostId={appState.hostId}
            currentPlayerId={appState.playerId}
            startingChips={appState.startingChips}
            levelMinutes={appState.levelMinutes}
            onUpdateSettings={(s) => socketService.updateSettings(s)}
            onStartGame={handleStartGame}
            onLeaveRoom={handleLeaveRoom}
          />
        )}

        {appState.view === 'finished' && (
          <section className="tournament-result">
            <p className="eyebrow">Sit &amp; Go complete</p>
            <h2>{appState.tournamentWinner
              ? `${appState.tournamentWinner.playerName} wins!`
              : 'Tournament finished'}</h2>
            {appState.tournamentWinner && (
              <p>Champion finishes with {appState.tournamentWinner.chips.toLocaleString()} chips.</p>
            )}
            <button className="btn btn-primary" onClick={handleLeaveRoom}>
              Leave Tournament
            </button>
          </section>
        )}

        {appState.view === 'game' && appState.gameState && (
          <GameTable
            gameState={appState.gameState}
            currentPlayerId={appState.playerId}
            onAction={handleGameAction}
            onRebuy={() => socketService.rebuy()}
            onSitIn={() => socketService.sitIn()}
            isSpectator={appState.isSpectator}
            onLeaveGame={handleLeaveRoom}
          />
        )}
      </main>
    </div>
  );
}

export default App;
