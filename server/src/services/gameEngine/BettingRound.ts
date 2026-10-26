import { Player, BettingAction } from '../../../../shared/types/game.types';

export class BettingRound {
  private currentBet: number = 0;
  private lastRaiserIndex: number = -1;
  private actionIndex: number = 0;
  private actionCount: number = 0;
  private playerActedOnce: Set<number> = new Set();

  constructor(
    private players: Player[],
    private startingPlayerIndex: number
  ) {
    this.actionIndex = startingPlayerIndex;
  }

  /**
   * Process a player action and update game state
   */
  processAction(player: Player, action: BettingAction): void {
    const playerIndex = this.players.indexOf(player);
    if (playerIndex === -1) {
      throw new Error('Player not found in betting round');
    }

    this.playerActedOnce.add(playerIndex);
    this.actionCount++;

    switch (action.type) {
      case 'fold':
        player.isFolded = true;
        break;

      case 'check':
        if (player.currentBet !== this.currentBet) {
          throw new Error('Cannot check when there is a bet to call');
        }
        break;

      case 'call':
        const callAmount = Math.min(
          this.currentBet - player.currentBet,
          player.chips
        );
        player.chips -= callAmount;
        player.currentBet += callAmount;
        if (player.chips === 0) {
          player.isAllIn = true;
        }
        break;

      case 'raise':
        if (!action.amount) {
          throw new Error('Raise amount is required');
        }
        const raiseTotal = action.amount;
        if (raiseTotal <= this.currentBet) {
          throw new Error('Raise must be greater than current bet');
        }
        const raiseAdd = Math.min(raiseTotal - player.currentBet, player.chips);
        player.chips -= raiseAdd;
        player.currentBet += raiseAdd;
        this.currentBet = raiseTotal;
        this.lastRaiserIndex = playerIndex;
        if (player.chips === 0) {
          player.isAllIn = true;
        }
        break;

      case 'all-in':
        const allInAmount = player.chips;
        player.chips = 0;
        player.currentBet += allInAmount;
        player.isAllIn = true;
        if (player.currentBet > this.currentBet) {
          this.currentBet = player.currentBet;
          this.lastRaiserIndex = playerIndex;
        }
        break;
    }
  }

  /**
   * Validate that a player can perform an action
   */
  canPlayerAct(player: Player, action: BettingAction): boolean {
    if (player.chips === 0) return false;
    if (player.isFolded) return false;
    if (player.isAllIn && action.type !== 'fold') return false;

    switch (action.type) {
      case 'check':
        return player.currentBet === this.currentBet;
      case 'call':
        return player.currentBet < this.currentBet;
      case 'raise':
        return action.amount !== undefined && action.amount > this.currentBet;
      case 'all-in':
        return player.chips > 0;
      case 'fold':
        return true;
      default:
        return false;
    }
  }

  /**
   * Check if the betting round is complete
   */
  isComplete(): boolean {
    const activePlayers = this.players.filter(
      p => !p.isFolded && (p.chips > 0 || p.isAllIn)
    );

    // If only one or fewer active players, round is complete
    if (activePlayers.length <= 1) {
      return true;
    }

    // All active players (not all-in) must have acted and matched current bet
    const activeNotAllIn = activePlayers.filter(p => !p.isAllIn);
    
    if (activeNotAllIn.length === 0) {
      // All remaining players are all-in
      return true;
    }

    const allMatched = activeNotAllIn.every(p => p.currentBet === this.currentBet);
    
    // Everyone must have acted at least once
    let playerHasActed = 0;
    for (let i = 0; i < this.players.length; i++) {
      const p = this.players[i];
      if (!p.isFolded && (p.chips > 0 || p.isAllIn)) {
        if (this.playerActedOnce.has(i)) {
          playerHasActed++;
        }
      }
    }

    return allMatched && (playerHasActed > 0);
  }

  /**
   * Get the next player to act
   */
  getNextPlayerIndex(): number {
    let idx = (this.actionIndex + 1) % this.players.length;
    const startIdx = idx;
    
    // Skip folded, all-in with chips > 0, or out-of-chips players
    while (
      this.players[idx].isFolded ||
      (this.players[idx].isAllIn && this.players[idx].chips === 0) ||
      (this.players[idx].chips === 0 && !this.players[idx].isAllIn)
    ) {
      idx = (idx + 1) % this.players.length;
      
      // Prevent infinite loop
      if (idx === startIdx) {
        return -1;
      }
    }

    this.actionIndex = idx;
    return idx;
  }

  /**
   * Get current player index
   */
  getCurrentPlayerIndex(): number {
    return this.actionIndex;
  }

  /**
   * Get current bet amount
   */
  getCurrentBet(): number {
    return this.currentBet;
  }

  /**
   * Get total pot from all players
   */
  getTotalPot(): number {
    return this.players.reduce((sum, p) => sum + p.currentBet, 0);
  }

  /**
   * Reset for new betting round
   */
  reset(startingPlayerIndex: number): void {
    this.currentBet = 0;
    this.lastRaiserIndex = -1;
    this.actionIndex = startingPlayerIndex;
    this.actionCount = 0;
    this.playerActedOnce.clear();
    
    // Reset player bets
    this.players.forEach(p => {
      if (!p.isFolded) {
        p.currentBet = 0;
      }
    });
  }

  /**
   * Get statistics about the betting round
   */
  getStats() {
    return {
      currentBet: this.currentBet,
      totalPot: this.getTotalPot(),
      actionCount: this.actionCount,
      playersActed: this.playerActedOnce.size,
      isComplete: this.isComplete()
    };
  }
}
