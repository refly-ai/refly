#!/bin/bash
set -e

# Start Elasticsearch in the background
echo "discovery.type: ${discovery.type}"
echo "xpack.security.enabled: ${xpack.security.enabled}"
/usr/local/bin/docker-entrypoint.sh eswrapper &

# Wait for Elasticsearch to become available
until curl -s http://localhost:9200 >/dev/null; do
    echo 'Waiting for Elasticsearch to become available...'
    sleep 5
done

# Check if the plugin is already installed
if ! bin/elasticsearch-plugin list | grep -q analysis-icu; then
    echo "Installing analysis-icu plugin..."
    bin/elasticsearch-plugin install analysis-icu
    
    # Restart Elasticsearch
    kill $(pgrep -f org.elasticsearch.bootstrap.Elasticsearch)
    wait $(pgrep -f org.elasticsearch.bootstrap.Elasticsearch)
    /usr/local/bin/docker-entrypoint.sh eswrapper
else
    echo "analysis-icu plugin is already installed."
fi

# Keep the container running
wait