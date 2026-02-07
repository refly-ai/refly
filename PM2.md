# PM2 开发环境管理

## 安装 PM2

如果还没有安装 PM2，请先全局安装：

```bash
npm install -g pm2
```

## 快速开始

### 启动服务

```bash
pm2 start ecosystem.config.js
```

这会同时启动：

- `refly-api` - 后端服务（通过 wrapper 跑 API）
- `refly-web` - 前端服务 (pnpm -F web dev)

### 查看状态

```bash
pm2 status
```

### 查看日志

```bash
# 查看所有日志
pm2 logs

# 只查看 API 日志
pm2 logs refly-api

# 只查看 Web 日志
pm2 logs refly-web

# 查看最近 100 行日志
pm2 logs --lines 100

# 实时监控（CPU、内存等）
pm2 monit
```

### 重启 / 停止 / 删除

```bash
# 重启所有服务
pm2 restart ecosystem.config.js

# 重启单个服务（修好代码后若未自动起来可执行）
pm2 restart refly-api
pm2 restart refly-web

# 停止所有服务
pm2 stop ecosystem.config.js

# 删除进程
pm2 delete ecosystem.config.js
```

## API Wrapper 说明

`refly-api` 不直接运行 ts-node/nodemon，而是通过 `scripts/pm2-api-wrapper.js` 包装器启动。这是因为 PM2 的进程状态管理需要与子进程状态同步：

- **ready 信号桥接**：子进程启动成功后发送 `ready` 信号，wrapper 转发给 PM2，PM2 才将状态标记为 `online`（配合 `wait_ready: true`）。若直接运行 ts-node，PM2 无法感知应用是否真正就绪。
- **崩溃状态传递**：子进程崩溃/退出时，wrapper 以相同退出码退出，PM2 将状态标记为 `errored`。
- **文件监听重启**：源文件变更时，PM2 watch 重启 wrapper，wrapper 重新启动子进程。

`refly-web` 不需要 wrapper，因为它直接运行 `pnpm -F web dev`，进程生命周期即为服务生命周期。

## 日志文件

所有日志会保存在 `./logs/` 目录下：

- `api-error.log` / `api-out.log` - API 错误与输出
- `web-error.log` / `web-out.log` - Web 错误与输出
