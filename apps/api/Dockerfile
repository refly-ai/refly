# Base image
FROM node:20-alpine@sha256:b5b9467fe7b33aad47f1ec3f6e0646a658f85f05c18d4243024212a91f3b7554

# Install curl for healthcheck and pandoc dependencies
RUN apk add --no-cache curl gcompat

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

WORKDIR /app

RUN npm install -g pnpm@8.15.8

COPY . .
RUN pnpm install
RUN pnpm build:api

EXPOSE 3000
CMD [ "node", "apps/api/dist/main.js" ]
