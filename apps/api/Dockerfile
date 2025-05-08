# Build stage
FROM node:20.19.1-alpine3.20 AS builder
WORKDIR /app

# Install dependencies  for build cache friendly
RUN npm install -g pnpm
COPY pnpm-lock.yaml ./
COPY package.json ./
COPY apps/api/package.json ./apps/api/


ENV CYPRESS_INSTALL_BINARY=0
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build:api
RUN rm -rf node_modules && \
    find . -type d -name node_modules -exec rm -rf {} + 2>/dev/null || true
RUN pnpm install --prod --ignore-scripts

# wkhtmltopdf stage
FROM surnet/alpine-wkhtmltopdf:3.20.3-0.12.6-small AS wkhtmltopdf

# Production stage
FROM node:20.19.1-alpine3.20 AS production
WORKDIR /app
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

# Copy wkhtmltopdf files from wkhtmltopdf stage
COPY --from=wkhtmltopdf /bin/wkhtmltopdf /bin/wkhtmltopdf

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

COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma
COPY --from=builder /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=builder /app/packages/ ./packages/

EXPOSE 3000
CMD ["node", "apps/api/dist/server/main.js"]
