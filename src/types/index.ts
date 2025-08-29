export interface MCPConnectionConfig {
  serverUrl: string;
  timeout?: number;
  retryAttempts?: number;
}

export interface MCPResponse {
  success: boolean;
  data?: any;
  error?: string;
  metadata?: Record<string, any>;
}

export interface AIServiceConfig {
  apiKey: string;
  model?: string;
  temperature?: number;
}

export interface ChatContext {
  userLocation?: string;
  serviceHistory?: any[];
  currentBooking?: any;
  preferences?: Record<string, any>;
}

export interface AIResponse {
  text: string;
  suggestions?: string[];
  actions?: Array<{
    type: string;
    data: any;
  }>;
  needsUserInput?: boolean;
}

export interface MCPToolDef {
  name: string;
  description?: string;
  inputSchema?: any;
}

// Tool parameter interfaces
export interface SearchBusinessesParams {
  latitude: number;
  longitude: number;
  radius?: number;
  keyword?: string;
  limit?: number;
}

export interface SignInParams {
  phone: string;
  country_code: string;
  name: string;
  location: [number, number];
}

export interface VerifyOtpParams {
  user_id: string;
  otp_code: string;
}

export interface CreateWhistleParams {
  user_input: string;
  access_token: string;
  confidence_threshold?: number;
  force_create?: boolean;
}

export interface ListWhistlesParams {
  access_token: string;
  active_only?: boolean;
}

export interface ToggleVisibilityParams {
  access_token: string;
  visible: "true" | "false";
}

export interface GetUserProfileParams {
  access_token: string;
}

// API Request/Response types
export interface ProcessMessageRequest {
  message: string;
  context?: ChatContext;
}

export interface ProcessMessageResponse {
  response: AIResponse;
  toolExecuted?: boolean;
  toolResult?: MCPResponse;
}

export interface ExecuteToolRequest {
  toolName: string;
  args: Record<string, any>;
  authToken?: string;
  userId?: string;
}

export interface HealthCheckResponse {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  services: {
    mcp: 'connected' | 'disconnected';
    openai: 'available' | 'unavailable';
  };
}

export interface ErrorResponse {
  error: string;
  message: string;
  timestamp: string;
  path?: string;
}
