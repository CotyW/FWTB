# 🃏 Poker App - Complete Setup Guide

## ✅ All Files Created

### Client Components (Frontend)
- ✅ `index.html` - Main HTML with loading screen
- ✅ `main.tsx` - React entry point
- ✅ `App.tsx` - Main app component with routing
- ✅ `index.css` - Global styles
- ✅ `vite.config.ts` - Vite configuration
- ✅ `tsconfig.json` - TypeScript config
- ✅ `tsconfig.node.json` - Vite TS config
- ✅ `package.json` - Dependencies

**Components:**
- ✅ `LobbyView.tsx` + CSS - Create/join game interface
- ✅ `GameTable.tsx` + CSS - Main poker table
- ✅ `PlayerSeat.tsx` + CSS - Individual player display
- ✅ `PlayerControls.tsx` + CSS - Betting controls with slider
- ✅ `CommunityCards.tsx` + CSS - Flop/turn/river display
- ✅ `PotDisplay.tsx` + CSS - Pot amount with chips animation
- ✅ `Card.tsx` + CSS - Playing card component

**Hooks & Types:**
- ✅ `useSocket.ts` - Socket.io connection management
- ✅ `game.types.ts` - All TypeScript types

### Server Components (Backend)
- ✅ `server.ts` - Server entry point with Socket.io
- ✅ `package.json` - Dependencies
- ✅ `tsconfig.json` - TypeScript config

**Game Engine:**
- ✅ `GameEngine.ts` - Core game orchestration
- ✅ `Deck.ts` - Card shuffling and dealing
- ✅ `HandEvaluator.ts` - Hand ranking (uses pokersolver)
- ✅ `PotManager.ts` - Main pot and side pots

**Services:**
- ✅ `SocketManager.ts` - WebSocket event handlers
- ✅ `RoomManager.ts` - Room creation and player management

**Routes & Middleware:**
- ✅ `gameRoutes.ts` - HTTP endpoints (optional)
- ✅ `roomRoutes.ts` - Room endpoints (optional)
- ✅ `errorHandler.ts` - Error handling middleware

### Configuration Files
- ✅ `.env.example` - Environment variable templates
- ✅ `.gitignore` - Git ignore patterns
- ✅ `README.md` - Full documentation

---

## 📦 Installation Steps

### 1. Install Server Dependencies
```bash
cd server
npm install
```

**Server Dependencies:**
- express
- socket.io
- cors
- dotenv
- uuid
- pokersolver

**Dev Dependencies:**
- typescript
- @types/express
- @types/node
- @types/cors
- @types/uuid
- nodemon
- ts-node

### 2. Install Client Dependencies
```bash
cd client
npm install
```

**Client Dependencies:**
- react
- react-dom
- socket.io-client

**Dev Dependencies:**
- @types/react
- @types/react-dom
- typescript
- vite
- @vitejs/plugin-react

### 3. Create Environment Files

**server/.env:**
```env
PORT=3001
CLIENT_URL=http://localhost:3000
NODE_ENV=development
```

**client/.env:**
```env
VITE_API_URL=http://localhost:3001
```

---

## 🚀 Running the Application

### Terminal 1 - Start Server
```bash
cd server
npm run dev
```
Server runs on: http://localhost:3001

### Terminal 2 - Start Client
```bash
cd client
npm run dev
```
Client runs on: http://localhost:3000

### Terminal 3 - Build for Production
```bash
# Build server
cd server
npm run build

# Build client
cd client
npm run build
```

---

## 🎮 How to Play

1. **Open browser** → http://localhost:3000
2. **Create a game:**
   - Click "Create Room"
   - Enter your name
   - Set the starting stack
   - Get a 6-character room code (e.g., "A3K9B2")
3. **Share the code** with friends
4. **Friends join:**
   - Click "Join Room"
   - Enter their name
   - Enter the room code
5. **Start the Sit-and-Go** with 2-6 players and play until one player remains.

---

## 🌐 Deployment Guide

### Backend Deployment (Railway)
1. Go to [railway.app](https://railway.app)
2. New Project → Deploy from GitHub
3. Select `server` folder
4. Add environment variables:
   ```
   PORT=3001
   CLIENT_URL=https://your-frontend-url.vercel.app
   NODE_ENV=production
   ```
5. Deploy → Get URL: `https://poker-server.railway.app`

### Frontend Deployment (Vercel)
1. Go to [vercel.com](https://vercel.com)
2. New Project → Import from GitHub
3. Configure:
   - Root Directory: `client`
   - Build Command: `npm run build`
   - Output Directory: `dist`
4. Add environment variable:
   ```
   VITE_API_URL=https://poker-server.railway.app
   ```
5. Deploy → Get URL: `https://poker-game.vercel.app`

### Share with Friends
Send them: `https://poker-game.vercel.app`

---

## 🔧 Troubleshooting

### Server won't start
- Check if port 3001 is available
- Verify all dependencies installed: `npm install`
- Check `.env` file exists with correct values

### Client won't connect
- Verify server is running on port 3001
- Check `VITE_API_URL` in client `.env`
- Check browser console for errors

### CORS errors
- Verify `CLIENT_URL` in server `.env` matches client URL
- Check server logs for CORS configuration

### Cards not displaying
- Verify all CSS files are imported
- Check browser console for missing files

---

## 📝 Features Checklist

### ✅ Implemented
- [x] Room creation with shareable codes
- [x] Real-time multiplayer Sit-and-Go (2-6 players)
- [x] Full Texas Hold'em rules
- [x] Hand evaluation (Royal Flush → High Card)
- [x] Betting rounds (pre-flop, flop, turn, river)
- [x] All-in support
- [x] Side pots for all-ins
- [x] Dealer button rotation
- [x] Blinds increase on a host-configurable level timer
- [x] Rebuys allowed through level 4
- [x] Tournament winner and player eliminations
- [x] Responsive UI
- [x] Player disconnection handling
- [x] Waiting room
- [x] Beautiful poker table design
- [x] Betting slider with quick bet options

### 🔄 Future Enhancements
- [ ] Hand history
- [ ] Player statistics
- [ ] Chat system
- [ ] Spectator mode
- [ ] Player avatars
- [ ] Sound effects
- [ ] Animations (card dealing, chip stacking)
- [ ] Reconnection after disconnect
- [ ] Multiple tables

---

## 📁 Project Structure Summary

```
poker-app/
├── client/          # React frontend (Vite)
├── server/          # Node.js backend (Express + Socket.io)
├── shared/          # Shared types (optional)
├── .gitignore
└── README.md
```

---

## 🎯 Key Technologies

**Frontend:**
- React 18
- TypeScript
- Socket.io Client
- Vite
- CSS3 (Animations, Flexbox, Grid)

**Backend:**
- Node.js
- Express
- Socket.io
- TypeScript
- pokersolver (hand evaluation)

---

## 🆘 Support

If you encounter issues:
1. Check this guide
2. Review console errors (browser & server)
3. Verify all files created correctly
4. Check environment variables
5. Ensure all dependencies installed

---

## 🎉 You're Ready!

All files are created and documented. Follow the installation steps above and you'll be playing poker with friends in minutes!

**Quick Start:**
```bash
# Install & run server
cd server && npm install && npm run dev

# Install & run client (new terminal)
cd client && npm install && npm run dev

# Open browser
http://localhost:3000
```

Good luck at the tables! 🃏♠️♥️♣️♦️