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
ENV TURSO_DATABASE_URL=libsql://saleseast-hanki.aws-ap-northeast-1.turso.io
ENV TURSO_AUTH_TOKEN=eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3Nzc3MTg3MDQsImlkIjoiMDE5ZGUzMDgtOTcwMS03OTQzLWE1OWItNjBjNmMxYjI0YjAxIiwicmlkIjoiOWY0ZmIxZGQtYjI3NS00YjZiLTk3MWQtYjZmYTE3ZWVlMTJhIn0.vH-NXXa2NGI8WvG2VfuX1Hv8akh636P1fQ_ovsSXmCnAxbGy6oe9dZlOVjZ-LljdJlRxtusET1LxqcmupQozAQ
ENV NEXTAUTH_SECRET=75e37761c49482d0e916c2edb89f32d8f5a1ed9a6a56ac5bcfd8a15f7a25df35
ENV NEXTAUTH_URL=http://192.168.1.123:3000

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
