import { Router } from 'express';
import { MCPController } from '../controllers/mcpController.js';
import { 
  validateExecuteTool, 
  validateSearchBusinesses, 
  handleValidationErrors 
} from '../middleware/validation.js';
import rateLimit from 'express-rate-limit';

const mcpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    error: 'Too Many Requests',
    message: 'Too many MCP requests from this IP, please try again later.',
    timestamp: new Date().toISOString()
  }
});

export const createMCPRoutes = (mcpController: MCPController): Router => {
  const router = Router();

  // General MCP endpoints
  router.post('/connect', mcpLimiter, mcpController.connect);
  router.post('/disconnect', mcpLimiter, mcpController.disconnect);
  router.get('/status', mcpController.getStatus);
  router.get('/health', mcpController.healthCheck);
  router.get('/tools', mcpController.listTools);
  router.get('/resources', mcpController.getResources);

  // Generic tool execution
  router.post(
    '/tools/:toolName',
    mcpLimiter,
    validateExecuteTool,
    handleValidationErrors,
    mcpController.executeToolByName
  );

  // All MCP tools use the generic endpoint pattern
  // Individual endpoints removed - use /tools/:toolName instead

  return router;
};
