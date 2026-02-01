# Dataverse Web Resources MCP - Docker image for Coolify
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm ci --omit=dev

# Copy source
COPY . .

# Expose port (Coolify sets PORT env, e.g. 8000)
EXPOSE 3000

# Health check – uses same PORT as the app (Coolify passes PORT=8000 etc.)
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT:-3000}/health" || exit 1

CMD ["node", "index.js"]
