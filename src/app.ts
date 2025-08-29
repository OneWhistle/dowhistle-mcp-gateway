import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import dotenv from 'dotenv';
import { createAIRoutes } from './routes/aiRoutes.js';
import { createMCPRoutes } from './routes/mcpRoutes.js';
import { AIController } from './controllers/aiController.js';
import { MCPController } from './controllers/mcpController.js';
import { OpenAIService } from './services/openaiService.js';
import { MCPProxyService } from './services/mcpProxyService.js';
import { ToolRegistryService } from './services/toolRegistryService.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { logger } from './utils/logger.js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Validate required environment variables
if (!process.env.OPENAI_API_KEY) {
  logger.error('OPENAI_API_KEY environment variable is required');
  process.exit(1);
}

if (!process.env.MCP_SERVER_URL) {
  logger.error('MCP_SERVER_URL environment variable is required');
  process.exit(1);
}

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

app.disable('x-powered-by');

// CORS configuration
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [
  'http://localhost:5173',
  'http://localhost:8080',
  'http://localhost:3000'
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, etc.)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    
    logger.warn('CORS blocked origin', { origin });
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-User-Id']
}));

// Body parsing middleware
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware
app.use((req, res, next) => {
  logger.info('Incoming request', {
    method: req.method,
    path: req.path,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    hasAuth: !!req.headers.authorization,
    hasUserId: !!req.headers['x-user-id']
  });
  next();
});

// Initialize services
const mcpService = new MCPProxyService({
  serverUrl: process.env.MCP_SERVER_URL!
});

const openaiService = new OpenAIService({
  apiKey: process.env.OPENAI_API_KEY!,
  model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
  temperature: parseFloat(process.env.OPENAI_TEMPERATURE || '0.7')
});

const toolRegistryService = new ToolRegistryService(mcpService, openaiService);

// Initialize controllers
const aiController = new AIController(openaiService, mcpService);
const mcpController = new MCPController(mcpService);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  });
});

// API routes
app.use('/api/ai', createAIRoutes(aiController));
app.use('/api/mcp', createMCPRoutes(mcpController));

// 404 handler
app.use(notFoundHandler);

// Error handling middleware (must be last)
app.use(errorHandler);

// Graceful shutdown handler
const gracefulShutdown = async (signal: string) => {
  logger.info(`Received ${signal}, shutting down gracefully`);
  
  try {
    await toolRegistryService.stopSync();
    await mcpService.disconnect();
    logger.info('Services shut down successfully');
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown', { error });
    process.exit(1);
  }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Start server
const startServer = async () => {
  try {
    // Connect to MCP server
    logger.info('Connecting to MCP server...');
    const connected = await mcpService.connect();
    
    if (!connected) {
      logger.warn('Failed to connect to MCP server, but starting anyway');
    }

    // Start tool registry synchronization
    await toolRegistryService.startSync();

    // Start HTTP server
    app.listen(PORT, () => {
      logger.info(`DoWhistle MCP Backend running on port ${PORT}`, {
        environment: process.env.NODE_ENV || 'development',
        mcpConnected: connected,
        allowedOrigins
      });
    });
  } catch (error) {
    logger.error('Failed to start server', { error });
    process.exit(1);
  }
};

startServer();

export default app;
