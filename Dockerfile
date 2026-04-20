FROM node:22-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy backend files
COPY backend ./backend

# Expose port
EXPOSE 3000

# Set environment variables (can be overridden)
ENV NODE_ENV=production
ENV PORT=3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (res) => { if (res.statusCode !== 200) throw new Error(res.statusCode) })"

# Start the server
CMD ["node", "backend/server.js"]
