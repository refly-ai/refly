# Build stage
FROM node:20-alpine AS builder
WORKDIR /app
COPY . .
RUN npm install -g pnpm
RUN pnpm install
RUN pnpm build:api

# Production stage
FROM node:20-alpine
WORKDIR /app
RUN apk add --no-cache curl gcompat

# Install pandoc
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

# Copy necessary files
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma
COPY --from=builder /app/apps/api/package.json ./apps/api/package.json
COPY --from=builder /app/apps/api/.env.example ./apps/api/.env

# Generate Prisma Client
RUN cd apps/api && npx prisma generate

# Set environment variables
ENV DATABASE_URL="postgresql://refly:test@db:5432/refly?schema=refly"
ENV NODE_ENV=production

EXPOSE 3000

# Create start script
RUN echo '#!/bin/sh\n\
cd apps/api\n\
node dist/scripts/sync-db-schema.js\n\
node dist/main.js' > /start.sh && chmod +x /start.sh

CMD ["/start.sh"]