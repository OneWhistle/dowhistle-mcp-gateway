import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { MCPConnectionConfig, MCPResponse, MCPToolDef } from '../types/index.js';
import { logger } from '../utils/logger.js';

export class MCPProxyService {
  private client: Client | null = null;
  private transport: StreamableHTTPClientTransport | null = null;
  private config: MCPConnectionConfig;
  private isConnected = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private authHeaders: Record<string, string> = {};
  private toolCache: MCPToolDef[] = [];
  private lastToolSync = 0;

  // ✅ configurable via env (default 5min)
  private toolSyncIntervalMs: number;

  constructor(config: MCPConnectionConfig) {
    this.config = {
      timeout: 10000,
      retryAttempts: 3,
      ...config
    };

    this.toolSyncIntervalMs = parseInt(
      process.env.MCP_TOOL_SYNC_INTERVAL || '300000', // default 5min
      10
    );
  }

  private async ensureConnected(): Promise<boolean> {
    if (this.isConnected && this.client) return true;
    return this.connect();
  }

  async connect(): Promise<boolean> {
    try {
      logger.info('Connecting to MCP server', { serverUrl: this.config.serverUrl });

      this.transport = new StreamableHTTPClientTransport(
        new URL(this.config.serverUrl),
        {
          reconnectionOptions: {
            initialReconnectionDelay: 1000,
            maxReconnectionDelay: 10000,
            reconnectionDelayGrowFactor: 2,
            maxRetries: 5,
          },
          requestInit: {
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
              ...this.authHeaders,
            }
          }
        }
      );

      this.client = new Client(
        { name: 'dowhistle-mcp-backend', version: '1.0.0' },
        { capabilities: { resources: {}, tools: {}, prompts: {} } }
      );

      await this.client.connect(this.transport);
      this.isConnected = true;
      this.reconnectAttempts = 0;

      await this.refreshTools(true); // ✅ initial load
      logger.info('Successfully connected to MCP server');

      return true;
    } catch (error) {
      logger.error('Failed to connect to MCP server', {
        error: error instanceof Error ? error.message : error
      });
      this.isConnected = false;

      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++;
        logger.info(
          `Reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}`
        );
        setTimeout(() => this.connect(), 2000 * this.reconnectAttempts);
      }

      return false;
    }
  }

  setAuth(accessToken?: string, userId?: string) {
    const headers: Record<string, string> = {};
    if (accessToken) {
      // If token doesn't start with Bearer, add it
      const authValue = accessToken.toLowerCase().startsWith('bearer ')
        ? accessToken
        : `Bearer ${accessToken}`;
      headers['Authorization'] = authValue;
    }
    if (userId) headers['X-User-Id'] = userId;
    this.authHeaders = headers;
    logger.debug('Auth headers updated', {
      hasToken: !!accessToken,
      hasUserId: !!userId
    });
  }

  async disconnect(): Promise<void> {
    try {
      if (this.client) {
        await this.client.close();
        this.client = null;
      }
      if (this.transport) {
        await this.transport.close();
        this.transport = null;
      }
      this.isConnected = false;
      logger.info('Disconnected from MCP server');
    } catch (error) {
      logger.error('Error during disconnection', {
        error: error instanceof Error ? error.message : error
      });
    }
  }

  // ✅ Periodic refresh of tool schemas
  private async refreshTools(force = false): Promise<void> {
    const now = Date.now();
    if (!force && now - this.lastToolSync < this.toolSyncIntervalMs) return;
    if (!this.client) return;

    try {
      const tools = await this.client.listTools();
      this.toolCache = tools?.tools || [];
      this.lastToolSync = now;
      logger.info('Tool schemas refreshed', {
        count: this.toolCache.length,
        intervalMs: this.toolSyncIntervalMs
      });
    } catch (error) {
      logger.warn('Failed to refresh tool schemas', {
        error: error instanceof Error ? error.message : error
      });
    }
  }

  // ✅ Executes service with param filtering + dropped logging
  async executeService(serviceName: string, params: any): Promise<MCPResponse> {
    if (!(await this.ensureConnected()) || !this.client) {
      return { success: false, error: 'Not connected to MCP server' };
    }

    try {
      await this.refreshTools();
      const tool = this.toolCache.find((t) => t.name === serviceName);

      let safeParams = params;
      let droppedKeys: string[] = [];
      if (tool?.inputSchema?.properties) {
        const allowed = Object.keys(tool.inputSchema.properties);
        // Only include access_token if it's actually defined in the tool's schema
        const accessTokenAllowed = allowed.includes('access_token');
        safeParams = Object.fromEntries(
          Object.entries(params).filter(([k]) => allowed.includes(k) || (k === 'access_token' && accessTokenAllowed))
        );
        droppedKeys = Object.keys(params).filter((k) => !allowed.includes(k) && !(k === 'access_token' && accessTokenAllowed));
      }

      logger.info('Executing MCP service', {
        serviceName,
        sentParams: Object.keys(safeParams),
        droppedParams: droppedKeys
      });

      const result = await this.client.callTool({
        name: serviceName,
        arguments: safeParams
      });

      logger.info('MCP service executed successfully', { serviceName });
      return { success: true, data: result };
    } catch (error) {
      logger.error(`Error executing service ${serviceName}`, {
        error: error instanceof Error ? error.message : error,
        serviceName,
        params
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async listTools(): Promise<MCPResponse> {
    if (!(await this.ensureConnected()) || !this.client) {
      return { success: false, error: 'Not connected to MCP server' };
    }
    try {
      const tools = await this.client.listTools();
      this.toolCache = tools?.tools || [];
      this.lastToolSync = Date.now();
      logger.info('Listed MCP tools', { toolCount: this.toolCache.length });
      return { success: true, data: tools };
    } catch (error) {
      logger.error('Error listing tools', {
        error: error instanceof Error ? error.message : error
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async getResources(): Promise<MCPResponse> {
    if (!(await this.ensureConnected()) || !this.client) {
      return { success: false, error: 'Not connected to MCP server' };
    }
    try {
      const resources = await this.client.listResources();
      return { success: true, data: resources };
    } catch (error) {
      logger.error('Error getting resources', {
        error: error instanceof Error ? error.message : error
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  getConnectionStatus(): { connected: boolean; attempts: number } {
    return { connected: this.isConnected, attempts: this.reconnectAttempts };
  }

  // ✅ DoWhistle-specific wrappers
  async searchBusinesses(params: any): Promise<MCPResponse> {
    return this.executeService('search_businesses', params);
  }
  async signIn(params: any): Promise<MCPResponse> {
    return this.executeService('sign_in', params);
  }
  async verifyOtp(params: any): Promise<MCPResponse> {
    return this.executeService('verify_otp', params);
  }
  async resendOtp(params: any): Promise<MCPResponse> {
    return this.executeService('resend_otp', params);
  }
  async createWhistle(params: any): Promise<MCPResponse> {
    return this.executeService('create_whistle', params);
  }
  async listWhistles(params: any): Promise<MCPResponse> {
    return this.executeService('list_whistles', params);
  }
  async toggleVisibility(params: any): Promise<MCPResponse> {
    return this.executeService('toggle_visibility', params);
  }
  async getUserProfile(params: any): Promise<MCPResponse> {
    return this.executeService('get_user_profile', params);
  }
}
