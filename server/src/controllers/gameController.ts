import { Request, Response } from 'express';

export class GameController {
  // Get game state (optional HTTP endpoint)
  static getGameState(req: Request, res: Response): void {
    const { gameId } = req.params;
    
    // Most game state is managed via WebSockets
    // This is just a placeholder for potential REST API
    
    res.json({
      message: 'Game state is managed via WebSockets',
      gameId
    });
  }

  // Health check
  static health(req: Request, res: Response): void {
    res.json({ status: 'ok', service: 'game-controller' });
  }
}

export class PlayerController {
  // Get player info (optional HTTP endpoint)
  static getPlayer(req: Request, res: Response): void {
    const { playerId } = req.params;
    
    // Most player data is managed via WebSockets
    // This is just a placeholder for potential REST API
    
    res.json({
      message: 'Player data is managed via WebSockets',
      playerId
    });
  }

  // Health check
  static health(req: Request, res: Response): void {
    res.json({ status: 'ok', service: 'player-controller' });
  }
}