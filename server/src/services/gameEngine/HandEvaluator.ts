import { Hand } from 'pokersolver';
import { Card } from '../../../../shared/types/game.types';

export interface EvaluatedHand {
  rank: number; // 1-10, where 10 is royal flush
  name: string;
  cards: Card[];
  descr: string;
}

export class HandEvaluator {
  
  /**
   * Evaluate a poker hand from 5-7 cards
   * Returns the best possible 5-card hand
   */
  evaluateHand(cards: Card[]): EvaluatedHand {
    if (cards.length < 5) {
      throw new Error('Need at least 5 cards to evaluate a hand');
    }

    // Convert our card format to pokersolver format
    const solverCards = cards.map(card => this.convertToSolverFormat(card));
    
    try {
      // Use pokersolver to find the best hand
      const hand = Hand.solve(solverCards);
      
      return {
        rank: this.getRankValue(hand.name),
        name: hand.name,
        cards: this.convertSolverCardsBack(hand.cards),
        descr: hand.descr
      };
    } catch (error) {
      throw new Error(`Failed to evaluate hand: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Compare two hands
   * Returns: positive if hand1 wins, negative if hand2 wins, 0 if tie
   */
  compareHands(hand1: EvaluatedHand, hand2: EvaluatedHand): number {
    // First compare by rank
    if (hand1.rank !== hand2.rank) {
      return hand1.rank - hand2.rank;
    }

    // If same rank, use pokersolver's comparison
    try {
      const solver1 = Hand.solve(hand1.cards.map(c => this.convertToSolverFormat(c)));
      const solver2 = Hand.solve(hand2.cards.map(c => this.convertToSolverFormat(c)));
      
      const winners = Hand.winners([solver1, solver2]);
      
      if (winners.length === 2) return 0; // Tie
      if (winners[0] === solver1) return 1; // Hand1 wins
      return -1; // Hand2 wins
    } catch (error) {
      // Fallback to rank comparison
      return 0;
    }
  }

  /**
   * Convert our card format to pokersolver format
   * Example: {suit: 'hearts', rank: 'A'} -> 'Ah'
   */
  private convertToSolverFormat(card: Card): string {
    const suitMap: Record<Card['suit'], string> = {
      'hearts': 'h',
      'diamonds': 'd',
      'clubs': 'c',
      'spades': 's'
    };
    
    return `${card.rank === '10' ? 'T' : card.rank}${suitMap[card.suit]}`;
  }

  /**
   * Convert pokersolver cards back to our format
   */
  private convertSolverCardsBack(solverCards: any[]): Card[] {
    const suitMap: Record<string, Card['suit']> = {
      'h': 'hearts',
      'd': 'diamonds',
      'c': 'clubs',
      's': 'spades'
    };

    return solverCards.map(card => {
      const rank = (card.value === 'T' ? '10' : card.value) as Card['rank'];
      return {
        suit: suitMap[card.suit],
        rank,
        value: this.getCardValue(rank)
      };
    });
  }

  /**
   * Get numeric value for card rank
   */
  private getCardValue(rank: string): number {
    const valueMap: Record<string, number> = {
      '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, 
      '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14
    };
    return valueMap[rank] || 0;
  }

  /**
   * Convert hand name to numeric rank (higher is better)
   */
  private getRankValue(handName: string): number {
    const rankings: Record<string, number> = {
      'Royal Flush': 10,
      'Straight Flush': 9,
      'Four of a Kind': 8,
      'Full House': 7,
      'Flush': 6,
      'Straight': 5,
      'Three of a Kind': 4,
      'Two Pair': 3,
      'Pair': 2,
      'High Card': 1
    };

    return rankings[handName] || 0;
  }

  /**
   * Get hand description for display
   */
  getHandDescription(hand: EvaluatedHand): string {
    return hand.descr;
  }

  /**
   * Determine winners from multiple hands
   */
  findWinners(hands: Array<{ playerId: string, hand: EvaluatedHand }>): string[] {
    if (hands.length === 0) return [];
    if (hands.length === 1) return [hands[0].playerId];

    // Sort hands by strength (strongest first)
    const sorted = [...hands].sort((a, b) => this.compareHands(b.hand, a.hand));
    
    // Find all hands that tie with the best hand
    const bestHand = sorted[0].hand;
    const winners = sorted.filter(h => 
      this.compareHands(h.hand, bestHand) === 0
    );

    return winners.map(w => w.playerId);
  }
}
