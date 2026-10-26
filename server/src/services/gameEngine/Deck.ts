export interface Card {
  suit: 'hearts' | 'diamonds' | 'clubs' | 'spades';
  rank: '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A';
  value: number; // For sorting: 2-14 (A=14)
}

export class Deck {
  private cards: Card[];
  private dealtCards: Card[];

  constructor() {
    this.cards = [];
    this.dealtCards = [];
    this.initializeDeck();
  }

  private initializeDeck(): void {
    const suits: Card['suit'][] = ['hearts', 'diamonds', 'clubs', 'spades'];
    const ranks: Array<{ rank: Card['rank'], value: number }> = [
      { rank: '2', value: 2 },
      { rank: '3', value: 3 },
      { rank: '4', value: 4 },
      { rank: '5', value: 5 },
      { rank: '6', value: 6 },
      { rank: '7', value: 7 },
      { rank: '8', value: 8 },
      { rank: '9', value: 9 },
      { rank: '10', value: 10 },
      { rank: 'J', value: 11 },
      { rank: 'Q', value: 12 },
      { rank: 'K', value: 13 },
      { rank: 'A', value: 14 }
    ];

    for (const suit of suits) {
      for (const { rank, value } of ranks) {
        this.cards.push({ suit, rank, value });
      }
    }
  }

  shuffle(): void {
    // Reset deck
    this.cards = [];
    this.dealtCards = [];
    this.initializeDeck();

    // Fisher-Yates shuffle algorithm
    for (let i = this.cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
    }
  }

  drawCard(): Card {
    if (this.cards.length === 0) {
      throw new Error('No cards left in deck');
    }
    
    const card = this.cards.pop()!;
    this.dealtCards.push(card);
    return card;
  }

  drawCards(count: number): Card[] {
    const cards: Card[] = [];
    for (let i = 0; i < count; i++) {
      cards.push(this.drawCard());
    }
    return cards;
  }

  getRemainingCount(): number {
    return this.cards.length;
  }

  reset(): void {
    this.cards = [];
    this.dealtCards = [];
    this.initializeDeck();
  }
}