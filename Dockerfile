# ---- Build stage ----
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Build the Vite frontend
RUN npm run build

# ---- Production stage ----
FROM node:20-alpine AS runner

WORKDIR /app

# Install only production dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy built frontend and server code
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server.ts ./server.ts
COPY --from=builder /app/public ./public

# Install tsx to run TypeScript server directly
RUN npm install tsx --save-dev

ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

CMD ["npx", "tsx", "server.ts"]
