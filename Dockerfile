# Stage 1: Build the application
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies (including dev)
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

# Copy source code and build
COPY . .
RUN npm run build

# Stage 2: Production runtime
FROM node:20-alpine AS runtime

WORKDIR /app

# Create a non-root user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Copy only package files and install prod dependencies
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts \
    && npm cache clean --force

# Copy compiled app from builder
COPY --from=builder /app/dist ./dist

# Change ownership to non-root user
RUN chown -R appuser:appgroup /app
USER appuser

EXPOSE 3001

# Add a healthcheck (customize endpoint if needed)
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:3001/health || exit 1

CMD ["node", "dist/app.js"]
