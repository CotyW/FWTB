import { GameState } from '../../../shared/types/game.types';

export class Game {
  constructor(public state: GameState) {}

  toJSON(): GameState {
    return this.state;
  }
}