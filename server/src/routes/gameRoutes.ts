import { Router, Request, Response } from 'express';

const router = Router();

// Optional: Add HTTP endpoints for game operations
// Most game logic is handled via WebSockets

router.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

export default router;