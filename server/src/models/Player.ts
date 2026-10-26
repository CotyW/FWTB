import { Card } from '../../../shared/types/game.types';

export class Player {
  id: string;
  socketId: string;
  name: string;
  chips: number;
  cards: Card[];
  position: number;
  isFolded: boolean;
  isAllIn: boolean;
  currentBet: number;
  isReady: boolean;

  constructor(
    id: string,
    socketId: string,
    name: string,
    chips: number,
    position: number = 0
  ) {
    this.id = id;
    this.socketId = socketId;
    this.name = name;
    this.chips = chips;
    this.cards = [];
    this.position = position;
    this.isFolded = false;
    this.isAllIn = false;
    this.currentBet = 0;
    this.isReady = false;
  }

  placeBet(amount: number): number {
    const actualBet = Math.min(amount, this.chips);
    this.chips -= actualBet;
    this.currentBet += actualBet;
    
    if (this.chips === 0) {
      this.isAllIn = true;
    }
    
    return actualBet;
  }

  fold(): void {
    this.isFolded = true;
    this.cards = [];
  }

  addChips(amount: number): void {
    this.chips += amount;
  }

  resetForNewHand(): void {
    this.cards = [];
    this.isFolded = false;
    this.isAllIn = false;
    this.currentBet = 0;
  }

  resetBet(): void {
    this.currentBet = 0;
  }

  setReady(ready: boolean): void {
    this.isReady = ready;
  }

  updateSocketId(socketId: string): void {
    this.socketId = socketId;
  }

  canAct(): boolean {
    return !this.isFolded && !this.isAllIn && this.chips > 0;
  }

  // For sending to clients (hide hole cards from other players)
  toJSON(hideCards: boolean = false) {
    return {
      id: this.id,
      socketId: this.socketId,
      name: this.name,
      chips: this.chips,
      cards: hideCards ? [] : this.cards,
      position: this.position,
      isFolded: this.isFolded,
      isAllIn: this.isAllIn,
      currentBet: this.currentBet,
      isReady: this.isReady
    };
  }
}
