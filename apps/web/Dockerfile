# Nginx stage
FROM nginx:1.27.3-alpine

# Install envsubst and bash for environment variable substitution
RUN apk add --no-cache bash

# Copy nginx configuration
COPY deploy/docker/nginx.conf /etc/nginx/conf.d/default.conf

# Copy static files
WORKDIR /usr/share/nginx/html
COPY apps/web/dist .

# Create config.js template
RUN echo 'window.ENV = { API_URL: "$API_URL", COLLAB_URL: "$COLLAB_URL" };' > /usr/share/nginx/html/config.template.js

# Create entrypoint script
RUN printf '#!/bin/bash\n\
envsubst < /usr/share/nginx/html/config.template.js > /usr/share/nginx/html/config.js\n\
exec nginx -g "daemon off;"\n' > /docker-entrypoint.sh

RUN chmod +x /docker-entrypoint.sh

# Expose port 80
EXPOSE 80

# Start Nginx with our entrypoint script
ENTRYPOINT ["/docker-entrypoint.sh"]
