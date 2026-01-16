#!/bin/bash
#
# Refly CLI One-Click Deployment Script
#
# This script automates the full deployment of Refly CLI for local development:
# 1. Clone/update the refly repository
# 2. Switch to CLI branch
# 3. Install dependencies and build
# 4. Start local services (database, API)
# 5. Seed global tools data
# 6. Guide through login and API key generation
#

set -e

# =============================================================================
# Configuration
# =============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REFLY_DIR="${REFLY_DIR:-$HOME/refly}"
REFLY_REPO="${REFLY_REPO:-https://github.com/refly-ai/refly.git}"
REFLY_BRANCH="${REFLY_BRANCH:-feat/cli/init}"

# Database configuration (should match .env.development)
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-35432}"
DB_USER="${DB_USER:-refly}"
DB_PASSWORD="${DB_PASSWORD:-test}"
DB_NAME="${DB_NAME:-refly}"
DB_SCHEMA="${DB_SCHEMA:-refly}"

# API configuration
API_PORT="${API_PORT:-5800}"
WEB_PORT="${WEB_PORT:-5700}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# =============================================================================
# Helper Functions
# =============================================================================

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_command() {
    if ! command -v "$1" &> /dev/null; then
        log_error "$1 is not installed. Please install it first."
        exit 1
    fi
}

wait_for_port() {
    local port=$1
    local max_attempts=${2:-30}
    local attempt=0

    log_info "Waiting for port $port to be ready..."
    while ! nc -z localhost "$port" 2>/dev/null; do
        attempt=$((attempt + 1))
        if [ $attempt -ge $max_attempts ]; then
            log_error "Timeout waiting for port $port"
            return 1
        fi
        sleep 1
    done
    log_success "Port $port is ready"
}

# =============================================================================
# Step 1: Check Prerequisites
# =============================================================================

check_prerequisites() {
    log_info "Checking prerequisites..."

    check_command "git"
    check_command "node"
    check_command "pnpm"
    check_command "docker"

    # Check Node version
    NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
    if [ "$NODE_VERSION" -lt 20 ]; then
        log_error "Node.js version 20 or higher is required. Current: $(node -v)"
        exit 1
    fi

    # Check if Docker is running
    if ! docker info &> /dev/null; then
        log_error "Docker is not running. Please start Docker first."
        exit 1
    fi

    log_success "All prerequisites met"
}

# =============================================================================
# Step 2: Clone/Update Repository
# =============================================================================

setup_repository() {
    log_info "Setting up repository..."

    if [ -d "$REFLY_DIR" ]; then
        log_info "Repository exists, updating..."
        cd "$REFLY_DIR"
        git fetch origin
        git checkout "$REFLY_BRANCH"
        git pull origin "$REFLY_BRANCH"
    else
        log_info "Cloning repository..."
        git clone "$REFLY_REPO" "$REFLY_DIR"
        cd "$REFLY_DIR"
        git checkout "$REFLY_BRANCH"
    fi

    log_success "Repository ready at $REFLY_DIR"
}

# =============================================================================
# Step 3: Install Dependencies and Build
# =============================================================================

install_and_build() {
    log_info "Installing dependencies..."
    cd "$REFLY_DIR"

    pnpm install

    log_info "Building CLI package..."
    cd "$REFLY_DIR/packages/cli"
    pnpm build

    # Link CLI globally (optional)
    if [ "${LINK_CLI:-false}" = "true" ]; then
        log_info "Linking CLI globally..."
        pnpm link --global
    fi

    log_success "Build completed"
}

# =============================================================================
# Step 4: Start Services
# =============================================================================

start_services() {
    log_info "Starting services..."
    cd "$REFLY_DIR"

    # Start Docker containers (database, redis, etc.)
    log_info "Starting Docker containers..."
    if [ -f "deploy/docker/docker-compose.dev.yml" ]; then
        docker-compose -f deploy/docker/docker-compose.dev.yml up -d db redis
    elif [ -f "docker-compose.yml" ]; then
        docker-compose up -d db redis
    else
        log_warning "No docker-compose file found, assuming services are already running"
    fi

    # Wait for database to be ready
    wait_for_port "$DB_PORT" 60

    # Copy environment file if not exists
    cd "$REFLY_DIR/apps/api"
    if [ ! -f ".env" ]; then
        log_info "Copying environment configuration..."
        cp .env.development .env
    fi

    # Run database migrations
    log_info "Running database migrations..."
    pnpm prisma migrate deploy 2>/dev/null || pnpm prisma db push

    # Start API server in background
    log_info "Starting API server..."
    pnpm dev &
    API_PID=$!
    echo "$API_PID" > /tmp/refly-api.pid

    # Wait for API to be ready
    wait_for_port "$API_PORT" 120

    log_success "Services started"
}

# =============================================================================
# Step 5: Seed Tool Data
# =============================================================================

seed_tool_data() {
    log_info "Seeding global tool data..."

    SEED_FILE="$SCRIPT_DIR/seed-data/seed_tools.sql"

    if [ ! -f "$SEED_FILE" ]; then
        log_warning "Seed file not found at $SEED_FILE"
        log_info "Generating seed data from existing database..."

        # Use Node.js script to seed data via API or direct DB connection
        node "$SCRIPT_DIR/seed-tools.mjs"
    else
        # Execute seed SQL
        PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$SEED_FILE"
    fi

    log_success "Tool data seeded"
}

# =============================================================================
# Step 6: Login and Generate API Key
# =============================================================================

setup_authentication() {
    log_info "Setting up authentication..."

    cd "$REFLY_DIR/packages/cli"

    # Check if already logged in
    if node dist/bin/refly.js status 2>/dev/null | grep -q "Authenticated"; then
        log_success "Already authenticated"
        return
    fi

    echo ""
    echo "=============================================="
    echo "  Please complete the login process"
    echo "=============================================="
    echo ""
    echo "A browser window will open for OAuth login."
    echo "After successful login, an API key will be"
    echo "automatically generated and saved."
    echo ""

    # Start login process
    node dist/bin/refly.js login --host "http://localhost:$API_PORT"

    # If login successful, the config should be saved
    # Now generate API key via the seed script
    log_info "Generating API key..."
    node "$SCRIPT_DIR/generate-apikey.mjs"

    log_success "Authentication setup completed"
}

# =============================================================================
# Step 7: Verify Installation
# =============================================================================

verify_installation() {
    log_info "Verifying installation..."

    cd "$REFLY_DIR/packages/cli"

    # Check CLI status
    node dist/bin/refly.js status

    # Check whoami
    node dist/bin/refly.js whoami

    log_success "Installation verified"

    echo ""
    echo "=============================================="
    echo "  Refly CLI Deployment Complete!"
    echo "=============================================="
    echo ""
    echo "CLI Location: $REFLY_DIR/packages/cli"
    echo "API Server:   http://localhost:$API_PORT"
    echo ""
    echo "To use the CLI, run:"
    echo "  cd $REFLY_DIR/packages/cli"
    echo "  node dist/bin/refly.js <command>"
    echo ""
    echo "Or link it globally with:"
    echo "  cd $REFLY_DIR/packages/cli && pnpm link --global"
    echo "  refly <command>"
    echo ""
}

# =============================================================================
# Cleanup Function
# =============================================================================

cleanup() {
    log_info "Cleaning up..."

    if [ -f /tmp/refly-api.pid ]; then
        API_PID=$(cat /tmp/refly-api.pid)
        if ps -p "$API_PID" > /dev/null 2>&1; then
            kill "$API_PID" 2>/dev/null || true
        fi
        rm /tmp/refly-api.pid
    fi
}

# =============================================================================
# Main Entry Point
# =============================================================================

main() {
    echo ""
    echo "=============================================="
    echo "  Refly CLI One-Click Deployment"
    echo "=============================================="
    echo ""

    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --skip-clone)
                SKIP_CLONE=true
                shift
                ;;
            --skip-build)
                SKIP_BUILD=true
                shift
                ;;
            --skip-services)
                SKIP_SERVICES=true
                shift
                ;;
            --skip-seed)
                SKIP_SEED=true
                shift
                ;;
            --skip-auth)
                SKIP_AUTH=true
                shift
                ;;
            --refly-dir)
                REFLY_DIR="$2"
                shift 2
                ;;
            --branch)
                REFLY_BRANCH="$2"
                shift 2
                ;;
            --help)
                echo "Usage: $0 [options]"
                echo ""
                echo "Options:"
                echo "  --skip-clone      Skip repository clone/update"
                echo "  --skip-build      Skip dependency installation and build"
                echo "  --skip-services   Skip starting services"
                echo "  --skip-seed       Skip seeding tool data"
                echo "  --skip-auth       Skip authentication setup"
                echo "  --refly-dir DIR   Set refly directory (default: ~/refly)"
                echo "  --branch BRANCH   Set git branch (default: feat/cli/init)"
                echo "  --help            Show this help message"
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                exit 1
                ;;
        esac
    done

    # Set up trap for cleanup
    trap cleanup EXIT

    # Run steps
    check_prerequisites

    if [ "${SKIP_CLONE:-false}" != "true" ]; then
        setup_repository
    fi

    if [ "${SKIP_BUILD:-false}" != "true" ]; then
        install_and_build
    fi

    if [ "${SKIP_SERVICES:-false}" != "true" ]; then
        start_services
    fi

    if [ "${SKIP_SEED:-false}" != "true" ]; then
        seed_tool_data
    fi

    if [ "${SKIP_AUTH:-false}" != "true" ]; then
        setup_authentication
    fi

    verify_installation
}

# Run main function with all arguments
main "$@"
