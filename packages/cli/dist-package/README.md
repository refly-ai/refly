# Refly CLI (Test Distribution)

Pre-configured CLI for testing with backend at `http://10.231.61.34:5800`

## Quick Install (One Command!)

```bash
# 1. Extract the package
tar -xzf refly-cli.tar.gz
cd refly-cli

# 2. Install dependencies
npm install

# 3. Initialize with auto-generated API key (no login required!)
node dist/bin/refly.js init --email your-email@example.com

# 4. Check status
node dist/bin/refly.js status
```

## Traditional Install (with OAuth login)

```bash
# 1. Extract and install
tar -xzf refly-cli.tar.gz && cd refly-cli && npm install

# 2. Initialize (will auto-configure backend)
node dist/bin/refly.js init

# 3. Login via OAuth
node dist/bin/refly.js login

# 4. Check status
node dist/bin/refly.js status
```

## Global Installation (Optional)

```bash
npm install -g .
refly init --email your-email@example.com  # One-step auth
# or
refly init && refly login                   # Traditional auth
```

## Available Commands

```bash
# Authentication
refly init                        # Initialize CLI (sets backend to 10.231.61.34:5800)
refly init --email <email>        # Initialize + auto-generate API key (dev mode)
refly login                       # Authenticate with OAuth
refly logout                      # Clear authentication
refly status                      # Check authentication status
refly whoami                      # Show current user

# Workflow Builder
refly builder start     # Start building a workflow
refly builder add-node  # Add a node
refly builder connect   # Connect nodes
refly builder validate  # Validate the workflow
refly builder commit    # Create the workflow

# Workflow Management
refly workflow list     # List all workflows
refly workflow run      # Run a workflow
refly workflow get      # Get workflow details
```

## Configuration

The CLI stores configuration in `~/.refly/config.json`.

Default backend: `http://10.231.61.34:5800`

To use a different backend:
```bash
refly init --host http://your-backend:5800
# or
export REFLY_API_ENDPOINT=http://your-backend:5800
```

## Troubleshooting

### Connection refused
Make sure the backend server is running at `http://10.231.61.34:5800`

### OAuth login issues
1. Check that the backend is accessible
2. Try device flow: `refly login --device`

### Permission denied
```bash
chmod +x dist/bin/refly.js
```
