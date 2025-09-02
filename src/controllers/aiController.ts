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
          let structuredResult = data?.structuredContent?.result; // Primary source
          const executedTool = aiResponse.actions?.find(a => a.type === 'mcp_tool')?.data?.tool; // Get the actual tool name

          // Fallback: If structuredResult is not directly available, try parsing from content[0].text
          if (!structuredResult && data?.content && Array.isArray(data.content) && data.content.length > 0 && typeof data.content[0].text === 'string') {
            try {
              structuredResult = JSON.parse(data.content[0].text);
              logger.debug('Parsed structuredResult from data.content[0].text', { structuredResult, tool: executedTool });
            } catch (parseError) {
              logger.warn('Failed to parse structuredResult from data.content[0].text', { parseError, text: data.content[0].text });
            }
          }

          logger.debug('Tool execution successful, processing structuredResult', { structuredResult, executedTool });

          if (structuredResult) {
            logger.debug('structuredResult is NOT null, proceeding to switch', { structuredResult, executedTool });
            switch (executedTool) {
              case 'sign_in':
              case 'verify_otp':
              case 'create_whistle':
                if (structuredResult.message) {
                  aiResponse.text = structuredResult.message;
                  logger.debug('Set responseText from authentication tool message', { text: aiResponse.text });
                }
                break;
              case 'list_whistles':
                logger.debug('Inside list_whistles case', { structuredResultWhistles: structuredResult.whistles, isArray: Array.isArray(structuredResult.whistles) });
                if (structuredResult.whistles && Array.isArray(structuredResult.whistles)) {
                  logger.debug('Handling list_whistles response', { count: structuredResult.whistles.length });
                  if (structuredResult.whistles.length > 0) {
                    const whistleListText = structuredResult.whistles
                      .map((w: any, idx: number) => {
                        const description = w?.description || 'Whistle';
                        const tags = w?.tags?.join(', ') || 'No tags';
                        return `${idx + 1}. ${description} (Tags: ${tags})`;
                      })
                      .join('\n');
                    aiResponse.text = `Found ${structuredResult.whistles.length} whistles:\n\n${whistleListText}`;
                  } else {
                    aiResponse.text = 'No whistles found.';
                  }
                  logger.debug('Set responseText from whistles', { text: aiResponse.text });
                }
                break;
              case 'search_businesses':
                if (structuredResult.providers && Array.isArray(structuredResult.providers)) {
                  logger.debug('Handling search_businesses response', { count: structuredResult.providers.length });
                  if (structuredResult.providers.length > 0) {
                    const listText = structuredResult.providers
                      .map((p: any, idx: number) => {
                        const name = p?.name || p?.businessName || 'Provider';
                        const phone = p?.phone || 'N/A';
                        const ratingVal = typeof p?.rating === 'number' ? p.rating.toFixed(1) : (p?.rating ?? 'N/A');
                        return `${idx + 1}. ${name}\n   Phone: ${phone}\n   Rating: ${ratingVal}`;
                      })
                      .join('\n');
                    aiResponse.text = `Found ${structuredResult.providers.length} result(s) near your location:\n\n${listText}`;
                  } else {
                    aiResponse.text = 'No nearby providers found for your search. Try increasing radius or changing the keyword.';
                  }
                  logger.debug('Set responseText from providers', { text: aiResponse.text });
                }
                break;
              case 'get_user_profile':
                if (structuredResult.data) {
                  logger.debug('Handling get_user_profile response', { userData: structuredResult.data, originalMessage: message });
                  const userProfile = structuredResult.data;
                  let responseText = '';

                  // Check if the original message asked for a specific detail
                  const lowerCaseMessage = message.toLowerCase();
                  if (lowerCaseMessage.includes('name')) {
                    responseText = `Your name is ${userProfile.name || 'N/A'}.`;
                  } else if (lowerCaseMessage.includes('phone') || lowerCaseMessage.includes('number')) {
                    responseText = `Your phone number is ${userProfile.countryCode || ''}${userProfile.phone || 'N/A'}.`;
                  } else if (lowerCaseMessage.includes('status') || lowerCaseMessage.includes('verified')) {
                    responseText = `Your account is ${userProfile.verified ? 'verified' : 'not verified'} and ${userProfile.active ? 'active' : 'inactive'}.`;
                  } else {
                    // Default to full profile summary
                    responseText = `User Profile:\nName: ${userProfile.name || 'N/A'}\nPhone: ${userProfile.countryCode || ''}${userProfile.phone || 'N/A'}\nVerified: ${userProfile.verified ? 'Yes' : 'No'}\nActive: ${userProfile.active ? 'Yes' : 'No'}`;
                  }
                  aiResponse.text = responseText;
                  logger.debug('Set responseText from user profile dynamically', { text: aiResponse.text });
                } else {
                  aiResponse.text = 'User profile data not found.';
                  logger.debug('Set responseText to user profile data not found', { text: aiResponse.text });
                }
                break;
              case 'toggle_visibility':
                if (structuredResult.message) {
                  aiResponse.text = structuredResult.message;
                  logger.debug('Set responseText from toggle_visibility tool message', { text: aiResponse.text });
                } else if (structuredResult.data?.visible !== undefined) {
                  const visibilityStatus = structuredResult.data.visible ? 'enabled' : 'disabled';
                  aiResponse.text = `User visibility ${visibilityStatus}.`;
                  logger.debug('Set responseText from toggle_visibility status', { text: aiResponse.text });
                } else {
                  aiResponse.text = 'User visibility updated, but status is unclear.';
                  logger.debug('Set responseText to unclear visibility status', { text: aiResponse.text });
                }
                break;
              default:
                // Fallback for structured results without specific handlers
                if (structuredResult.message) {
                  aiResponse.text = structuredResult.message;
                  logger.debug('Set responseText from structuredResult.message (default case)', { text: aiResponse.text });
                } else {
                  aiResponse.text = JSON.stringify(structuredResult, null, 2); // Display raw structured content
                  logger.debug('Set responseText from JSON.stringify(structuredResult) (default case)', { text: aiResponse.text });
                }
                break;
              
            }
          } else if (data && data.message) {
            // Fallback for direct message property in top-level data
            aiResponse.text = data.message;
            logger.debug('Set responseText from data.message', { text: aiResponse.text });
          } else {
            aiResponse.text = 'Tool executed successfully, but no specific message or structured content found.';
            logger.debug('Set generic success message', { text: aiResponse.text });
          }
        } else {
          aiResponse.text = `Tool call failed: ${toolResult.error || 'Unknown error'}`;
          logger.debug('Set tool failure message', { text: aiResponse.text });
        }
      }
    }

    const response: ProcessMessageResponse = {
      response: aiResponse,
      toolExecuted,
      toolResult
    };

    logger.info('Sending AI response to client', { response: response });
    res.json(response);
  });
}
