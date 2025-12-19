# syntax=docker/dockerfile:1.4
# NOTE: This Dockerfile requires Docker BuildKit (default since Docker 23.0)
# For older Docker versions, build with: DOCKER_BUILDKIT=1 docker build ...
# Or use: docker buildx build ...

################################################################################
# CACHE OPTIMIZATION STRATEGY:
# 1. turbo prune: Automatically extracts only needed packages (no manual COPY!)
# 2. pnpm fetch: Downloads packages using ONLY lockfile (most cacheable)
# 3. pnpm install --offline: Instant since packages already fetched
# 4. Prisma generate: Separate layer, changes rarely
# 5. Build with turbo cache: Incremental builds via cache mount
################################################################################

# Stage 1: Pruner - extracts only the packages needed for @refly/api
FROM node:20.19.1-alpine3.20 AS pruner
RUN npm install -g turbo
WORKDIR /app
COPY . .
RUN turbo prune @refly/api --docker

# Stage 2: Builder - installs dependencies and builds
FROM node:20.19.1-alpine3.20 AS builder
WORKDIR /app

# Install pnpm globally
RUN npm install -g pnpm

# Set environment variables
ENV npm_config_gyp_ignore=true
ENV CYPRESS_INSTALL_BINARY=0
ENV NODE_OPTIONS='--max_old_space_size=8192'

# Step 1: Fetch dependencies using ONLY the pruned lockfile
COPY --from=pruner /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm fetch

# Step 2: Copy pruned package.json files (auto-generated, no manual list!)
COPY --from=pruner /app/out/json/ .

# Step 3: Install from cache (--offline makes this instant)
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --offline --ignore-scripts

# Step 4: Copy full source code (pruned to only what's needed)
COPY --from=pruner /app/out/full/ .

# Step 5: Copy prisma schema and generate client
COPY apps/api/prisma ./apps/api/prisma
RUN cd apps/api && pnpm exec prisma generate

# Step 6: Build with turbo cache mount
COPY turbo.json ./
RUN --mount=type=cache,id=turbo,target=/app/.turbo \
    pnpm build:api

# Stage 3: wkhtmltopdf binary
FROM surnet/alpine-wkhtmltopdf:3.20.3-0.12.6-small AS wkhtmltopdf

# Stage 4: Production
FROM node:20.19.1-alpine3.20 AS production
WORKDIR /app

# Install system dependencies in a single layer
RUN apk add --no-cache \
    curl \
    gcompat \
    libstdc++ \
    libx11 \
    libxrender \
    libxext \
    libssl3 \
    ca-certificates \
    fontconfig \
    freetype \
    font-terminus \
    font-inconsolata \
    font-dejavu \
    font-noto \
    font-noto-cjk \
    font-awesome \
    font-noto-extra \
    && fc-cache -f

# Copy wkhtmltopdf
COPY --from=wkhtmltopdf /bin/wkhtmltopdf /bin/wkhtmltopdf

# Install pandoc based on architecture
ARG TARGETARCH
RUN if [ "$TARGETARCH" = "amd64" ]; then \
        wget https://github.com/jgm/pandoc/releases/download/3.6.3/pandoc-3.6.3-linux-amd64.tar.gz \
        && tar xvzf pandoc-3.6.3-linux-amd64.tar.gz --strip-components 1 -C /usr/local/ \
        && rm pandoc-3.6.3-linux-amd64.tar.gz; \
    elif [ "$TARGETARCH" = "arm64" ]; then \
        wget https://github.com/jgm/pandoc/releases/download/3.6.3/pandoc-3.6.3-linux-arm64.tar.gz \
        && tar xvzf pandoc-3.6.3-linux-arm64.tar.gz --strip-components 1 -C /usr/local/ \
        && rm pandoc-3.6.3-linux-arm64.tar.gz; \
    fi

# Copy only necessary files from builder
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/package.json ./apps/api/package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma
COPY --from=builder /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=builder /app/packages/ ./packages/

# Set environment variables
ENV NODE_ENV=production

# Set working directory to the dist directory
WORKDIR /app/apps/api/dist

EXPOSE 3000

CMD ["node", "-r", "./scripts/preload.js", "main.js"]
