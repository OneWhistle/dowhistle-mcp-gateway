import { Request, Response } from 'express';
import { MCPProxyService } from '../services/mcpProxyService.js';
import { ExecuteToolRequest, HealthCheckResponse } from '../types/index.js';
import { logger } from '../utils/logger.js';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';

export class MCPController {
  private mcpService: MCPProxyService;

  constructor(mcpService: MCPProxyService) {
    this.mcpService = mcpService;
  }

  executeToolByName = asyncHandler(async (req: Request, res: Response) => {
    const { toolName } = req.params;
    const { args, authToken, userId }: ExecuteToolRequest = req.body;
    
    // Use auth from headers if not provided in body
    const finalAuthToken = authToken || req.headers.authorization?.replace('Bearer ', '');
    const finalUserId = userId || req.headers['x-user-id'] as string;

    logger.info('Executing MCP tool', { 
      toolName, 
      argsKeys: Object.keys(args),
      hasAuth: !!finalAuthToken,
      userId: finalUserId || 'anonymous'
    });

    // Set auth for this request
    if (finalAuthToken || finalUserId) {
      this.mcpService.setAuth(finalAuthToken, finalUserId);
    }

    const result = await this.mcpService.executeService(toolName, args);
    
    if (!result.success) {
      throw new AppError(result.error || 'Tool execution failed', 400);
    }

    res.json(result);
  });

  listTools = asyncHandler(async (req: Request, res: Response) => {
    logger.info('Listing available MCP tools');
    
    const result = await this.mcpService.listTools();
    
    if (!result.success) {
      throw new AppError(result.error || 'Failed to list tools', 500);
    }

    res.json(result);
  });

  getResources = asyncHandler(async (req: Request, res: Response) => {
    logger.info('Getting MCP resources');
    
    const result = await this.mcpService.getResources();
    
    if (!result.success) {
      throw new AppError(result.error || 'Failed to get resources', 500);
    }

    res.json(result);
  });

  connect = asyncHandler(async (req: Request, res: Response) => {
    logger.info('Establishing MCP connection');
    
    const connected = await this.mcpService.connect();
    
    if (!connected) {
      throw new AppError('Failed to connect to MCP server', 500);
    }

    res.json({ 
      success: true, 
      message: 'Connected to MCP server',
      status: this.mcpService.getConnectionStatus()
    });
  });

  disconnect = asyncHandler(async (req: Request, res: Response) => {
    logger.info('Disconnecting from MCP server');
    
    await this.mcpService.disconnect();
    
    res.json({ 
      success: true, 
      message: 'Disconnected from MCP server' 
    });
  });

  getStatus = asyncHandler(async (req: Request, res: Response) => {
    const status = this.mcpService.getConnectionStatus();
    
    res.json({
      success: true,
      data: status
    });
  });

  healthCheck = asyncHandler(async (req: Request, res: Response) => {
    const mcpStatus = this.mcpService.getConnectionStatus();
    
    const healthResponse: HealthCheckResponse = {
      status: mcpStatus.connected ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      services: {
        mcp: mcpStatus.connected ? 'connected' : 'disconnected',
        openai: 'available' // We assume OpenAI is available if the service is running
      }
    };

    const statusCode = healthResponse.status === 'healthy' ? 200 : 503;
    res.status(statusCode).json(healthResponse);
  });

  // All MCP tools now use the generic executeToolByName endpoint
  // Individual methods removed to simplify architecture
}
