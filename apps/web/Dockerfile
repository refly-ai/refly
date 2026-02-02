# Build stage
FROM node:20.19.1-alpine3.20 AS builder
WORKDIR /app

# Enable corepack and activate pnpm
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate

# Set environment variables to skip gyp-related installations
ENV npm_config_gyp_ignore=true
ENV CYPRESS_INSTALL_BINARY=0

# Set node options to increase memory limit
ENV NODE_OPTIONS='--max_old_space_size=8192'

# Copy all necessary files in one layer
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json turbo.json ./
COPY apps/web/package.json ./apps/web/
COPY packages/ ./packages/

# Install dependencies with workspace support
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --ignore-scripts

# Copy remaining source code
COPY . .

# Build arguments for environment variables
ARG PUBLIC_CLOUDFLARE_SITE_KEY
ENV PUBLIC_CLOUDFLARE_SITE_KEY=$PUBLIC_CLOUDFLARE_SITE_KEY

# Build packages in correct order
RUN pnpm build:web

# Nginx stage
FROM nginx:1.27.3-alpine

# Install envsubst and bash for environment variable substitution
RUN apk add --no-cache bash

# Copy nginx configuration
COPY deploy/docker/nginx.conf /etc/nginx/conf.d/default.conf

# Copy static files from builder
WORKDIR /usr/share/nginx/html
COPY --from=builder /app/apps/web/dist .

# Create config.js template (will be processed by envsubst at container startup)
RUN cat << 'EOF' > /usr/share/nginx/html/config.template.js
window.ENV = {
  API_URL: "$API_URL" || undefined,
  COLLAB_URL: "$COLLAB_URL" || undefined,
  STATIC_PUBLIC_ENDPOINT: "$STATIC_PUBLIC_ENDPOINT" || undefined,
  STATIC_PRIVATE_ENDPOINT: "$STATIC_PRIVATE_ENDPOINT" || undefined,
  SUBSCRIPTION_ENABLED: "$SUBSCRIPTION_ENABLED" === "true",
  CANVAS_TEMPLATE_ENABLED: "$CANVAS_TEMPLATE_ENABLED" === "true",
  SENTRY_ENABLED: "$SENTRY_ENABLED" === "true",
  ENV_TAG: "$ENV_TAG" || undefined,
  DEPLOY_TYPE: "$DEPLOY_TYPE" || undefined,
  PUBLIC_CLOUDFLARE_SITE_KEY: "$PUBLIC_CLOUDFLARE_SITE_KEY" || undefined,
};
EOF

# Create entrypoint script
RUN cat << 'EOF' > /docker-entrypoint.sh
#!/bin/bash
set -e

# Generate runtime config.js from template
envsubst < /usr/share/nginx/html/config.template.js > /usr/share/nginx/html/config.js

exec nginx -g "daemon off;"
EOF

RUN chmod +x /docker-entrypoint.sh

# Expose port 80
EXPOSE 80

# Start Nginx with our entrypoint script
ENTRYPOINT ["/docker-entrypoint.sh"]
