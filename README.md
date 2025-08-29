# DoWhistle MCP Gateway

A robust Node.js/TypeScript backend API server that acts as a gateway between web applications and Model Context Protocol (MCP) servers. This service provides AI-powered functionality through OpenAI integration and seamless MCP tool execution capabilities.

## 🚀 Features

- **MCP Integration**: Full Model Context Protocol client implementation with automatic reconnection
- **AI Services**: OpenAI integration for intelligent message processing and tool orchestration
- **RESTful API**: Clean, documented REST endpoints for AI and MCP operations
- **Security**: Built-in security middleware including CORS, Helmet, and rate limiting
- **Logging**: Comprehensive logging with Winston for monitoring and debugging
- **TypeScript**: Full TypeScript support with strict type checking
- **Error Handling**: Robust error handling and graceful shutdown procedures

## 🏗️ Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Web Client   │───▶│  MCP Gateway     │───▶│  MCP Server    │
│                 │    │  (This Service)  │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                              │
                              ▼
                       ┌──────────────────┐
                       │   OpenAI API     │
                       │                  │
                       └──────────────────┘
```

## 📁 Project Structure

```
src/
├── controllers/          # Request handlers
│   ├── aiController.ts   # AI-related operations
│   └── mcpController.ts  # MCP tool operations
├── middleware/           # Express middleware
│   ├── errorHandler.ts   # Error handling
│   ├── validation.ts     # Request validation
│   └── rate_limit.ts     # Rate limiting
├── routes/               # API route definitions
│   ├── aiRoutes.ts       # AI endpoints
│   └── mcpRoutes.ts      # MCP endpoints
├── services/             # Business logic
│   ├── mcpProxyService.ts    # MCP client management
│   ├── openaiService.ts      # OpenAI integration
│   └── toolRegistryService.ts # Tool synchronization
├── types/                # TypeScript type definitions
├── utils/                # Utility functions
│   └── logger.ts         # Logging configuration
└── app.ts                # Main application entry point
```

## 🛠️ Prerequisites

- Node.js >= 18.0.0
- npm or yarn package manager
- Access to OpenAI API
- MCP server running and accessible

## ⚙️ Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/OneWhistle/dowhistle-mcp-gateway
   cd dowhistle-mcp-gateway
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Configuration**
   Create a `.env` file in the root directory:
   ```env
   # Server Configuration
   PORT=3001
   NODE_ENV=development
   
   # OpenAI Configuration
   OPENAI_API_KEY=your_openai_api_key_here
   OPENAI_MODEL=gpt-4o-mini
   OPENAI_TEMPERATURE=0.7
   
   # MCP Server Configuration
   MCP_SERVER_URL=http://localhost:8000
   
   # CORS Configuration
   ALLOWED_ORIGINS=http://localhost:5173,http://localhost:8080,http://localhost:3000
   ```

## 🚀 Usage

### Local Development with Docker Compose

For local development with hot-reloading:

1. **Ensure your `.env` file is configured** (e.g., `OPENAI_API_KEY`, `MCP_SERVER_URL`, `ALLOWED_ORIGINS`).

2. **Start the development service** (this will use `Dockerfile.dev`)
   ```bash
   docker-compose -f docker-compose.yml -f docker-compose.override.yml up --build
   ```
   This command will build the `dev` image and start the `mcp-gateway-dev` container with hot-reloading.

3. **Stop the development service**
   ```bash
   docker-compose -f docker-compose.yml -f docker-compose.override.yml down
   ```

### Production Build and Run with Docker Compose

For production deployment:

1. **Ensure your `.env` file is configured with the necessary environment variables** (e.g., `OPENAI_API_KEY`, `MCP_SERVER_URL`, `ALLOWED_ORIGINS`).

2. **Start the production service**
   ```bash
   docker-compose up --build -d
   ```
   This will build the `prod` image and start the `mcp-gateway` service in detached mode.

3. **Stop the service**
   ```bash
   docker-compose down
   ```

### Other Commands
```bash
npm run lint      # Run ESLint
npm test          # Run tests
```

## 📡 API Endpoints

### Health Check
- `GET /health` - Server health status

### AI Routes (`/api/ai`)
- `POST /api/ai/process-message` - Process user messages with AI

### MCP Routes (`/api/mcp`)
- `POST /api/mcp/connect` - Connect to MCP server
- `POST /api/mcp/disconnect` - Disconnect from MCP server
- `GET /api/mcp/status` - Get MCP connection status
- `GET /api/mcp/health` - MCP health check
- `GET /api/mcp/tools` - List available MCP tools
- `GET /api/mcp/resources` - Get MCP resources
- `POST /api/mcp/tools/:toolName` - Execute specific MCP tool

## 🔧 Configuration

### Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `PORT` | Server port | 3001 | No |
| `NODE_ENV` | Environment mode | development | No |
| `OPENAI_API_KEY` | OpenAI API key | - | Yes |
| `OPENAI_MODEL` | OpenAI model to use | gpt-4o-mini | No |
| `OPENAI_TEMPERATURE` | AI response creativity | 0.7 | No |
| `MCP_SERVER_URL` | MCP server URL | - | Yes |
| `ALLOWED_ORIGINS` | CORS allowed origins | localhost variants | No |

### Rate Limiting

- **AI endpoints**: 50 requests per 15 minutes per IP
- **MCP endpoints**: 100 requests per 15 minutes per IP

## 🔒 Security Features

- **Helmet**: Security headers and CSP configuration
- **CORS**: Configurable cross-origin resource sharing
- **Rate Limiting**: Protection against abuse
- **Input Validation**: Request payload validation
- **Error Handling**: Secure error responses

## 📊 Logging

The service uses Winston for logging with the following levels:
- **Error**: Application errors and failures
- **Warn**: Warning conditions
- **Info**: General information and requests
- **Debug**: Detailed debugging information

Logs are written to both console and log files in the `logs/` directory.

## 🧪 Testing

```bash
npm test
```

Tests are configured with Jest and cover the main functionality of the service.

## 🐳 Docker Support

The service can be containerized and deployed using Docker and Docker Compose.

### Build and Run with Docker

1. **Build the Docker image**
   ```bash
   docker build -t dowhistle-mcp-gateway .
   ```

2. **Run the Docker container**
   ```bash
   docker run -p 3001:3001 dowhistle-mcp-gateway
   ```

### Deploy with Docker Compose

1. **Ensure your `.env` file is configured with the necessary environment variables** (e.g., `OPENAI_API_KEY`, `MCP_SERVER_URL`, `ALLOWED_ORIGINS`). Docker Compose will pick these up.

2. **Start the service using Docker Compose**
   ```bash
   docker-compose up -d
   ```
   This will build the image (if not already built) and start the `mcp-gateway` service in detached mode.

3. **Stop the service**
   ```bash
   docker-compose down
   ```

## 📝 Development

### Code Style
- TypeScript with strict mode enabled
- ESLint for code quality
- Prettier for code formatting

### Adding New Features
1. Create new service classes in `src/services/`
2. Add controllers in `src/controllers/`
3. Define routes in `src/routes/`
4. Update types in `src/types/`
5. Add validation middleware if needed

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For support and questions:
- Create an issue in the repository
- Check the logs for debugging information
- Verify environment configuration

## 🔄 Changelog

### Version 1.0.0
- Initial release
- MCP client integration
- OpenAI service integration
- RESTful API endpoints
- Security middleware
- Comprehensive logging
