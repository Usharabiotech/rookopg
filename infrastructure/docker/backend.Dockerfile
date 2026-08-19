#
# PG Platform API.
#
# Built from the repository root, not this directory:
#   docker build -f infrastructure/docker/backend.Dockerfile .
#
# A pnpm workspace, so the lockfile and every package manifest have to be in
# place before install — copying the whole tree first would bust the layer
# cache on any source change.

# ---------------------------------------------------------------------------
# deps — install once, cache until a manifest changes
# ---------------------------------------------------------------------------
FROM node:20.19.0-alpine AS deps
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /repo

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/backend/package.json apps/backend/
COPY apps/web/package.json apps/web/

RUN pnpm install --frozen-lockfile --filter @pgplatform/backend...

# ---------------------------------------------------------------------------
# build — compile, then strip back to production dependencies
# ---------------------------------------------------------------------------
FROM deps AS build
WORKDIR /repo
COPY apps/backend apps/backend

# Generate against the schema before compiling: the client is imported by name
# and the build fails without it.
RUN pnpm --filter @pgplatform/backend exec prisma generate \
 && pnpm --filter @pgplatform/backend build \
 && pnpm prune --prod

# ---------------------------------------------------------------------------
# runtime — no toolchain, no source, not root
# ---------------------------------------------------------------------------
FROM node:20.19.0-alpine AS runtime
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

# wget is used by the health check below; alpine ships busybox wget already.
WORKDIR /app
ENV NODE_ENV=production

# Production dependencies installed fresh rather than copied from the build
# stage. A pnpm workspace links into a shared store, so copying node_modules
# drags the whole thing in - the first attempt produced a 1.2 GB image.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/backend/package.json apps/backend/
RUN pnpm install --frozen-lockfile --prod --filter @pgplatform/backend...  && pnpm store prune

COPY --from=build /repo/apps/backend/dist ./apps/backend/dist
# The schema and migrations travel with the image so `migrate deploy` runs
# against this exact build rather than whatever is on somebody's laptop.
COPY --from=build /repo/apps/backend/prisma ./apps/backend/prisma
RUN pnpm --filter @pgplatform/backend exec prisma generate

# A compromised process should not own the files it runs from.
RUN addgroup -S app && adduser -S app -G app && chown -R app:app /app
USER app

# Railway sets PORT. The default matches local development.
ENV PORT=3001
EXPOSE 3001

# The platform polls this. It must answer before traffic is routed here.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget --spider -q "http://127.0.0.1:${PORT}/api/v1/health" || exit 1

WORKDIR /app/apps/backend
CMD ["node", "dist/src/main.js"]
