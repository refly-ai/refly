# Refly 项目启动指南

## 代码修复

我已经修复了 `mineru.parser.ts` 文件中的 TypeScript 类型错误。主要修复内容：

1. **Buffer.from 方法类型错误**：修复了 `Buffer.from` 方法中参数类型不匹配的问题
2. **parse 方法参数类型错误**：确保输入参数正确处理为 Buffer 类型

修复后的代码现在应该没有 TypeScript 编译错误。

## 项目启动方法

### 前置要求

确保你的系统满足以下最低要求：
- **CPU**: >= 1 核心
- **内存**: >= 2GB
- **Node.js**: v20.19.0 或更高版本
- **Docker**: 20.10.0 或更高版本
- **pnpm**: 9.15.9 或更高版本

### 1. 安装依赖

```bash
# 启用 corepack
corepack enable

# 安装项目依赖
pnpm install
```

### 2. 启动中间件服务

```bash
# 启动所有必需的中间件服务（数据库、Redis、MinIO等）
docker compose -f deploy/docker/docker-compose.middleware.yml -p refly up -d

# 检查服务状态
docker ps | grep refly_
```

确保所有容器都处于健康状态。如果有不健康的容器，请检查容器日志并解决问题。

### 3. 设置环境变量

```bash
# 从根目录复制开发环境配置
pnpm copy-env:develop
```

### 4. 构建项目

```bash
# 首次构建所有包
pnpm build
```

### 5. 启动开发服务器

#### 方式一：从根目录启动（推荐）

```bash
# 启动所有服务（API + Web）
pnpm dev
```

#### 方式二：分别启动各个服务

```bash
# 终端1：启动 Web 前端
cd apps/web && pnpm dev

# 终端2：启动 API 后端
cd apps/api && pnpm dev
```

### 6. 访问应用

启动成功后，你可以访问：
- **Web 应用**: http://localhost:5173
- **API 文档**: http://localhost:3000/api/docs

## 开发模式

### 桌面应用开发

```bash
# 启动桌面应用开发模式
pnpm dev:electron
```

### 代码质量检查

```bash
# 代码格式化和检查
pnpm check:fix

# 运行测试
pnpm test
```

## 常见问题

### 1. 端口冲突
如果遇到端口冲突，请检查：
- 端口 3000 (API)
- 端口 5173 (Web)
- 端口 35432 (PostgreSQL)
- 端口 36379 (Redis)
- 端口 39000 (MinIO)

### 2. 数据库连接问题
确保 PostgreSQL 容器正常运行：
```bash
docker logs refly_db
```

### 3. 依赖安装问题
如果遇到依赖安装问题，尝试：
```bash
# 清理缓存
pnpm store prune

# 重新安装
rm -rf node_modules
pnpm install
```

## 项目结构

```
refly-cjc/
├── apps/
│   ├── api/          # 后端 API 服务
│   ├── web/          # 前端 Web 应用
│   ├── desktop/      # 桌面应用
│   └── extension/    # 浏览器扩展
├── packages/         # 共享包
├── deploy/           # 部署配置
└── docs/            # 文档
```

## 技术栈

- **后端**: NestJS + TypeScript + Prisma
- **前端**: React + TypeScript + Vite
- **数据库**: PostgreSQL + Redis
- **存储**: MinIO
- **向量数据库**: Qdrant
- **搜索**: SearXNG

## 更多信息

- [官方文档](https://docs.refly.ai/)
- [贡献指南](./CONTRIBUTING.md)
- [GitHub Issues](https://github.com/refly-ai/refly/issues)
- [Discord 社区](https://discord.gg/bWjffrb89h) 