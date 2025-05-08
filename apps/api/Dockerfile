# Build stage
FROM node:20.19.1-alpine3.20 AS builder
WORKDIR /app

# Install pnpm globally
RUN npm install -g pnpm

# Copy package files first to leverage Docker cache
COPY pnpm-lock.yaml ./
COPY pnpm-workspace.yaml ./
COPY package.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/*/package.json ./packages/
COPY apps/api/src/prisma ./apps/api/src/prisma

# Install dependencies
ENV CYPRESS_INSTALL_BINARY=0
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build the application
RUN SWC_BUILD=true pnpm build:api

# Clean up development dependencies
RUN rm -rf node_modules && \
    find . -type d -name node_modules -exec rm -rf {} + 2>/dev/null || true
RUN pnpm install --prod --frozen-lockfile --ignore-scripts

# wkhtmltopdf stage
FROM surnet/alpine-wkhtmltopdf:3.20.3-0.12.6-small AS wkhtmltopdf

# Production stage
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
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma
COPY --from=builder /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=builder /app/packages/ ./packages/

# Set environment variables
ENV NODE_ENV=production

EXPOSE 3000
CMD ["node", "apps/api/dist/server/main.js"]