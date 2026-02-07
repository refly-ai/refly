module.exports = {
  apps: [
    {
      // Wrapper bridges real API state to PM2:
      //   child sends "ready" → wrapper forwards to PM2 → status becomes online
      //   child crashes/exits → wrapper exits with same code → status becomes errored
      //   source file changes → PM2 watch restarts wrapper → wrapper re-spawns child
      name: 'refly-api',
      script: 'scripts/pm2-api-wrapper.js', // Use wrapper for state bridging instead of running ts-node/nodemon directly
      cwd: '.',
      interpreter: 'node',
      autorestart: false, // Do not auto-restart on crash; shows "errored" for debugging. Run `pm2 restart refly-api` after fixing.
      max_restarts: 1, // Required with min_uptime to correctly detect startup failures (startup failures don't count toward autorestart)
      watch: [ // Watch source files; any change restarts the wrapper (which re-spawns the child process)
        'apps/api/src',
        'packages/agent-tools',
        'packages/canvas-common',
        'packages/common-types',
        'packages/errors',
        'packages/openapi-schema',
        'packages/providers',
        'packages/skill-template',
        'packages/utils',
      ],
      ignore_watch: ['node_modules', 'logs', '**/*.spec.ts', '**/*.test.ts', 'dist'],
      watch_options: { followSymlinks: false, usePolling: false },
      wait_ready: true, // Only mark online after receiving "ready" from child; prevents a false online→crash flash
      listen_timeout: 18000, // Max wait for "ready" message (18s); if exceeded, PM2 marks process as errored and kills it — prevents getting stuck in "launching"
      min_uptime: '8760h', // Any exit within 365 days is treated as unstable, ensuring crashes show as "errored" not "online"
      max_memory_restart: '2G',
      env: {
        NODE_ENV: 'development',
      },
      error_file: './logs/api-error.log',
      out_file: './logs/api-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      time: true,
    },
    {
      name: 'refly-web',
      script: 'pnpm',     // Run the frontend dev server directly
      args: '-F web dev', // Equivalent to: pnpm --filter web dev
      interpreter: 'none',
      autorestart: false, // Do not auto-restart on crash; shows "errored" for debugging
      max_restarts: 0,    // Show error state immediately on failure without any retries
      watch: false,
      max_memory_restart: '2G',
      min_uptime: '10s',  // Treat as startup failure if process exits within 10 seconds
      env: {
        NODE_ENV: 'development',
      },
      error_file: './logs/web-error.log',
      out_file: './logs/web-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      time: true,
    },
  ],
};
