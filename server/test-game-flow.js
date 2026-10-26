const { io } = require('socket.io-client');

console.log('🎮 Starting comprehensive Socket.io test...\n');

let player1Socket, player2Socket;
let roomCode;
let testsPassed = 0;
let testsFailed = 0;

function logTest(name, passed, data = '') {
  if (passed) {
    testsPassed++;
    console.log(`✅ ${name}`);
    if (data) console.log(`   ${data}`);
  } else {
    testsFailed++;
    console.error(`❌ ${name}`);
    if (data) console.error(`   ${data}`);
  }
}

function cleanup() {
  console.log('\n📊 Test Results:');
  console.log(`   Passed: ${testsPassed}`);
  console.log(`   Failed: ${testsFailed}`);
  
  if (player1Socket) player1Socket.disconnect();
  if (player2Socket) player2Socket.disconnect();
  
  setTimeout(() => {
    process.exit(testsFailed > 0 ? 1 : 0);
  }, 500);
}

// Test 1: Create Room
console.log('🔵 Test 1: Create Room');
player1Socket = io('http://localhost:3001');

player1Socket.on('connect', () => {
  logTest('Player 1 connected', true, `Socket ID: ${player1Socket.id}`);
  
  player1Socket.emit('create_room', {
    playerName: 'Alice',
    config: {
      maxPlayers: 6,
      smallBlind: 10,
      bigBlind: 20,
      startingChips: 1000,
      minBuyIn: 500,
      maxBuyIn: 2000
    }
  });
});

player1Socket.on('room_created', (data) => {
  logTest('Room created', true, `Code: ${data.room.code}`);
  roomCode = data.room.code;
  
  if (data.room.players.length === 1 && data.room.players[0].name === 'Alice') {
    logTest('Host player added correctly', true);
  } else {
    logTest('Host player added correctly', false);
  }
  
  // Test 2: Join Room
  setTimeout(() => {
    console.log('\n🔵 Test 2: Join Room');
    player2Socket = io('http://localhost:3001');
    
    player2Socket.on('connect', () => {
      logTest('Player 2 connected', true, `Socket ID: ${player2Socket.id}`);
      
      player2Socket.emit('join_room', {
        roomCode: roomCode,
        playerName: 'Bob'
      });
    });
    
    player2Socket.on('room_joined', (data) => {
      logTest('Player 2 joined room', true, `Players: ${data.room.players.length}`);
      
      if (data.room.players.length === 2) {
        logTest('Player count correct', true);
      } else {
        logTest('Player count correct', false);
      }
    });
    
    player2Socket.on('room_error', (data) => {
      logTest('Player 2 join room', false, data.message);
      cleanup();
    });
    
    player2Socket.on('game_started', (data) => {
      logTest('Player 2 received game started', true);
    });
    
    player2Socket.on('game_error', (data) => {
      logTest('Game action (Player 2)', false, data.message);
    });
  }, 1000);
});

// Test 3: Player Joined Event  
player1Socket.on('player_joined', (data) => {
  logTest('Player 1 received player_joined event', true, `New player: ${data.player.name}`);
  
  // Test 4: Set Ready States
  setTimeout(() => {
    console.log('\n🔵 Test 3: Set Player Ready States');
    
    player1Socket.emit('player_ready', { ready: true });
    player2Socket.emit('player_ready', { ready: true });
  }, 1000);
});

// Track room updates
let roomUpdateCount = 0;
player1Socket.on('room_update', (data) => {
  roomUpdateCount++;
  if (roomUpdateCount === 2) {
    logTest('Both players set ready', true);
    
    // Test 5: Start Game
    setTimeout(() => {
      console.log('\n🔵 Test 4: Start Game');
      player1Socket.emit('start_game');
    }, 1000);
  }
});

// Test 6: Game Started
player1Socket.on('game_started', (data) => {
  logTest('Game started event received', true);
  logTest('Game state has players', data.gameState.players.length === 2);
  logTest('Game stage is pre-flop', data.gameState.stage === 'pre-flop');
  logTest('Community cards initialized', Array.isArray(data.gameState.communityCards));
  logTest('Current player set', data.gameState.currentPlayerIndex !== undefined);
  
  // Test 7: Player Actions
  setTimeout(() => {
    console.log('\n🔵 Test 5: Player Actions');
    
    const currentPlayerIndex = data.gameState.currentPlayerIndex;
    const actingSocket = data.gameState.players[currentPlayerIndex].socketId === player1Socket.id 
      ? player1Socket 
      : player2Socket;
    
    const actingPlayerName = data.gameState.players[currentPlayerIndex].name;
    console.log(`   Current player: ${actingPlayerName}`);
    
    actingSocket.emit('player_action', {
      action: {
        type: 'call',
        amount: data.gameState.currentBet
      }
    });
  }, 1500);
});

// Track game updates
let gameUpdateCount = 0;
player1Socket.on('game_update', (data) => {
  gameUpdateCount++;
  
  if (gameUpdateCount === 1) {
    logTest('First action processed', true, `Pot: ${data.gameState.pot}`);
    
    setTimeout(() => {
      const currentPlayerIndex = data.gameState.currentPlayerIndex;
      const actingSocket = data.gameState.players[currentPlayerIndex].socketId === player1Socket.id 
        ? player1Socket 
        : player2Socket;
      
      const actingPlayerName = data.gameState.players[currentPlayerIndex].name;
      console.log(`   Current player: ${actingPlayerName} - checking`);
      
      actingSocket.emit('player_action', {
        action: {
          type: 'check',
          amount: 0
        }
      });
    }, 1000);
  } else if (gameUpdateCount === 2) {
    logTest('Second action processed', true, `Stage: ${data.gameState.stage}`);
    
    if (data.gameState.stage === 'flop') {
      logTest('Game progressed to flop', true, `Community cards: ${data.gameState.communityCards.length}`);
    }
    
    setTimeout(() => {
      const currentPlayerIndex = data.gameState.currentPlayerIndex;
      const actingSocket = data.gameState.players[currentPlayerIndex].socketId === player1Socket.id 
        ? player1Socket 
        : player2Socket;
      
      const actingPlayerName = data.gameState.players[currentPlayerIndex].name;
      console.log(`   Current player: ${actingPlayerName} - betting 50`);
      
      actingSocket.emit('player_action', {
        action: {
          type: 'raise',
          amount: 50
        }
      });
    }, 1000);
  } else if (gameUpdateCount === 3) {
    logTest('Raise action processed', true, `Current bet: ${data.gameState.currentBet}`);
    
    setTimeout(() => {
      console.log('\n🎯 Core game flow tests complete!');
      cleanup();
    }, 1000);
  }
});

// Error handlers
player1Socket.on('room_error', (data) => {
  logTest('Room error', false, data.message);
  cleanup();
});

player1Socket.on('game_error', (data) => {
  logTest('Game action', false, data.message);
});

player1Socket.on('connect_error', (error) => {
  logTest('Player 1 connection', false, error.message);
  cleanup();
});

setTimeout(() => {
  console.error('\n❌ Test timeout');
  cleanup();
}, 15000);
