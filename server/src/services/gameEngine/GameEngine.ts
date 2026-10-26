import { Deck } from './Deck';
import { HandEvaluator } from './HandEvaluator';
import { GameState, Player, Card, BettingAction, GameConfig } from '../../../../shared/types/game.types';
import { GAME_CONFIG, BLIND_SCHEDULE } from '../../../../shared/constants/gameConfig';

export class GameEngine {
  private gameState: GameState;
  private deck: Deck;
  private handEvaluator: HandEvaluator;
  private handContributions: Map<string, number> = new Map();
  private actedThisRound: Set<string> = new Set();
  private pendingCallers: Set<string> = new Set();
  private lastAggressorId: string | null = null;
  // Size of the last full raise this round; the next raise must be at least this big
  private lastRaiseSize = 0;
  // Players who may not raise because a short all-in did not re-open the betting to them
  private raiseLocked: Set<string> = new Set();
  private turnDeadline = 0;

  setTurnDeadline(deadline: number): void {
    this.turnDeadline = deadline;
  }
  private handsPlayed = 0;
  private readonly startingSmallBlind: number;
  private readonly startingBigBlind: number;
  private readonly startingChips: number;
  private readonly levelMs: number;
  private levelStartedAt: number | null = null;
  // Overridable clock so level timing can be tested
  now: () => number = () => Date.now();

  constructor(roomId: string, players: Player[], config: GameConfig) {
    this.deck = new Deck();
    this.handEvaluator = new HandEvaluator();
    this.startingSmallBlind = config.smallBlind;
    this.startingBigBlind = config.bigBlind;
    this.startingChips = config.startingChips;
    this.levelMs = (config.levelMinutes ?? GAME_CONFIG.DEFAULT_LEVEL_MINUTES) * 60 * 1000;
    
    this.gameState = {
      roomId,
      players: players.map((p, idx) => ({
        ...p,
        chips: config.startingChips,
        cards: [],
        position: idx,
        isFolded: false,
        isAllIn: false,
        currentBet: 0
      })),
      communityCards: [],
      pot: 0,
      currentBet: 0,
      dealerPosition: 0,
      currentPlayerIndex: 0,
      stage: 'waiting', // waiting, preflop, flop, turn, river, showdown
      smallBlind: config.smallBlind,
      bigBlind: config.bigBlind,
      handNumber: 0,
      blindLevel: 1,
      levelEndsAt: 0,
      serverTime: 0,
      rebuyOpen: true,
      minRaiseTo: 0,
      canRaise: true,
      turnEndsAt: 0
    };
  }

  startHand(): void {
    this.handsPlayed++;
    if (this.levelStartedAt === null) {
      this.levelStartedAt = this.now();
    }
    const blindLevel = this.getCurrentLevel();
    this.gameState.blindLevel = blindLevel;
    this.gameState.handNumber = this.handsPlayed;
    this.gameState.smallBlind = this.blindsForLevel(this.startingSmallBlind, blindLevel);
    this.gameState.bigBlind = this.blindsForLevel(this.startingBigBlind, blindLevel);

    // Reset for new hand
    this.deck.shuffle();
    this.gameState.communityCards = [];
    this.gameState.pot = 0;
    this.gameState.currentBet = 0;
    this.gameState.winners = undefined;
    
    // Reset players
    this.gameState.players.forEach(player => {
      player.cards = [];
      player.isFolded = false;
      player.isAllIn = false;
      player.currentBet = 0;
      this.handContributions.set(player.id, 0);
    });

    // Post blinds
    this.postBlinds();
    
    // Deal hole cards
    this.dealHoleCards();
    
    // Set game stage
    this.gameState.stage = 'preflop';
    
    // Set first player to act (after big blind)
    const bigBlindIndex = (this.gameState.dealerPosition
      + (this.gameState.players.length === 2 ? 1 : 2)) % this.gameState.players.length;
    this.gameState.currentPlayerIndex = this.getNextPlayerIndex(bigBlindIndex);

    // Initialize per-round tracking
    this.actedThisRound.clear();
    this.pendingCallers.clear();
    this.gameState.players.forEach(player => {
      if (!player.isFolded && !player.isAllIn && player.chips > 0) {
        this.pendingCallers.add(player.id);
      }
    });
    this.lastAggressorId = null;
    this.lastRaiseSize = this.gameState.bigBlind;
    this.raiseLocked.clear();
    this.autoAdvanceWhenNoActionsNeeded();
  }

  private postBlinds(): void {
    const smallBlindIdx = (this.gameState.dealerPosition + 1) % this.gameState.players.length;
    const bigBlindIdx = (this.gameState.dealerPosition
      + (this.gameState.players.length === 2 ? 1 : 2)) % this.gameState.players.length;
    const actualSmallBlindIdx = this.gameState.players.length === 2
      ? this.gameState.dealerPosition
      : smallBlindIdx;
    
    const sbPlayer = this.gameState.players[actualSmallBlindIdx];
    const bbPlayer = this.gameState.players[bigBlindIdx];
    
    // Small blind
    const sbAmount = Math.min(sbPlayer.chips, this.gameState.smallBlind);
    sbPlayer.chips -= sbAmount;
    sbPlayer.currentBet = sbAmount;
    sbPlayer.isAllIn = sbPlayer.chips === 0;
    this.gameState.pot += sbAmount;
    this.recordContribution(sbPlayer.id, sbAmount);
    
    // Big blind
    const bbAmount = Math.min(bbPlayer.chips, this.gameState.bigBlind);
    bbPlayer.chips -= bbAmount;
    bbPlayer.currentBet = bbAmount;
    bbPlayer.isAllIn = bbPlayer.chips === 0;
    this.gameState.pot += bbAmount;
    this.recordContribution(bbPlayer.id, bbAmount);
    this.gameState.currentBet = bbAmount;
  }

  private dealHoleCards(): void {
    this.gameState.players.forEach(player => {
      if (!player.isFolded) {
        player.cards = [this.deck.drawCard(), this.deck.drawCard()];
      }
    });
  }

  handlePlayerAction(playerId: string, action: BettingAction): GameState {
    const player = this.gameState.players.find(p => p.id === playerId);
    if (!player) throw new Error('Player not found');

    // Enforce turn order: only current player may act
    const currentPlayer = this.gameState.players[this.gameState.currentPlayerIndex];
    if (!currentPlayer || currentPlayer.id !== playerId) {
      throw new Error('Not your turn');
    }

    // Validate action
    if (player.isFolded) {
      throw new Error('Player has already folded');
    }
    if (player.chips === 0 && action.type !== 'fold') {
      throw new Error('Cannot act when out of chips');
    }
    
    switch (action.type) {
      case 'fold':
        player.isFolded = true;
        // A folded player no longer needs to respond
        this.pendingCallers.delete(playerId);
        break;
      
      case 'check':
        if (player.currentBet !== this.gameState.currentBet) {
          throw new Error('Cannot check when there is a bet to call');
        }
        // Check counts as an action when there is no outstanding bet
        this.pendingCallers.delete(playerId);
        break;
      
      case 'call':
        const callAmount = Math.min(
          this.gameState.currentBet - player.currentBet,
          player.chips
        );
        player.chips -= callAmount;
        player.currentBet += callAmount;
        this.gameState.pot += callAmount;
        this.recordContribution(playerId, callAmount);
        if (player.chips === 0) player.isAllIn = true;
        // Caller has responded to the raise
        this.pendingCallers.delete(playerId);
        break;
      
      case 'raise':
        const raiseAmount = action.amount!;
        if (this.raiseLocked.has(playerId)) {
          throw new Error('Betting was not re-opened by the short all-in; you can only call or fold');
        }
        // Validate raise: must be more than current bet amount
        if (raiseAmount <= this.gameState.currentBet) {
          throw new Error('Raise must be more than current bet');
        }
        if (raiseAmount > player.chips + player.currentBet) {
          throw new Error('Insufficient chips for this raise');
        }
        // A raise must be at least the last raise size, unless it puts the player all in
        const minRaiseTo = this.gameState.currentBet + this.lastRaiseSize;
        const isAllInRaise = raiseAmount === player.chips + player.currentBet;
        if (raiseAmount < minRaiseTo && !isAllInRaise) {
          throw new Error(`Minimum raise is to ${minRaiseTo}`);
        }
        const previousBet = this.gameState.currentBet;
        const betToAdd = raiseAmount - player.currentBet;
        player.chips -= betToAdd;
        player.currentBet = raiseAmount;
        this.gameState.pot += betToAdd;
        this.recordContribution(playerId, betToAdd);
        this.gameState.currentBet = raiseAmount;
        if (player.chips === 0) player.isAllIn = true;
        this.registerAggression(playerId, previousBet);
        break;

      case 'all-in':
        if (this.raiseLocked.has(playerId) && player.currentBet + player.chips > this.gameState.currentBet) {
          throw new Error('Betting was not re-opened by the short all-in; you can only call or fold');
        }
        const allInAmount = player.chips;
        const betBeforeAllIn = this.gameState.currentBet;
        player.chips = 0;
        player.currentBet += allInAmount;
        player.isAllIn = true;
        this.gameState.pot += allInAmount;
        this.recordContribution(playerId, allInAmount);
        // If all-in amount is higher than current bet, it becomes new current bet
        if (player.currentBet > betBeforeAllIn) {
          this.gameState.currentBet = player.currentBet;
          this.registerAggression(playerId, betBeforeAllIn);
        } else {
          // If all-in did not increase the bet, they have responded
          this.pendingCallers.delete(playerId);
        }
        break;

      default:
        throw new Error('Invalid action type');
    }

    // Mark that this player acted this round
    this.actedThisRound.add(playerId);

    // Move to next player
    this.advanceToNextPlayer();
    
    // Check if betting round is complete
    if (this.gameState.players.filter(p => !p.isFolded).length === 1) {
      // Everyone else folded: the hand ends immediately
      this.gameState.stage = 'showdown';
      this.resolveShowdown();
    } else if (this.isBettingRoundComplete()) {
      this.advanceStage();
      // If no players have actions left (all-in or folded), auto-progress to showdown
      this.autoAdvanceWhenNoActionsNeeded();
    }

    return this.getGameState();
  }

  /**
   * Called after a bet or raise has been applied (currentBet already updated).
   * A full raise re-opens the betting for everyone; a short all-in does not
   * re-open it for players who already responded to the previous bet.
   */
  private registerAggression(playerId: string, previousBet: number): void {
    const increase = this.gameState.currentBet - previousBet;
    if (increase >= this.lastRaiseSize) {
      this.lastRaiseSize = increase;
      this.raiseLocked.clear();
    } else if (previousBet > 0) {
      this.actedThisRound.forEach(id => {
        if (id !== playerId && !this.pendingCallers.has(id)) {
          this.raiseLocked.add(id);
        }
      });
    }

    this.lastAggressorId = playerId;
    this.pendingCallers.clear();
    this.gameState.players.forEach(p => {
      if (!p.isFolded && !p.isAllIn && p.id !== playerId) {
        this.pendingCallers.add(p.id);
      }
    });
  }

  private advanceToNextPlayer(): void {
    this.gameState.currentPlayerIndex = this.getNextPlayerIndex(
      this.gameState.currentPlayerIndex
    );
  }

  private getNextPlayerIndex(startIdx: number): number {
    const playerCount = this.gameState.players.length;
    for (let offset = 1; offset <= playerCount; offset++) {
      const index = (startIdx + offset + playerCount) % playerCount;
      const player = this.gameState.players[index];
      if (!player.isFolded && !player.isAllIn && player.chips > 0) {
        return index;
      }
    }
    return (startIdx + 1 + playerCount) % playerCount;
  }

  private isBettingRoundComplete(): boolean {
    // Get players who haven't folded
    const unfoldedPlayers = this.gameState.players.filter(p => !p.isFolded);

    // If 1 or fewer players haven't folded, betting round is complete
    if (unfoldedPlayers.length <= 1) return true;

    // Active players who can make a decision (have chips > 0 and not all-in)
    const activeDecisionMakers = unfoldedPlayers.filter(p => p.chips > 0 && !p.isAllIn);

    // If there is no outstanding bet (currentBet === 0), require everyone to have acted at least once
    if (this.gameState.currentBet === 0) {
      return activeDecisionMakers.every(p => this.actedThisRound.has(p.id));
    }

    // There is an outstanding bet: require all decision-makers to have responded
    const allMatched = activeDecisionMakers.every(p => p.currentBet === this.gameState.currentBet);
    const allResponded = this.pendingCallers.size === 0;
    
    // If no decision-makers remain (everyone is all-in or folded), the round is complete
    if (activeDecisionMakers.length === 0) {
      return true;
    }

    return allMatched && allResponded;
  }

  private advanceStage(): void {
    // Reset current bets for new betting round
    this.gameState.players.forEach(p => p.currentBet = 0);
    this.gameState.currentBet = 0;
    // Reset per-round tracking
    this.actedThisRound.clear();
    this.pendingCallers.clear();
    this.lastAggressorId = null;
    this.lastRaiseSize = this.gameState.bigBlind;
    this.raiseLocked.clear();
    
    switch (this.gameState.stage) {
      case 'preflop':
        this.gameState.communityCards = [
          this.deck.drawCard(),
          this.deck.drawCard(),
          this.deck.drawCard()
        ];
        this.gameState.stage = 'flop';
        break;
      
      case 'flop':
        this.gameState.communityCards.push(this.deck.drawCard());
        this.gameState.stage = 'turn';
        break;
      
      case 'turn':
        this.gameState.communityCards.push(this.deck.drawCard());
        this.gameState.stage = 'river';
        break;
      
      case 'river':
        this.gameState.stage = 'showdown';
        this.resolveShowdown();
        break;
    }
    
    // First to act after the flop is the first live player left of the dealer (the big blind heads-up)
    if (this.gameState.stage !== 'showdown') {
      this.gameState.currentPlayerIndex = this.getNextPlayerIndex(this.gameState.dealerPosition);
    }
  }

  /**
   * Automatically advance stages when no players can act (all are all-in or folded).
   * Deals remaining community cards to river and resolves showdown.
   */
  private autoAdvanceWhenNoActionsNeeded(): void {
    // Continue advancing while no decision-makers remain
    while (this.gameState.stage !== 'showdown') {
      const unfoldedPlayers = this.gameState.players.filter(p => !p.isFolded);
      const activeDecisionMakers = unfoldedPlayers.filter(p => p.chips > 0 && !p.isAllIn);
      if (activeDecisionMakers.length > 0) {
        break;
      }
      // Advance to next stage
      const prevStage = this.gameState.stage;
      this.advanceStage();
      // Safety: if stage didn't change, break to avoid infinite loop
      if (this.gameState.stage === prevStage) {
        break;
      }
    }
  }

  private resolveShowdown(): void {
    const activePlayers = this.gameState.players.filter(p => !p.isFolded);
    
    if (activePlayers.length === 1) {
      // Only one player left, they win
      activePlayers[0].chips += this.gameState.pot;
      this.gameState.winners = [{
        playerId: activePlayers[0].id,
        playerName: activePlayers[0].name,
        amount: this.gameState.pot,
        handDescription: 'Won by fold'
      }];
      return;
    }
    
    // Evaluate hands and determine winner(s)
    const hands = activePlayers.map(player => ({
      player,
      hand: this.handEvaluator.evaluateHand(
        [...player.cards, ...this.gameState.communityCards]
      )
    }));

    const contributionLevels = Array.from(new Set(this.gameState.players
      .map(player => this.handContributions.get(player.id) || 0)
      .filter(amount => amount > 0)))
      .sort((a, b) => a - b);
    const pots: Array<{ amount: number; eligiblePlayers: Player[] }> = [];
    let previousLevel = 0;

    for (const level of contributionLevels) {
      const contributors = this.gameState.players.filter(
        player => (this.handContributions.get(player.id) || 0) >= level
      );
      const eligiblePlayers = contributors.filter(player => !player.isFolded);
      const amount = (level - previousLevel) * contributors.length;
      const lastPot = pots[pots.length - 1];

      if (eligiblePlayers.length > 0) {
        pots.push({ amount, eligiblePlayers });
      } else if (lastPot) {
        lastPot.amount += amount;
      } else {
        pots.push({ amount, eligiblePlayers: activePlayers });
      }
      previousLevel = level;
    }

    const handByPlayerId = new Map(hands.map(entry => [entry.player.id, entry.hand]));
    const winnings = new Map<string, number>();

    for (const pot of pots) {
      const eligibleHands = hands.filter(({ player }) => pot.eligiblePlayers.includes(player));
      const bestHand = eligibleHands.reduce((best, entry) =>
        this.handEvaluator.compareHands(entry.hand, best) > 0 ? entry.hand : best,
      eligibleHands[0].hand);
      const winners = eligibleHands.filter(({ hand }) =>
        this.handEvaluator.compareHands(hand, bestHand) === 0
      );
      const share = Math.floor(pot.amount / winners.length);
      const remainder = pot.amount % winners.length;

      winners.forEach(({ player }, index) => {
        const amount = share + (index < remainder ? 1 : 0);
        player.chips += amount;
        winnings.set(player.id, (winnings.get(player.id) || 0) + amount);
      });
    }

    this.gameState.winners = Array.from(winnings, ([playerId, amount]) => {
      const player = this.gameState.players.find(candidate => candidate.id === playerId)!;
      const hand = handByPlayerId.get(playerId);
      return {
        playerId,
        playerName: player.name,
        amount,
        handDescription: hand?.descr || 'Hand'
      };
    });
  }

  private recordContribution(playerId: string, amount: number): void {
    this.handContributions.set(
      playerId,
      (this.handContributions.get(playerId) || 0) + amount
    );
  }

  /**
   * Move to next hand
   */
  nextHand(): void {
    const previousPlayers = this.gameState.players;
    const previousDealer = previousPlayers[this.gameState.dealerPosition];
    const playersWithChips = previousPlayers.filter(player => player.chips > 0 && !player.isDisconnected);
    this.gameState.players = playersWithChips;
    
    if (this.gameState.players.length < 2) {
      throw new Error('Game cannot continue with fewer than 2 players');
    }

    const previousDealerIndex = previousPlayers.indexOf(previousDealer);
    let nextDealerId: string | undefined;
    for (let offset = 1; offset <= previousPlayers.length; offset++) {
      const candidate = previousPlayers[(previousDealerIndex + offset) % previousPlayers.length];
      if (candidate.chips > 0 && !candidate.isDisconnected) {
        nextDealerId = candidate.id;
        break;
      }
    }
    if (!nextDealerId) {
      throw new Error('No players with chips remain');
    }
    this.gameState.dealerPosition = this.gameState.players.findIndex(player => player.id === nextDealerId);
    
    // Reset all players for new hand
    this.gameState.players.forEach(player => {
      player.isFolded = false;
      player.isAllIn = false;
      player.currentBet = 0;
      player.cards = [];
    });
    
    // Start new hand
    this.startHand();
  }

  getGameState(): GameState {
    const current = this.gameState.players[this.gameState.currentPlayerIndex];
    return {
      ...this.gameState,
      ...this.getClock(),
      minRaiseTo: this.gameState.currentBet + this.lastRaiseSize,
      canRaise: !!current && !this.raiseLocked.has(current.id),
      turnEndsAt: this.turnDeadline
    };
  }

  setSittingOut(playerId: string, sittingOut: boolean): void {
    const player = this.gameState.players.find(p => p.id === playerId);
    if (player) player.isSittingOut = sittingOut;
  }

  /**
   * A player left mid-game. Their hand is folded (unless already all in) and they are
   * dropped from the table before the next hand; their chips leave with them.
   */
  forfeitPlayer(playerId: string): void {
    const player = this.gameState.players.find(p => p.id === playerId);
    if (!player) return;
    player.isDisconnected = true;

    const handInProgress = ['preflop', 'flop', 'turn', 'river'].includes(this.gameState.stage);
    if (!handInProgress || player.isFolded || player.isAllIn) return;

    const current = this.gameState.players[this.gameState.currentPlayerIndex];
    if (current?.id === playerId) {
      this.handlePlayerAction(playerId, { type: 'fold' });
      return;
    }

    player.isFolded = true;
    this.pendingCallers.delete(playerId);
    if (this.gameState.players.filter(p => !p.isFolded).length === 1) {
      this.gameState.stage = 'showdown';
      this.resolveShowdown();
    } else if (this.isBettingRoundComplete()) {
      this.advanceStage();
      this.autoAdvanceWhenNoActionsNeeded();
    }
  }

  private blindsForLevel(base: number, level: number): number {
    const last = BLIND_SCHEDULE.length;
    const multiplier = BLIND_SCHEDULE[Math.min(level, last) - 1] * 2 ** Math.max(0, level - last);
    return Math.round(base * multiplier);
  }

  getCurrentLevel(): number {
    if (this.levelStartedAt === null) return 1;
    return Math.floor((this.now() - this.levelStartedAt) / this.levelMs) + 1;
  }

  isRebuyOpen(): boolean {
    return this.getCurrentLevel() <= GAME_CONFIG.REBUY_LEVELS;
  }

  private getClock(): { levelEndsAt: number; serverTime: number; rebuyOpen: boolean } {
    const now = this.now();
    const startedAt = this.levelStartedAt ?? now;
    return {
      levelEndsAt: startedAt + this.getCurrentLevel() * this.levelMs,
      serverTime: now,
      rebuyOpen: this.isRebuyOpen()
    };
  }

  getBustedPlayers(): Player[] {
    return this.gameState.players.filter(player => player.chips === 0 && !player.isDisconnected);
  }

  rebuy(playerId: string): GameState {
    const player = this.gameState.players.find(p => p.id === playerId);
    if (!player) throw new Error('Player not found');
    if (this.gameState.stage !== 'showdown') {
      throw new Error('You can only rebuy between hands');
    }
    if (player.chips > 0) throw new Error('You still have chips');
    if (!this.isRebuyOpen()) {
      throw new Error(`Rebuys closed after level ${GAME_CONFIG.REBUY_LEVELS}`);
    }
    player.chips = this.startingChips;
    return this.getGameState();
  }

  getTournamentWinner(): Player | undefined {
    const remainingPlayers = this.gameState.players.filter(player => player.chips > 0 && !player.isDisconnected);
    return remainingPlayers.length === 1 ? remainingPlayers[0] : undefined;
  }
}