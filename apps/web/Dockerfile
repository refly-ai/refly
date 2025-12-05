# Nginx stage
FROM nginx:1.27.3-alpine

# Install envsubst and bash for environment variable substitution
RUN apk add --no-cache bash

# Copy nginx configurations (no-proxy as default, proxy as optional)
COPY deploy/docker/nginx.conf /etc/nginx/conf.d/default.noproxy.conf
COPY deploy/docker/nginx-proxy.conf /etc/nginx/conf.d/default.proxy.conf

# Copy static files
WORKDIR /usr/share/nginx/html
COPY apps/web/dist .

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
};
EOF

# Create entrypoint script
RUN cat << 'EOF' > /docker-entrypoint.sh
#!/bin/bash
set -e

# Generate runtime config.js from template
envsubst < /usr/share/nginx/html/config.template.js > /usr/share/nginx/html/config.js

# Select nginx config based on ENABLE_REVERSE_PROXY (default is no reverse proxy)
if [ "$ENABLE_REVERSE_PROXY" = "true" ]; then
  cp /etc/nginx/conf.d/default.proxy.conf /etc/nginx/conf.d/default.conf
else
  cp /etc/nginx/conf.d/default.noproxy.conf /etc/nginx/conf.d/default.conf
fi

exec nginx -g "daemon off;"
EOF

RUN chmod +x /docker-entrypoint.sh

# Expose port 80
EXPOSE 80

# Start Nginx with our entrypoint script
ENTRYPOINT ["/docker-entrypoint.sh"]
