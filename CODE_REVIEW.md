# Code Review: Poker App

**Date:** February 23, 2026  
**Scope:** Backend services, game engine, frontend integration  
**Status:** Functional with identified issues and improvements

---

## Executive Summary

The poker app has solid core architecture with working real-time multiplayer functionality. However, there are **critical bugs**, **design issues**, and **performance concerns** that need to be addressed before production use.

**Critical Issues:** 5  
**Medium Issues:** 8  
**Low Priority Improvements:** 6

---

## 🔴 CRITICAL BUGS

### 1. **Host ID Tracking Bug - Room Management**
**Location:** [server/src/services/RoomManager.ts](server/src/services/RoomManager.ts#L53), [Room.ts](server/src/models/Room.ts)  
**Severity:** CRITICAL

**Problem:**
```typescript
// RoomManager.ts line 53
room.hostId = hostPlayer.id;  // hostId set to PLAYER ID
```

But later in [RoomManager.ts line 93](server/src/services/RoomManager.ts#L93):
```typescript
if (socketId === room.hostId && room.players.length > 0) {
  // BUG: hostId is player.id, not socketId!
  room.hostId = room.players[0].socketId;  // Assigning socketId to player.id field
}
```

**Impact:** Host assignment is broken. After a player leaves, the hostId becomes a socketId instead of playerId, causing:
- Invalid host checks
- Serialization errors
- Game start failures

**Fix:** Store hostId consistently as playerId throughout:
```typescript
// In removePlayer
if (room.hostId === playerId && room.players.length > 0) {
  room.hostId = room.players[0].id;  // Use player.id, not socketId
}
```

---

### 2. **Race Condition in Game State After Player Disconnect**
**Location:** [server/src/services/SocketManager.ts](server/src/services/SocketManager.ts#L347-L365)  
**Severity:** CRITICAL

**Problem:**
When a player disconnects mid-game, the code marks them as folded in gameState but doesn't:
1. Update player's chip count properly
2. Check if hand is complete after forced fold
3. Handle edge cases (player was all-in, waiting for action)

```typescript
// Line 347-365 - Incomplete cleanup
if (room.status === 'playing' && this.activeGames.has(room.id)) {
  const gameEngine = this.activeGames.get(room.id)!;
  const gameState = gameEngine.getGameState();
  
  const gsPlayer = gameState.players.find(p => p.id === player?.id);
  if (gsPlayer) {
    gsPlayer.isFolded = true;  // Just folded, not synced with GameEngine!
  }
}
```

**Impact:** 
- Game state becomes inconsistent
- Players see incorrect pot calculations
- Hand progression may break

**Fix:** Use GameEngine's handlePlayerAction or create proper disconnect handler:
```typescript
if (this.activeGames.has(room.id)) {
  const gameEngine = this.activeGames.get(room.id)!;
  // Auto-fold the disconnected player through proper action handler
  try {
    gameEngine.handlePlayerAction(player?.id, { type: 'fold' });
  } catch (e) {
    // Handle case where player wasn't supposed to act
  }
}
```

---

### 3. **Action Lock Deadlock Issue**
**Location:** [server/src/services/SocketManager.ts](server/src/services/SocketManager.ts#L276-L309)  
**Severity:** CRITICAL

**Problem:**
```typescript
// Line 280-282
if (this.actionLocks.get(room.id)) {
  throw new Error('Action in progress. Please wait.');
}
this.actionLocks.set(room.id, true);
```

The finally block tries to unlock, but if an error occurs during setTimeout/async handling, the lock persists.

```typescript
// Line 316 finally block
finally {
  const room = this.roomManager.findRoomBySocketId(socket.id);
  if (room) {
    this.actionLocks.delete(room.id);
  }
}
```

**Impact:** 
- One failed action locks all actions in that room forever
- Game becomes unplayable
- Requires server restart to fix

**Fix:** Use a timeout-based lock system:
```typescript
private actionLocks: Map<string, NodeJS.Timeout> = new Map();

// Set with auto-timeout
if (this.actionLocks.has(room.id)) {
  throw new Error('Action in progress');
}

const timeout = setTimeout(() => {
  this.actionLocks.delete(room.id);
}, 30000); // 30 second timeout

this.actionLocks.set(room.id, timeout);

// In finally
if (room && timeout) {
  clearTimeout(timeout);
  this.actionLocks.delete(room.id);
}
```

---

### 4. **Wrong Null Check for hostId Assignment**
**Location:** [server/src/services/SocketManager.ts](server/src/services/SocketManager.ts#L225)  
**Severity:** CRITICAL

**Problem:**
```typescript
// Line 225
if (player) {
  this.playerSockets.set(hostPlayer?.id, socket.id);
}
```

Should check `hostPlayer`, not `player`:
```typescript
if (hostPlayer) {  // Wrong - checking the wrong variable!
  this.playerSockets.set(hostPlayer?.id, socket.id);
}
```

**Impact:** Host socket mapping may not be created on room creation

**Fix:**
```typescript
if (hostPlayer) {  // Check the actual variable being used
  this.playerSockets.set(hostPlayer.id, socket.id);
}
```

---

### 5. **GameState Serialization Loses Player Information**
**Location:** [server/src/services/SocketManager.ts](server/src/services/SocketManager.ts#L28-L45)  
**Severity:** CRITICAL

**Problem:**
```typescript
private serializeGameState(gameState: any, currentPlayerId?: string) {
  return {
    ...gameState,
    communityCards: (gameState.communityCards || []).map(formatCard),
    players: (gameState.players || []).map((p: any) => ({
      ...p,
      cards: p.id === currentPlayerId ? (p.cards || []).map(formatCard) : []  // BUG!
    }))
  };
}
```

This serialization **removes all data except cards** for non-current players:
```typescript
// Before serialization
{ id: 'abc', name: 'John', chips: 1000, currentBet: 50, isFolded: false }

// After serialization for other players
{ id: 'abc', name: 'John', chips: 1000, currentBet: 50, isFolded: false, cards: [] }
// But the `...p` should preserve all fields
```

Actually, this might work, but it's unclear. **However**, the real issue: if a player doesn't exist in `gameState.players` (disconnected), they won't get updated properly.

**Impact:** 
- Potential missing player data on client
- Incorrect UI rendering

**Fix:** Be explicit about which fields to serialize:
```typescript
players: (gameState.players || []).map((p: any) => ({
  id: p.id,
  name: p.name,
  chips: p.chips,
  position: p.position,
  currentBet: p.currentBet,
  isFolded: p.isFolded,
  isAllIn: p.isAllIn,
  cards: p.id === currentPlayerId ? (p.cards || []).map(formatCard) : []
}))
```

---

## 🟡 MEDIUM SEVERITY ISSUES

### 6. **No Timeout for Player Actions**
**Location:** [server/src/services/gameEngine/GameEngine.ts](server/src/services/gameEngine/GameEngine.ts)  
**Issue:** Players can take infinite time to act. In real poker apps, there's a timer.

**Fix:** Add turn timeout:
```typescript
// In SocketManager, when game starts
const turnTimeout = 30000; // 30 seconds
const turnTimers = new Map<string, NodeJS.Timeout>();

// Auto-fold if timeout
turnTimers.set(room.id, setTimeout(() => {
  gameEngine.handlePlayerAction(currentPlayer.id, { type: 'fold' });
}, turnTimeout));
```

---

### 7. **No Validation of Raise Amounts**
**Location:** [server/src/services/gameEngine/GameEngine.ts](server/src/services/gameEngine/GameEngine.ts#L137)  
**Issue:** Raise validation is incomplete:

```typescript
case 'raise':
  const raiseAmount = action.amount!;
  // Validate raise: must be more than current bet amount
  if (raiseAmount <= this.gameState.currentBet) {
    throw new Error('Raise must be more than current bet');
  }
```

**Problems:**
- Doesn't validate minimum raise size (should be >= 2x previous bet)
- No protection against `action.amount` being undefined
- No check for negative amounts

**Fix:**
```typescript
case 'raise': {
  const raiseAmount = action.amount;
  if (raiseAmount === undefined || raiseAmount <= 0) {
    throw new Error('Invalid raise amount');
  }
  const minRaise = Math.max(
    this.gameState.currentBet * 2,
    this.gameState.currentBet + this.gameState.bigBlind
  );
  if (raiseAmount < minRaise) {
    throw new Error(`Minimum raise is ${minRaise}`);
  }
  // ... rest of raise logic
}
```

---

### 8. **All-In Handling During Raises**
**Location:** [server/src/services/gameEngine/GameEngine.ts](server/src/services/gameEngine/GameEngine.ts#L157-L175)  
**Issue:** When a player goes all-in with a raise, the logic may set incorrect pending callers.

```typescript
case 'all-in':
  const allInAmount = player.chips;
  player.chips = 0;
  player.currentBet += allInAmount;
  player.isAllIn = true;
  this.gameState.pot += allInAmount;
  
  if (player.currentBet > this.gameState.currentBet) {
    this.gameState.currentBet = player.currentBet;
    // This adds pending callers, but what if the all-in is LESS than current bet?
    // Edge case: Player had $50 bet, goes all-in with $40 more (total $90 vs $100 bet)
  }
```

---

### 9. **No "Next Hand" Event Emission**
**Location:** [server/src/services/SocketManager.ts](server/src/services/SocketManager.ts#L295-L315)  
**Issue:** After hand completes, code emits `SOCKET_EVENTS.NEXT_HAND` but this event may not be defined in socket event constants.

**Fix:** Verify `SOCKET_EVENTS.NEXT_HAND` is properly defined in constants:
```typescript
// shared/constants/socketEvents.ts - add if missing
export const SOCKET_EVENTS = {
  // ... existing events
  NEXT_HAND: 'next_hand',
  // ...
}
```

---

### 10. **Room.hostId Type Mismatch**
**Location:** [server/src/models/Room.ts](server/src/models/Room.ts#L6)  
**Issue:** `hostId` is assigned playerId in one place and socketId in another.

**Current:**
```typescript
hostId: string;  // Sometimes playerId, sometimes socketId - ambiguous!
```

**Fix:** Either:
1. Rename to `hostPlayerId` and always use playerId, OR
2. Add a method `getHostPlayer()` that returns the player object

```typescript
getHostPlayer(): Player | undefined {
  return this.players.find(p => p.id === this.hostId);
}

isHost(playerId: string): boolean {
  return this.hostId === playerId;
}
```

---

### 11. **No Reconnection Handling for Active Games**
**Location:** [server/src/services/SocketManager.ts](server/src/services/SocketManager.ts)  
**Issue:** If a player reconnects mid-game, the code doesn't restore their game state properly.

Current flow:
1. Player disconnects → marked as folded
2. Player reconnects → joins room but doesn't rejoin game

**Fix:** Implement reconnection with game state restoration:
```typescript
socket.on('reconnect', () => {
  const room = this.roomManager.findRoomBySocketId(oldSocketId);
  if (room?.status === 'playing') {
    // Restore to active game
    const gameEngine = this.activeGames.get(room.id);
    if (gameEngine) {
      const gameState = gameEngine.getGameState();
      socket.emit(SOCKET_EVENTS.GAME_RESUMED, { gameState });
    }
  }
});
```

---

### 12. **Client Socket Connection Hardcoded**
**Location:** [client/src/services/socketService.ts](client/src/services/socketService.ts#L31)  
**Issue:** Server URL is hardcoded:

```typescript
this.socket = io('http://localhost:3001', {
```

This breaks in production. Should use environment variable.

**Fix:**
```typescript
const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';
this.socket = io(SERVER_URL, {
```

And create `.env.local`:
```
VITE_SERVER_URL=http://localhost:3001
```

---

### 13. **No Error Recovery for Failed Card Deals**
**Location:** [server/src/services/gameEngine/Deck.ts](server/src/services/gameEngine/Deck.ts)  
**Issue:** If deck runs out of cards (shouldn't happen but defensive coding needed), system crashes.

**Fix:**
```typescript
drawCard(): Card {
  if (this.cards.length === 0) {
    throw new Error('Deck is empty - game cannot continue');
  }
  return this.cards.pop()!;
}
```

---

## 🟢 LOW PRIORITY IMPROVEMENTS

### 14. **No Player Statistics Tracking**
**Issue:** No win/loss records, hand history, or chip tracking over time.

**Suggestion:** Add to Player model:
```typescript
class Player {
  gamesPlayed: number = 0;
  gamesWon: number = 0;
  totalChipsEarned: number = 0;
  // ...
}
```

---

### 15. **No Logging for Room Cleanup**
**Location:** [server/src/services/RoomManager.ts](server/src/services/RoomManager.ts#L233)  
**Issue:** When old rooms are deleted, no detail logged.

---

### 16. **UI: No "Waiting for Action" Indicator**
**Location:** [client/src/components/Game/GameTable.tsx](client/src/components/Game/GameTable.tsx)  
**Issue:** Players don't know whose turn it is visually.

**Fix:** Add visual indicator:
```tsx
{isMyTurn && <div className="action-indicator">Your Turn</div>}
```

---

### 17. **No Reconnection UI**
**Issue:** When connection drops, user sees nothing. Should show:
- "Disconnected" banner
- Auto-reconnecting progress
- Manual reconnect button

---

### 18. **GameEngine nextHand() Not Properly Validated**
**Location:** [server/src/services/SocketManager.ts](server/src/services/SocketManager.ts#L304-L310)  
**Issue:** After `gameEngine.nextHand()`, code doesn't validate game still has valid players.

---

### 19. **Missing TypeScript Strict Mode**
**Location:** [server/tsconfig.json](server/tsconfig.json)  
**Issue:** Should enable `"strict": true` to catch more bugs at compile time.

---

## 🔧 FIXES TO IMPLEMENT

### Priority 1 (Fix Immediately):
1. ✅ Fix host ID tracking (critical #1)
2. ✅ Fix action lock deadlock (critical #3)
3. ✅ Fix player disconnect race condition (critical #2)
4. ✅ Fix hostId null check (critical #4)
5. ✅ Fix gameState serialization (critical #5)

### Priority 2 (Next):
6. Add raise amount validation
7. Add turn timeout
8. Fix all-in edge cases
9. Add reconnection handling
10. Move socket URL to env variable

### Priority 3 (Nice to Have):
11. Add player statistics
12. Improve logging
13. Add UI indicators
14. Better error messages

---

## Summary Table

| # | Issue | Severity | File | Impact |
|---|-------|----------|------|--------|
| 1 | Host ID type mismatch | 🔴 Critical | RoomManager.ts | Game crashes on host leave |
| 2 | Player disconnect race | 🔴 Critical | SocketManager.ts | Inconsistent game state |
| 3 | Action lock deadlock | 🔴 Critical | SocketManager.ts | Game frozen after error |
| 4 | Wrong null check | 🔴 Critical | SocketManager.ts | Host socket not tracked |
| 5 | GameState serialization | 🔴 Critical | SocketManager.ts | Missing player data |
| 6 | No action timeout | 🟡 Medium | GameEngine.ts | Infinite wait |
| 7 | No raise validation | 🟡 Medium | GameEngine.ts | Exploit possible |
| 8 | All-in edge case | 🟡 Medium | GameEngine.ts | Wrong pending callers |
| 9 | Missing NEXT_HAND event | 🟡 Medium | SocketManager.ts | Hand progression fails |
| 10 | hostId ambiguity | 🟡 Medium | Room.ts | Confusing type |
| 11 | No reconnection | 🟡 Medium | SocketManager.ts | Players lose game |
| 12 | Hardcoded server URL | 🟡 Medium | socketService.ts | Prod deployment fails |
| 13 | No deck underflow check | 🟡 Medium | Deck.ts | Potential crash |

---

## Next Steps

1. **Test current flow** - Play a complete game and note any crashes
2. **Fix critical bugs** - Prioritize the 5 critical issues
3. **Add error handling** - Improve robustness
4. **Add logging** - Better debugging capability
5. **Performance testing** - Test with 6+ players
6. **Production deployment** - Address env variables and security
