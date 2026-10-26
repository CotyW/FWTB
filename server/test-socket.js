const { io } = require('socket.io-client');

console.log('Connecting to Socket.io server at http://localhost:3001...');

const socket = io('http://localhost:3001', {
  transports: ['websocket', 'polling']
});

socket.on('connect', () => {
  console.log('✅ Connected to server!');
  console.log('Socket ID:', socket.id);
  
  // Test creating a room
  console.log('\n📝 Testing CREATE_ROOM...');
  socket.emit('create_room', {
    playerName: 'TestPlayer',
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

socket.on('room_created', (data) => {
  console.log('✅ Room created successfully!');
  console.log('Room data:', JSON.stringify(data, null, 2));
  
  // Disconnect after test
  setTimeout(() => {
    console.log('\n👋 Disconnecting...');
    socket.disconnect();
    process.exit(0);
  }, 1000);
});

socket.on('room_error', (data) => {
  console.error('❌ Room error:', data);
  socket.disconnect();
  process.exit(1);
});

socket.on('connect_error', (error) => {
  console.error('❌ Connection error:', error.message);
  process.exit(1);
});

socket.on('disconnect', () => {
  console.log('Disconnected from server');
});

// Timeout after 5 seconds
setTimeout(() => {
  console.error('❌ Test timeout');
  process.exit(1);
}, 5000);
