import { Router, Request, Response } from 'express';

const router = Router();

// Optional: Add HTTP endpoints for room operations
// Most room logic is handled via WebSockets

router.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'rooms' });
});

export default router;
