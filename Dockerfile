# Deps
# Debian slim (no Alpine): el binario opencode embebido necesita glibc
FROM node:20-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# Build
FROM node:20-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# Runner (producción)
FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
# Binario opencode pineado (185MB): el standalone de Next no lo traza
# porque se ejecuta como proceso hijo, no como import
COPY --from=builder /app/node_modules/opencode-ai/bin/opencode.exe /app/bin/opencode
ENV OPENCODE_BIN_DIR=/app/bin
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
EXPOSE 3000
CMD ["node", "server.js"]
