# Build stage
FROM node:20.19.1-alpine3.20 AS builder
WORKDIR /app

# Install pnpm globally
RUN npm install -g pnpm

# Set environment variables to skip gyp-related installations
# ENV npm_config_build_from_source=true
ENV npm_config_gyp_ignore=true
ENV CYPRESS_INSTALL_BINARY=0
ENV SWC_BUILD=true

# Copy all necessary files in one layer
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json turbo.json ./
COPY apps/api/package.json ./apps/api/
COPY apps/api/prisma ./apps/api/prisma
COPY packages/ ./packages/

# Install dependencies with workspace support
RUN pnpm install --ignore-scripts

# Copy remaining source code
COPY . .

# Build packages in correct order using SWC
RUN pnpm build:api:fast

# # Clean up development dependencies
# RUN rm -rf node_modules
# RUN pnpm install --prod --frozen-lockfile --ignore-scripts

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

# Copy all necessary files from builder in one layer
COPY --from=builder /app/apps/api/dist ./apps/api/dist \
    --from=builder /app/node_modules ./node_modules \
    --from=builder /app/apps/api/prisma ./apps/api/prisma \
    --from=builder /app/apps/api/node_modules ./apps/api/node_modules \
    --from=builder /app/packages/ ./packages/

# Set environment variables
ENV NODE_ENV=production

EXPOSE 3000
CMD ["node", "apps/api/dist/server/main.js"]