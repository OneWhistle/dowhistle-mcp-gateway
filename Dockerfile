# Stage 1: Build the application
FROM node:18-alpine as builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts

COPY . .
RUN npm run build

# Stage 2: Create the production image
FROM node:18-alpine

WORKDIR /app

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

# Expose the port the app runs on
EXPOSE 3001

# Command to run the application
CMD ["node", "dist/app.js"]
