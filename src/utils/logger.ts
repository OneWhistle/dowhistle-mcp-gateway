import winston from 'winston';

const logLevel =
  process.env.LOG_LEVEL || (process.env.NODE_ENV !== 'production' ? 'debug' : 'info');

export const logger = winston.createLogger({
  level: logLevel,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'dowhistle-mcp-backend' },
  transports: [
    // Always have at least one transport
    new winston.transports.Console({
      format:
        process.env.NODE_ENV !== 'production'
          ? winston.format.combine(winston.format.colorize(), winston.format.simple())
          : winston.format.json(), // structured logs in prod
    }),
  ],
});

// Optional: add file logging in non-prod
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.File({ filename: 'logs/error.log', level: 'error' }));
  logger.add(new winston.transports.File({ filename: 'logs/combined.log' }));
}
