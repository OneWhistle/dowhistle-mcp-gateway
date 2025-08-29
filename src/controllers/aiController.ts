import { Request, Response } from 'express';
import { OpenAIService } from '../services/openaiService.js';
import { MCPProxyService } from '../services/mcpProxyService.js';
import { ProcessMessageRequest, ProcessMessageResponse } from '../types/index.js';
import { logger } from '../utils/logger.js';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';

export class AIController {
  private openaiService: OpenAIService;
  private mcpService: MCPProxyService;

  constructor(openaiService: OpenAIService, mcpService: MCPProxyService) {
    this.openaiService = openaiService;
    this.mcpService = mcpService;
  }

  processMessage = asyncHandler(async (req: Request, res: Response) => {
    const { message, context }: ProcessMessageRequest = req.body;
    const authToken = req.headers.authorization?.replace('Bearer ', '');
    const userId = req.headers['x-user-id'] as string;

    logger.info('Processing AI message', { 
      messageLength: message.length,
      hasContext: !!context,
      hasAuth: !!authToken,
      userId: userId || 'anonymous'
    });

    // Set auth for MCP service if provided
    if (authToken || userId) {
      this.mcpService.setAuth(authToken, userId);
    }

    // Get AI response
    const aiResponse = await this.openaiService.processMessage(message, context || {});
    
    let toolExecuted = false;
    let toolResult = undefined;

    // Check if AI wants to execute an MCP tool
    const toolAction = aiResponse.actions?.find(a => a.type === 'mcp_tool');
    if (toolAction) {
      const { tool, args } = toolAction.data || {};
      
      if (tool && args) {
        logger.info('Executing MCP tool from AI response', { tool });
        
        // Merge location data if available in context
        const mergedArgs = { ...args };
        if (context?.userLocation && typeof mergedArgs.latitude !== 'number') {
          const [lat, lng] = context.userLocation.split(',').map(Number);
          if (!isNaN(lat) && !isNaN(lng)) {
            mergedArgs.latitude = lat;
            mergedArgs.longitude = lng;
          }
        }

        toolResult = await this.mcpService.executeService(tool, mergedArgs);
        toolExecuted = true;

        // If tool execution was successful, format the response
        if (toolResult.success) {
          const data = toolResult.data as any;
          const providers = data?.providers || 
                          data?.data?.providers || 
                          data?.structuredContent?.providers || 
                          data?.result?.structuredContent?.providers || 
                          [];
          const total = data?.total_count ?? providers.length;

          if (providers.length === 0) {
            aiResponse.text = 'No nearby providers found for your search. Try increasing radius or changing the keyword.';
          } else {
            const listText = providers
              .map((p: any, idx: number) => {
                const name = p?.name || p?.businessName || 'Provider';
                const phone = p?.phone || 'N/A';
                const ratingVal = typeof p?.rating === 'number' ? p.rating.toFixed(1) : (p?.rating ?? 'N/A');
                return `${idx + 1}. ${name}\n   Phone: ${phone}\n   Rating: ${ratingVal}`;
              })
              .join('\n');

            aiResponse.text = `Found ${total} result(s) near your location:\n\n${listText}`;
          }
        } else {
          aiResponse.text = `Tool call failed: ${toolResult.error || 'Unknown error'}`;
        }
      }
    }

    const response: ProcessMessageResponse = {
      response: aiResponse,
      toolExecuted,
      toolResult
    };

    res.json(response);
  });
}
