import { Player } from '../../../../shared/types/game.types';

export interface SidePot {
  amount: number;
  eligiblePlayers: string[]; // Player IDs
}

export class PotManager {
  private mainPot: number;
  private sidePots: SidePot[];

  constructor() {
    this.mainPot = 0;
    this.sidePots = [];
  }

  reset(): void {
    this.mainPot = 0;
    this.sidePots = [];
  }

  /**
   * Calculate pots from all player bets
   * Handles main pot and side pots for all-in scenarios
   */
  calculatePots(players: Player[]): { mainPot: number; sidePots: SidePot[] } {
    this.reset();
    
    // Get all players who have bet
    const activeBets = players
      .filter(p => p.currentBet > 0 && !p.isFolded)
      .map(p => ({ id: p.id, amount: p.currentBet, isAllIn: p.isAllIn }))
      .sort((a, b) => a.amount - b.amount);

    if (activeBets.length === 0) {
      return { mainPot: this.mainPot, sidePots: this.sidePots };
    }

    let remainingPlayers = players.filter(p => !p.isFolded).map(p => p.id);
    let processedBets = activeBets.map(b => ({ ...b, remaining: b.amount }));

    // Process each bet level for side pots
    while (processedBets.some(b => b.remaining > 0)) {
      // Find the smallest remaining bet
      const smallestBet = Math.min(...processedBets.filter(b => b.remaining > 0).map(b => b.remaining));
      
      // Calculate pot amount at this level
      let potAmount = 0;
      const eligiblePlayers: string[] = [];

      processedBets.forEach(bet => {
        if (bet.remaining > 0) {
          const contribution = Math.min(bet.remaining, smallestBet);
          potAmount += contribution;
          bet.remaining -= contribution;
          
          // Player is eligible if they contributed and haven't folded
          if (remainingPlayers.includes(bet.id)) {
            if (!eligiblePlayers.includes(bet.id)) {
              eligiblePlayers.push(bet.id);
            }
          }
        }
      });

      // Add to main pot or create side pot
      if (this.sidePots.length === 0 && eligiblePlayers.length === remainingPlayers.length) {
        this.mainPot += potAmount;
      } else {
        this.sidePots.push({ amount: potAmount, eligiblePlayers });
      }

      // Remove players who are all-in at this level from future pots
      processedBets.forEach(bet => {
        if (bet.remaining === 0 && bet.isAllIn) {
          remainingPlayers = remainingPlayers.filter(id => id !== bet.id);
        }
      });
    }

    return { mainPot: this.mainPot, sidePots: this.sidePots };
  }

  /**
   * Add chips to the main pot
   */
  addToMainPot(amount: number): void {
    this.mainPot += amount;
  }

  /**
   * Get total pot amount (main pot + all side pots)
   */
  getTotalPot(): number {
    return this.mainPot + this.sidePots.reduce((sum, pot) => sum + pot.amount, 0);
  }

  /**
   * Get main pot amount
   */
  getMainPot(): number {
    return this.mainPot;
  }

  /**
   * Get all side pots
   */
  getSidePots(): SidePot[] {
    return this.sidePots;
  }

  /**
   * Distribute pot to winner(s)
   * Returns map of player ID to amount won
   */
  distributePot(winnerIds: string[], playerIds: string[]): Map<string, number> {
    const distribution = new Map<string, number>();

    // Distribute main pot
    if (this.mainPot > 0) {
      const eligibleWinners = winnerIds.filter(id => playerIds.includes(id));
      if (eligibleWinners.length > 0) {
        const shareAmount = Math.floor(this.mainPot / eligibleWinners.length);
        eligibleWinners.forEach(winnerId => {
          distribution.set(winnerId, (distribution.get(winnerId) || 0) + shareAmount);
        });
      }
    }

    // Distribute side pots
    this.sidePots.forEach(sidePot => {
      const eligibleWinners = winnerIds.filter(id => sidePot.eligiblePlayers.includes(id));
      if (eligibleWinners.length > 0) {
        const shareAmount = Math.floor(sidePot.amount / eligibleWinners.length);
        eligibleWinners.forEach(winnerId => {
          distribution.set(winnerId, (distribution.get(winnerId) || 0) + shareAmount);
        });
      }
    });

    return distribution;
  }
}
