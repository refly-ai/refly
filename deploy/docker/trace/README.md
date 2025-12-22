# Trace Stack - Local Observability Infrastructure

Distributed tracing, metrics, and log aggregation stack for local development.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Refly API (tmux)                         │
│                                                                 │
│  OpenTelemetry SDK  →  Metrics + Traces                       │
│  stdout/stderr      →  Logs (via tmux pipe-pane)              │
└─────────────────────────────────────────────────────────────────┘
                              ↓
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
        ↓                     ↓                     ↓
┌───────────────┐    ┌───────────────┐    ┌───────────────┐
│ OTEL Collector│    │ OTEL Collector│    │     Alloy     │
│  (metrics)    │    │   (traces)    │    │  (log files)  │
└───────────────┘    └───────────────┘    └───────────────┘
        │                     │                     │
        ↓                     ↓                     ↓
┌───────────────┐    ┌───────────────┐    ┌───────────────┐
│  Prometheus   │    │     Tempo     │    │     Loki      │
│  (port 39090) │    │  (port 33200) │    │  (port 33100) │
└───────────────┘    └───────────────┘    └───────────────┘
        │                     │                     │
        └─────────────────────┼─────────────────────┘
                              ↓
                      ┌───────────────┐
                      │    Grafana    │
                      │  (port 33000) │
                      └───────────────┘
```

## Components

| Service | Image | Port | Purpose |
|---------|-------|------|---------|
| **Grafana** | grafana/grafana:12.3.0 | 33000 | Visualization and exploration |
| **Prometheus** | prom/prometheus:v2.48.0 | 39090 | Metrics storage and query |
| **Tempo** | grafana/tempo:2.3.0 | 33200 | Distributed tracing |
| **Loki** | grafana/loki:2.9.0 | 33100 | Log aggregation |
| **OTEL Collector** | otel/opentelemetry-collector-contrib:0.91.0 | 34318 | OTLP receiver and exporter |
| **Alloy** | grafana/alloy:v1.5.1 | 12345 | Log collection from files |

## Quick Start

### 1. Start the trace stack

```bash
cd deploy/docker/trace
docker-compose up -d
```

### 2. Enable log collection (one-time setup)

Configure tmux to pipe refly-api logs to a file:

```bash
# Create log directory
mkdir -p /tmp/alloy/logs/refly

# Enable tmux pipe-pane (appends to file)
tmux pipe-pane -o -t refly-api "cat >> /tmp/alloy/logs/refly/api.log"

# Verify pipe-pane is active
tmux display-message -p -t refly-api '#{session_name} (pipe-pane #{?#{pane_pipe},active,inactive})'
# Expected: "refly-api (pipe-pane active)"
```

**Note**: This configuration persists across tmux sessions. You only need to run this once per refly-api session.

### 3. Verify data flow

Wait 10-15 seconds for initial data collection, then check:

```bash
# Check Prometheus metrics
curl -s http://localhost:39090/api/v1/label/__name__/values | jq '.data[:5]'

# Check Tempo traces
curl -s http://localhost:33200/api/search | jq '.traces[:3]'

# Check Loki logs
curl -s http://localhost:33100/loki/api/v1/label | jq '.data'
```

### 4. Access Grafana

Open http://localhost:33000 in your browser.

**Default credentials**:
- Username: `admin`
- Password: `admin`

Or use anonymous access (enabled by default with Admin role).

## Data Collection

### Metrics (via OpenTelemetry)

The refly-api automatically exports metrics via OTLP:

- **Endpoint**: http://localhost:34318/v1/metrics
- **Interval**: 60 seconds
- **Storage**: Prometheus (30 days retention)

**Available metrics**:
- `db.query.duration{operation, model}` - Database query latency
- `db.slow_query.count{operation, model}` - Slow query counter (>100ms)
- `db.query.count{operation, model}` - Total query counter
- `http_server_duration{http_route, http_method}` - HTTP request duration
- `process_cpu_seconds_total` - CPU usage
- `process_resident_memory_bytes` - Memory usage

### Traces (via OpenTelemetry)

Distributed traces are automatically collected:

- **Endpoint**: http://localhost:34318/v1/traces
- **Storage**: Tempo (7 days retention)

### Logs (via Alloy)

Alloy collects logs from the refly-api tmux session:

**Prerequisites**:
1. **Log directory**: `/tmp/alloy/logs/refly/` must exist
2. **Tmux pipe-pane**: Must be enabled for `refly-api` session
3. **Alloy container**: Must be running

**Data flow**:
```
refly-api stdout → tmux pipe-pane → /tmp/alloy/logs/refly/api.log
                                            ↓
                                    Alloy container
                                  (mounts /tmp/alloy/logs)
                                            ↓
                                     Parses Pino JSON
                                     Extracts level label
                                            ↓
                                     Loki (7 days retention)
```

**Log labels**:
- `job`: "refly-api" (fixed)
- `env`: "local" (fixed)
- `level`: trace/debug/info/warn/error/fatal (extracted from Pino JSON)
- `filename`: "/tmp/alloy/logs/refly/api.log" (auto)

## Querying in Grafana

### Metrics (Prometheus)

Navigate to **Explore** → Select **Prometheus** datasource:

```promql
# Database query rate by table
rate(db_query_count_total[5m])

# P99 query latency
histogram_quantile(0.99, rate(db_query_duration_bucket[5m]))

# HTTP request rate by route
rate(http_server_duration_count[1m])
```

### Traces (Tempo)

Navigate to **Explore** → Select **Tempo** datasource:

- Search by trace ID
- Filter by service name: "reflyd"
- View trace waterfall and span details

### Logs (Loki)

Navigate to **Explore** → Select **Loki** datasource:

```logql
# All API logs
{job="refly-api"}

# Error logs only
{job="refly-api", level="error"}

# Search by traceId (JSON parsing)
{job="refly-api"} | json | traceId="abc123..."

# Find slow queries
{job="refly-api"} | json | msg =~ "Slow query detected"

# Filter by status code
{job="refly-api"} | json | statusCode="404"
```

## Configuration Files

| File | Purpose |
|------|---------|
| `docker-compose.yml` | Container orchestration |
| `otel-collector-config.yaml` | OTLP receiver and exporters |
| `prometheus-config.yaml` | Prometheus scrape and storage config |
| `tempo-config.yaml` | Tempo trace storage config |
| `loki-config.yaml` | Loki log storage and retention |
| `alloy-local-config.alloy` | Alloy log collection pipeline |
| `grafana-datasources.yaml` | Pre-configured datasources |
| `dashboards/` | Provisioned Grafana dashboards |

## Troubleshooting

### No logs in Loki

**Check tmux pipe-pane**:
```bash
tmux display-message -p -t refly-api '#{pane_pipe}'
# Should output: 1
```

If inactive, re-enable:
```bash
tmux pipe-pane -o -t refly-api "cat >> /tmp/alloy/logs/refly/api.log"
```

**Check log file**:
```bash
tail -f /tmp/alloy/logs/refly/api.log
# Should show refly-api logs
```

**Check Alloy container**:
```bash
docker logs --tail 20 refly_alloy
# Look for "tail routine: started" and no errors
```

### No metrics in Prometheus

**Check OTLP endpoint**:
```bash
curl http://localhost:34318/health
# Should return healthy status
```

**Check Prometheus targets**:
Open http://localhost:39090/targets - OTEL Collector should be "UP"

**Check refly-api OTLP export**:
Look for OTLP export logs in refly-api output.

### No traces in Tempo

**Check Tempo health**:
```bash
curl http://localhost:33200/ready
# Should return 200 OK
```

**Check OTEL Collector logs**:
```bash
docker logs --tail 50 refly_otel_collector | grep -i trace
```

## Stopping and Cleanup

### Stop all containers

```bash
cd deploy/docker/trace
docker-compose down
```

### Remove volumes (deletes all data)

```bash
docker-compose down -v
```

### Disable tmux log collection

```bash
# Stop pipe-pane
tmux pipe-pane -o -t refly-api

# Remove log file
rm -rf /tmp/alloy/logs/refly
```

## Data Retention

| Component | Retention | Storage |
|-----------|-----------|---------|
| Prometheus | 30 days | Docker volume `prometheus_data` |
| Tempo | 7 days | Docker volume `tempo_data` |
| Loki | 7 days | Docker volume `loki_data` |
| Alloy | N/A | Docker volume `alloy_data` (position tracking) |

## Related Documentation

- **Task documentation**: `../../.task/LOCAL_LOGS_SETUP.md` - Detailed log collection setup
- **K8s deployment**: `/Users/zqxy123/Projects/refly-infra/kubernetes/test/observability/` - Production config
- **Alloy config**: https://grafana.com/docs/alloy/latest/
- **OTEL Collector**: https://opentelemetry.io/docs/collector/
- **Grafana**: https://grafana.com/docs/grafana/latest/

## Notes

- **Alloy requirement**: Runs as a Docker container, no local installation needed
- **Log format**: Expects Pino JSON logs (auto-detected)
- **Network**: All containers share `refly_trace_network` bridge network
- **Security**: Anonymous Grafana access enabled for local development only
