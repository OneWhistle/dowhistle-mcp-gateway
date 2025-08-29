import { MCPProxyService } from './mcpProxyService.js';
import { OpenAIService } from './openaiService.js';
import { MCPToolDef } from '../types/index.js';
import { logger } from '../utils/logger.js';

export class ToolRegistryService {
  private mcpService: MCPProxyService;
  private openaiService: OpenAIService;
  private cachedTools: MCPToolDef[] = [];
  private syncInterval: NodeJS.Timeout | null = null;
  private readonly SYNC_INTERVAL_MS = 30000; // 30 seconds

  constructor(mcpService: MCPProxyService, openaiService: OpenAIService) {
    this.mcpService = mcpService;
    this.openaiService = openaiService;
  }

  async startSync(): Promise<void> {
    logger.info('Starting tool registry synchronization');
    
    // Initial sync
    await this.syncTools();
    
    // Set up periodic sync
    this.syncInterval = setInterval(async () => {
      await this.syncTools();
    }, this.SYNC_INTERVAL_MS);
  }

  async stopSync(): Promise<void> {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
      logger.info('Stopped tool registry synchronization');
    }
  }

  private async syncTools(): Promise<void> {
    try {
      logger.debug('Syncing tools from MCP server');
      
      const toolsResponse = await this.mcpService.listTools();
      
      if (toolsResponse.success && toolsResponse.data?.tools) {
        const tools = toolsResponse.data.tools as MCPToolDef[];
        
        // Check if tools have changed
        const toolsChanged = this.hasToolsChanged(tools);
        
        if (toolsChanged) {
          this.cachedTools = tools;
          this.openaiService.setAvailableTools(tools);
          
          logger.info('Tool registry updated', { 
            toolCount: tools.length,
            toolNames: tools.map(t => t.name)
          });
        } else {
          logger.debug('No changes in tool registry');
        }
      } else {
        logger.warn('Failed to sync tools from MCP server', { 
          error: toolsResponse.error 
        });
      }
    } catch (error) {
      logger.error('Error during tool synchronization', { 
        error: error instanceof Error ? error.message : error 
      });
    }
  }

  private hasToolsChanged(newTools: MCPToolDef[]): boolean {
    if (this.cachedTools.length !== newTools.length) {
      return true;
    }

    // Simple comparison based on tool names and schemas
    const currentToolsMap = new Map(
      this.cachedTools.map(tool => [tool.name, JSON.stringify(tool.inputSchema)])
    );

    for (const tool of newTools) {
      const currentSchema = currentToolsMap.get(tool.name);
      const newSchema = JSON.stringify(tool.inputSchema);
      
      if (!currentSchema || currentSchema !== newSchema) {
        return true;
      }
    }

    return false;
  }

  getCachedTools(): MCPToolDef[] {
    return [...this.cachedTools];
  }

  async forceSync(): Promise<MCPToolDef[]> {
    await this.syncTools();
    return this.getCachedTools();
  }
}
