# Stage 1: Install dependencies (root + all workspaces)
FROM node:20-slim AS deps
WORKDIR /app

RUN apt-get update && apt-get install -y openssl git \
    && rm -rf /var/lib/apt/lists/*

# Copy every workspace's package.json so npm can resolve the full workspace graph
COPY package.json package-lock.json* ./
COPY apps/frontend/package.json ./apps/frontend/package.json
COPY apps/backend/package.json ./apps/backend/package.json
COPY packages/database/package.json ./packages/database/package.json
RUN npm ci

# Stage 2: Build
FROM node:20-slim AS builder
WORKDIR /app

RUN apt-get update && apt-get install -y openssl \
    && rm -rf /var/lib/apt/lists/*

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate the centralized Prisma client (packages/database is the single source of truth)
RUN npm run generate --workspace=packages/database

ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build:frontend

# Stage 3: Runner
FROM node:20-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN groupadd --system --gid 1001 nodejs
RUN useradd --system --uid 1001 nextjs

# Chromium dependency installation from user requirements
RUN apt-get update && apt-get install -y wget gnupg \
    && wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
    && sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' \
    && apt-get update \
    && apt-get install -y google-chrome-stable fonts-ipafont-gothic fonts-wqy-zenhei fonts-thai-tlwg fonts-kacst fonts-freefont-ttf libxss1 openssl \
      --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Next.js standalone output in an npm-workspaces monorepo nests under the app's
# path relative to the detected workspace root (apps/frontend), and hoists a
# trimmed node_modules alongside it.
COPY --from=builder /app/apps/frontend/public ./apps/frontend/public
RUN mkdir -p ./apps/frontend/.next
RUN chown nextjs:nodejs ./apps/frontend/.next

COPY --from=builder --chown=nextjs:nodejs /app/apps/frontend/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/frontend/.next/static ./apps/frontend/.next/static

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Entry point lives at apps/frontend/server.js inside the traced standalone output
CMD ["node", "apps/frontend/server.js"]
