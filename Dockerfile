# ── Nyumbani — production image ──────────────────────────────────────
# Builds web SPA + API, serves both from one Fastify process.
FROM node:22-alpine

WORKDIR /app

RUN corepack enable

# Install dependencies (workspace-aware)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile

# Prisma client generation needs the schema
COPY apps/api/prisma apps/api/prisma
RUN cd apps/api && pnpm exec prisma generate

# Build web, then API
COPY apps/web apps/web
RUN cd apps/web && pnpm build

COPY apps/api apps/api
RUN cd apps/api && pnpm exec tsc -p tsconfig.json

# Runtime: run migrations then start server
WORKDIR /app/apps/api
EXPOSE 3000
CMD ["sh", "-c", "./node_modules/.bin/prisma migrate deploy && node dist/server.js"]
