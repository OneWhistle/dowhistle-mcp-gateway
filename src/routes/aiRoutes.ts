import { Router } from 'express';
import { AIController } from '../controllers/aiController.js';
import { validateProcessMessage, handleValidationErrors } from '../middleware/validation.js';
import rateLimit from 'express-rate-limit';

const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // limit each IP to 50 requests per windowMs
  message: {
    error: 'Too Many Requests',
    message: 'Too many AI requests from this IP, please try again later.',
    timestamp: new Date().toISOString()
  }
});

export const createAIRoutes = (aiController: AIController): Router => {
  const router = Router();

  // POST /api/ai/process-message - Process user messages with AI
  router.post(
    '/process-message',
    aiLimiter,
    validateProcessMessage,
    handleValidationErrors,
    aiController.processMessage
  );

  return router;
};
