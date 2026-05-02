# =============================================================================
#  East African Spirit Sales — Next.js 14 + Turso
# =============================================================================
#  Required RUNTIME environment variables (pass these when running the container):
#    TURSO_DATABASE_URL=libsql://your-db.turso.io
#    TURSO_AUTH_TOKEN=your-turso-token
#    NEXTAUTH_SECRET=your-random-secret
#    NEXTAUTH_URL=https://your-domain.com
#
#  Build-time placeholders below are only so "next build" completes.
#  The actual values are injected at runtime via docker run -e ...
# =============================================================================

# ── Stage 1: deps ──────────────────────────────────────────────────────────
FROM node:20-bookworm-slim AS deps
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

# ── Stage 2: builder ───────────────────────────────────────────────────────
FROM node:20-bookworm-slim AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
ENV TURSO_DATABASE_URL=http://placeholder
ENV TURSO_AUTH_TOKEN=placeholder
ENV NEXTAUTH_SECRET=placeholder
ENV NEXTAUTH_URL=http://localhost:3000

RUN npm run build

# ── Stage 3: runner ────────────────────────────────────────────────────────
FROM node:20-bookworm-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN groupadd --system --gid 1001 nodejs && \
    useradd --system --uid 1001 --gid nodejs nextjs

# Next.js standalone output
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

CMD ["node", "server.js"]
