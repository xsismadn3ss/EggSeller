# Deps
# Debian slim (no Alpine): el binario opencode embebido necesita glibc.
# Base pineada por digest: builds reproducibles y sin sorpresas por tags móviles.
# El primer build requiere internet; los siguientes reusan caché local.
ARG NODE_IMAGE=node:20-slim@sha256:2cf067cfed83d5ea958367df9f966191a942351a2df77d6f0193e162b5febfc0
FROM ${NODE_IMAGE} AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# Build
FROM ${NODE_IMAGE} AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# Runner (producción)
FROM ${NODE_IMAGE} AS runner
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
