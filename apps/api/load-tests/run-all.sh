#!/bin/bash

# Schedule Module Load Test Runner
#
# Usage:
#   ./run-all.sh              # Run all tests
#   ./run-all.sh smoke        # Run smoke test only
#   ./run-all.sh crud         # Run CRUD baseline test
#   ./run-all.sh trigger      # Run trigger stress test
#   ./run-all.sh concurrent   # Run concurrency limit test
#   ./run-all.sh ratelimit    # Run rate limit test
#   ./run-all.sh production   # Run production load test
#   ./run-all.sh quick        # Run quick tests (smoke + crud)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RESULTS_DIR="${SCRIPT_DIR}/results"

# Create results directory
mkdir -p "${RESULTS_DIR}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

info() { echo -e "${BLUE}[INFO]${NC} $1"; }
success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Check if k6 is installed
check_k6() {
    if ! command -v k6 &> /dev/null; then
        error "k6 is not installed. Please install it first:"
        echo ""
        echo "  macOS:    brew install k6"
        echo "  Linux:    sudo apt-get install k6"
        echo "  Windows:  winget install k6"
        echo "  Docker:   docker run --rm -i grafana/k6 run -"
        echo ""
        exit 1
    fi
    info "k6 version: $(k6 version)"
}

# Check required environment variables
check_env() {
    local missing=0

    if [ -z "${K6_API_BASE_URL}" ]; then
        warning "K6_API_BASE_URL not set, using default: http://localhost:5800"
        export K6_API_BASE_URL="http://localhost:5800"
    fi

    if [ -z "${K6_AUTH_TOKEN}" ]; then
        error "K6_AUTH_TOKEN is required"
        missing=1
    fi

    if [ -z "${K6_TEST_CANVAS_ID}" ]; then
        error "K6_TEST_CANVAS_ID is required"
        missing=1
    fi

    if [ $missing -eq 1 ]; then
        echo ""
        echo "Please set the required environment variables:"
        echo ""
        echo "  export K6_API_BASE_URL='http://localhost:5800'"
        echo "  export K6_AUTH_TOKEN='your-jwt-token'"
        echo "  export K6_TEST_CANVAS_ID='canvas_xxxxxx'"
        echo ""
        exit 1
    fi

    info "API Base URL: ${K6_API_BASE_URL}"
    info "Canvas ID: ${K6_TEST_CANVAS_ID}"
    info "Auth Token: ${K6_AUTH_TOKEN:0:20}..."
}

# Run a single test
run_test() {
    local test_name=$1
    local test_file=$2
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local output_file="${RESULTS_DIR}/${test_name}_${timestamp}.json"

    echo ""
    info "═══════════════════════════════════════════════════════════"
    info "  Running: ${test_name}"
    info "  File: ${test_file}"
    info "═══════════════════════════════════════════════════════════"
    echo ""

    if k6 run --out json="${output_file}" "${test_file}"; then
        success "${test_name} completed!"
        info "Results saved to: ${output_file}"
        return 0
    else
        error "${test_name} failed!"
        return 1
    fi
}

# Main function
main() {
    echo ""
    echo "╔═══════════════════════════════════════════════════════════╗"
    echo "║       Schedule Module Load Test Suite                     ║"
    echo "╚═══════════════════════════════════════════════════════════╝"
    echo ""

    check_k6
    check_env

    local test_type="${1:-all}"
    local start_time=$(date +%s)

    case "$test_type" in
        smoke)
            run_test "smoke-test" "${SCRIPT_DIR}/scenarios/smoke-test.js"
            ;;
        crud)
            run_test "schedule-crud" "${SCRIPT_DIR}/scenarios/schedule-crud.js"
            ;;
        trigger)
            run_test "schedule-trigger" "${SCRIPT_DIR}/scenarios/schedule-trigger.js"
            ;;
        concurrent)
            run_test "schedule-concurrent" "${SCRIPT_DIR}/scenarios/schedule-concurrent.js"
            ;;
        ratelimit)
            run_test "schedule-rate-limit" "${SCRIPT_DIR}/scenarios/schedule-rate-limit.js"
            ;;
        production)
            run_test "production-load-test" "${SCRIPT_DIR}/scenarios/production-load-test.js"
            ;;
        quick)
            run_test "smoke-test" "${SCRIPT_DIR}/scenarios/smoke-test.js"
            echo ""
            info "Cooling down for 10 seconds..."
            sleep 10
            run_test "schedule-crud" "${SCRIPT_DIR}/scenarios/schedule-crud.js"
            ;;
        all)
            info "Running all tests sequentially..."
            echo ""

            # Run all tests with cooling periods
            run_test "smoke-test" "${SCRIPT_DIR}/scenarios/smoke-test.js"

            echo ""
            info "Cooling down for 30 seconds..."
            sleep 30

            run_test "schedule-crud" "${SCRIPT_DIR}/scenarios/schedule-crud.js"

            echo ""
            info "Cooling down for 30 seconds..."
            sleep 30

            run_test "schedule-trigger" "${SCRIPT_DIR}/scenarios/schedule-trigger.js"

            echo ""
            info "Cooling down for 30 seconds..."
            sleep 30

            run_test "schedule-concurrent" "${SCRIPT_DIR}/scenarios/schedule-concurrent.js"

            echo ""
            info "Cooling down for 30 seconds..."
            sleep 30

            run_test "schedule-rate-limit" "${SCRIPT_DIR}/scenarios/schedule-rate-limit.js"

            echo ""
            info "Cooling down for 60 seconds before production test..."
            sleep 60

            run_test "production-load-test" "${SCRIPT_DIR}/scenarios/production-load-test.js"
            ;;
        *)
            error "Unknown test type: ${test_type}"
            echo ""
            echo "Usage: $0 [smoke|crud|trigger|concurrent|ratelimit|production|quick|all]"
            exit 1
            ;;
    esac

    local end_time=$(date +%s)
    local duration=$((end_time - start_time))

    echo ""
    echo "╔═══════════════════════════════════════════════════════════╗"
    echo "║                   Test Complete                           ║"
    echo "╚═══════════════════════════════════════════════════════════╝"
    echo ""
    success "Total duration: ${duration} seconds"
    info "Results saved in: ${RESULTS_DIR}"
    echo ""
}

main "$@"
