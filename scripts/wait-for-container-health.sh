#!/usr/bin/env bash
set -e

function wait_for_health {
    local container="$1"
    local max_attempts=30
    local count=0

    while [ "$count" -lt "$max_attempts" ]; do
        health_status=$(docker inspect --format '{{.State.Health.Status}}' "$container")
        if [ "$health_status" == "healthy" ]; then
            echo "$container is healthy."
            return 0
        fi
        echo "Waiting for $container to be healthy..."
        sleep 5
        count=$((count + 1))
    done

    echo "$container did not become healthy in time."
    return 1
}

# Check if any arguments were provided
if [ $# -eq 0 ]; then
    echo "Error: No container names provided"
    echo "Usage: $0 container1 container2 ..."
    exit 1
fi

# Process each container name provided as an argument
for container in "$@"; do
    wait_for_health "$container" || exit 1
done

echo "All containers are healthy!"
