#!/bin/bash
#
# Refly CLI Quick Start Script
#
# This is a simplified version for users who already have the codebase.
# It focuses on:
# 1. Building the CLI
# 2. Starting services
# 3. Seeding data
# 4. Setting up authentication
#

set -e

# =============================================================================
# Configuration
# =============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# =============================================================================
# Helper Functions
# =============================================================================

log_step() {
    echo ""
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${CYAN}  $1${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
}

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[OK]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

wait_for_service() {
    local name=$1
    local url=$2
    local max_attempts=${3:-60}
    local attempt=0

    log_info "Waiting for $name to be ready..."
    while ! curl -s "$url" > /dev/null 2>&1; do
        attempt=$((attempt + 1))
        if [ $attempt -ge $max_attempts ]; then
            log_error "Timeout waiting for $name"
            return 1
        fi
        printf "."
        sleep 1
    done
    echo ""
    log_success "$name is ready"
}

# =============================================================================
# Step 1: Check Prerequisites
# =============================================================================

check_prerequisites() {
    log_step "Step 1: Checking prerequisites"

    local missing=()

    command -v node >/dev/null 2>&1 || missing+=("node")
    command -v pnpm >/dev/null 2>&1 || missing+=("pnpm")
    command -v docker >/dev/null 2>&1 || missing+=("docker")

    if [ ${#missing[@]} -gt 0 ]; then
        log_error "Missing required tools: ${missing[*]}"
        echo ""
        echo "Please install the missing tools and try again."
        exit 1
    fi

    # Check Node version
    NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
    if [ "$NODE_VERSION" -lt 20 ]; then
        log_error "Node.js 20+ required (current: $(node -v))"
        exit 1
    fi

    # Check Docker
    if ! docker info >/dev/null 2>&1; then
        log_error "Docker is not running"
        exit 1
    fi

    log_success "All prerequisites met"
}

# =============================================================================
# Step 2: Install Dependencies & Build
# =============================================================================

build_cli() {
    log_step "Step 2: Building CLI"

    cd "$PROJECT_ROOT"

    # Install dependencies if needed
    if [ ! -d "node_modules" ]; then
        log_info "Installing dependencies..."
        pnpm install
    fi

    # Build CLI
    log_info "Building CLI package..."
    cd packages/cli
    pnpm build

    log_success "CLI built successfully"
}

# =============================================================================
# Step 3: Start Services
# =============================================================================

start_services() {
    log_step "Step 3: Starting services"

    cd "$PROJECT_ROOT"

    # Start Docker services
    log_info "Starting Docker containers..."
    if [ -f "deploy/docker/docker-compose.dev.yml" ]; then
        docker-compose -f deploy/docker/docker-compose.dev.yml up -d
    elif [ -f "docker-compose.yml" ]; then
        docker-compose up -d
    else
        log_warning "No docker-compose file found. Assuming services are running."
    fi

    # Wait for database
    sleep 3

    # Setup API environment
    cd apps/api
    if [ ! -f ".env" ]; then
        log_info "Setting up API environment..."
        cp .env.development .env
    fi

    # Run migrations
    log_info "Running database migrations..."
    pnpm prisma db push 2>/dev/null || pnpm prisma migrate deploy 2>/dev/null || true

    # Generate Prisma client
    pnpm prisma generate

    log_success "Services started"
}

# =============================================================================
# Step 4: Seed Tool Data
# =============================================================================

seed_data() {
    log_step "Step 4: Seeding tool data"

    cd "$PROJECT_ROOT"

    # Check if seed script exists
    if [ -f "$SCRIPT_DIR/seed-tools.mjs" ]; then
        log_info "Running seed script..."

        # Need to run from a location with Prisma client
        cd apps/api
        node "$SCRIPT_DIR/seed-tools.mjs"

        log_success "Tool data seeded"
    else
        log_warning "Seed script not found at $SCRIPT_DIR/seed-tools.mjs"
    fi
}

# =============================================================================
# Step 5: Start API Server
# =============================================================================

start_api() {
    log_step "Step 5: Starting API server"

    cd "$PROJECT_ROOT/apps/api"

    # Check if API is already running
    if curl -s http://localhost:5800/health > /dev/null 2>&1; then
        log_success "API is already running"
        return
    fi

    log_info "Starting API server in background..."
    pnpm dev > /tmp/refly-api.log 2>&1 &
    API_PID=$!
    echo "$API_PID" > /tmp/refly-api.pid

    # Wait for API to be ready
    wait_for_service "API" "http://localhost:5800/health" 120

    log_success "API server started (PID: $API_PID)"
}

# =============================================================================
# Step 6: Login & Generate API Key
# =============================================================================

setup_auth() {
    log_step "Step 6: Setting up authentication"

    cd "$PROJECT_ROOT/packages/cli"

    # Check if already logged in
    if node dist/bin/refly.js status 2>/dev/null | grep -q "authenticated"; then
        log_success "Already authenticated"
    else
        echo ""
        echo -e "${YELLOW}Please complete the OAuth login in your browser.${NC}"
        echo ""

        # Start login
        node dist/bin/refly.js login --host http://localhost:5800
    fi

    # Generate API key
    if [ -f "$SCRIPT_DIR/generate-apikey.mjs" ]; then
        log_info "Generating API key..."
        cd "$PROJECT_ROOT/apps/api"
        node "$SCRIPT_DIR/generate-apikey.mjs" 2>/dev/null || true
    fi

    log_success "Authentication setup completed"
}

# =============================================================================
# Step 7: Verify & Summary
# =============================================================================

show_summary() {
    log_step "Setup Complete!"

    cd "$PROJECT_ROOT/packages/cli"

    echo ""
    echo -e "${GREEN}┌─────────────────────────────────────────────────────────────┐${NC}"
    echo -e "${GREEN}│                  Refly CLI Ready!                           │${NC}"
    echo -e "${GREEN}└─────────────────────────────────────────────────────────────┘${NC}"
    echo ""
    echo "  CLI Location:   $PROJECT_ROOT/packages/cli"
    echo "  API Server:     http://localhost:5800"
    echo "  Web App:        http://localhost:5700"
    echo ""
    echo "  To use the CLI:"
    echo ""
    echo "    cd $PROJECT_ROOT/packages/cli"
    echo "    node dist/bin/refly.js <command>"
    echo ""
    echo "  Available commands:"
    echo ""
    echo "    refly status           # Check authentication status"
    echo "    refly whoami           # Show current user"
    echo "    refly workflow list    # List workflows"
    echo "    refly builder start    # Start workflow builder"
    echo ""
    echo "  To stop the API server:"
    echo ""
    echo "    kill \$(cat /tmp/refly-api.pid)"
    echo ""

    # Show status
    echo -e "${CYAN}Current Status:${NC}"
    echo ""
    node dist/bin/refly.js status 2>/dev/null || true
}

# =============================================================================
# Main
# =============================================================================

main() {
    echo ""
    echo -e "${CYAN}╔═══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║          Refly CLI Quick Start                                ║${NC}"
    echo -e "${CYAN}╚═══════════════════════════════════════════════════════════════╝${NC}"
    echo ""

    # Parse arguments
    SKIP_BUILD=false
    SKIP_SERVICES=false
    SKIP_SEED=false
    SKIP_API=false
    SKIP_AUTH=false

    while [[ $# -gt 0 ]]; do
        case $1 in
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
            --skip-api)
                SKIP_API=true
                shift
                ;;
            --skip-auth)
                SKIP_AUTH=true
                shift
                ;;
            --help|-h)
                echo "Usage: $0 [options]"
                echo ""
                echo "Options:"
                echo "  --skip-build     Skip building CLI"
                echo "  --skip-services  Skip starting Docker services"
                echo "  --skip-seed      Skip seeding tool data"
                echo "  --skip-api       Skip starting API server"
                echo "  --skip-auth      Skip authentication setup"
                echo "  -h, --help       Show this help message"
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                exit 1
                ;;
        esac
    done

    check_prerequisites

    if [ "$SKIP_BUILD" != "true" ]; then
        build_cli
    fi

    if [ "$SKIP_SERVICES" != "true" ]; then
        start_services
    fi

    if [ "$SKIP_SEED" != "true" ]; then
        seed_data
    fi

    if [ "$SKIP_API" != "true" ]; then
        start_api
    fi

    if [ "$SKIP_AUTH" != "true" ]; then
        setup_auth
    fi

    show_summary
}

main "$@"
