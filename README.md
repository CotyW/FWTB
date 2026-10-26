# Texas Hold'em Poker - Online Multiplayer

A real-time online poker application for playing Texas Hold'em with friends. Create private rooms, share a room code, and play sit-and-go style games.

## Features

- 🎮 **Sit-and-Go Tournaments**: Play a single-table tournament with 2-6 players
- 🔗 **Easy Sharing**: Share a simple 6-character room code with friends
- 🃏 **Full Texas Hold'em Rules**: Complete poker game engine with proper hand evaluation
- 💰 **Tournament Play**: Equal starting stacks, escalating blinds, and a champion when one player has all the chips
- 🎨 **Beautiful UI**: Clean, modern poker table interface
- 📱 **Responsive Design**: Works on desktop and mobile devices

## Tech Stack

### Backend
- **Node.js** + **Express**: Server framework
- **Socket.io**: Real-time WebSocket communication
- **TypeScript**: Type-safe development
- **pokersolver**: Poker hand evaluation library

### Frontend
- **React**: UI framework
- **TypeScript**: Type-safe development
- **Socket.io-client**: Real-time communication
- **Vite**: Fast build tool

## Getting Started

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn

### Installation

1. **Clone the repository**
```bash
git clone <your-repo-url>
cd poker-app
```

2. **Install server dependencies**
```bash
cd server
npm install
```

3. **Install client dependencies**
```bash
cd ../client
npm install
```

4. **Set up environment variables**

Server `.env`:
```bash
cp server/.env.example server/.env
```

Client `.env`:
```bash
cp client/.env.example client/.env
```

### Running Locally

From the project root, install everything once and start both apps with one command:
```bash
npm run install:all
npm run dev
```
Server runs on `http://localhost:3001` and the client on `http://localhost:3000`. Open the client in several browser tabs for multiple players.

Or run them separately: `npm run dev` inside `server/` and inside `client/`.

## How to Play

1. **Create a Sit-and-Go**
   - Click "Create Room"
   - Enter your name
   - Choose the starting chip stack
   - Share the 6-character room code with up to five other players

2. **Join a Game**
   - Click "Join Game"
   - Enter your name
   - Enter the room code shared by your friend

3. **Play Poker**
   - Wait for all players to join
   - Host starts the game
   - Play a single-table Texas Hold'em tournament
   - Everyone starts with the same stack; blinds start at 10/20 and rise on a timer the host sets (1–60 min per level, default 10)
   - Busted players can rebuy between hands during the first 4 levels (15s window); after that they are eliminated
   - Players are eliminated when they lose all their chips; the last player remaining wins
   - Betting rounds: Pre-flop, Flop, Turn, River
   - Best hand wins!

## Game Rules

This follows standard **Texas Hold'em** rules:

- Each player receives 2 hole cards (face down)
- 5 community cards are dealt face-up (flop, turn, river)
- Players make the best 5-card hand using any combination of their 2 hole cards and 5 community cards
- Betting rounds occur before the flop, after the flop, turn, and river
- Players can fold, check, call, raise, or go all-in
- Best hand wins the pot (with side pots for all-ins)

### Hand Rankings (highest to lowest)
1. Royal Flush
2. Straight Flush
3. Four of a Kind
4. Full House
5. Flush
6. Straight
7. Three of a Kind
8. Two Pair
9. Pair
10. High Card

## Project Structure

```
poker-app/
├── client/          # React frontend
│   ├── src/
│   │   ├── components/   # UI components
│   │   ├── hooks/        # Custom React hooks
│   │   ├── types/        # TypeScript types
│   │   └── App.tsx       # Main app component
│   └── package.json
│
├── server/          # Node.js backend
│   ├── src/
│   │   ├── services/     # Game engine & business logic
│   │   ├── models/       # Data models
│   │   ├── routes/       # API routes
│   │   └── server.ts     # Server entry point
│   └── package.json
│
└── shared/          # Shared types between client/server
    └── types/
```

## Deployment

The server also serves the built client, so the whole game deploys as **one web service with one URL**. [render.yaml](./render.yaml) is set up for [Render](https://render.com) (free tier).

1. Push this repo to GitHub (`node_modules/` and `dist/` are git-ignored).
2. In Render: **New > Blueprint**, pick the repo, and approve `render.yaml`.
3. When the build finishes, share the `https://poker-app-xxxx.onrender.com` URL with friends. One person creates a room and shares the room code.

Notes:
- The free tier sleeps after ~15 minutes idle; the first load then takes ~30-60s. Open the URL a minute before game time.
- Rooms live in memory, so a restart or redeploy ends running games.
- Any other Node host works too: build with `npm install --prefix client && npm install --prefix server && npm run build`, start with `npm start --prefix server`.
- If you host the client separately, set `VITE_API_URL` (client build) to the server URL and `CLIENT_URL` (server) to the client URL.

## Development

### Running Tests
```bash
# Server tests (Vitest): engine, side pots, heads-up, blind levels, rebuys, hand evaluator
cd server
npm test
```

Other features: a 30-second action timer per turn (auto-check or auto-fold), and spectators, who can watch a started game by room code. Eliminated players keep spectating until the game ends.

### Building for Production
```bash
# Build server
cd server
npm run build

# Build client
cd client
npm run build
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - feel free to use this for your own projects!

## Future Enhancements

- [x] Sit-and-go tournament mode (increasing blinds, eliminations, and a champion)
- [ ] Player statistics and history
- [ ] Chat functionality
- [ ] Spectator mode
- [ ] Multiple table support
- [ ] Audio effects and animations
- [ ] Player avatars
- [ ] Reconnection handling
- [ ] Hand history replay

## Support

If you encounter any issues or have questions, please open an issue on GitHub.

---

**Have fun playing poker with your friends! 🎰**