# 私有部署

## 前置要求 {#prerequisites}

### 硬件要求 {#hardware-requirements}

- **CPU:** 至少 2 核
- **内存:** 至少 4GB (建议 8GB)
- **存储:** 20GB+ 可用空间

### 软件要求 {#software-requirements}

- **Docker:** 版本 24.0+
- **Docker Compose:** 版本 2.20+

## 部署步骤 {#steps}

### 1. 克隆代码仓库 {#clone-the-repository}

```bash
git clone https://github.com/refly-ai/refly.git
cd refly
```

::: tip
您可以在 `clone` 命令中添加 `--depth 1` 参数来节省磁盘空间和下载时间。
:::

### 2. 通过 `.env` 文件准备配置 {#prepare-the-configuration-via-env-file}

```bash
cd deploy/docker
cp env.example .env
```

使用所需设置编辑 `.env`。

#### 2.1. 添加 Resend API Key (可选) {#add-resend-api-key-optional}

如果您需要发送邮件，请从 https://resend.com/ 获取您自己的 Key 并填入 `.env`：

```
RESEND_API_KEY=your_resend_api_key
```

#### 2.2. 添加 Fal API Key (可选) {#add-fal-api-key-optional}

如果您需要生成图像/音频/视频，请从 https://fal.ai/ 获取您自己的 Key 并填入 `.env`：

```
TOOLSET_FAL_API_KEY=your_fal_api_key
```

#### 2.3. FAQ：通过 IP 地址访问 {#faq-ip-access-section}

如果您在云服务器上部署并通过 IP 地址访问，请参考[FAQ：通过 IP 地址访问](./faq-ip-access.md)来设置环境变量。

### 3. 通过 docker compose 启动应用 {#start-the-application-via-docker-compose}

```bash
docker compose up -d
```

您可以运行 `docker ps` 来检查容器的状态。每个容器的预期状态应该是 `Up` 和 `healthy`。以下是示例输出：

```bash
CONTAINER ID   IMAGE                                      COMMAND                  STATUS                 PORTS                          NAMES
71681217973e   reflyai/refly-api:latest                   "docker-entrypoint.s…"   Up 5 hours (healthy)   3000/tcp, 5800-5801/tcp        refly_api
462d7e1181ca   reflyai/qdrant:v1.13.1                     "./entrypoint.sh"        Up 5 hours (healthy)   6333-6334/tcp                  refly_qdrant
fd287fa0a04e   redis/redis-stack:6.2.6-v18                "/entrypoint.sh"         Up 5 hours (healthy)   6379/tcp, 8001/tcp             refly_redis
16321d38fc34   reflyai/refly-web:latest                   "/docker-entrypoint.…"   Up 5 hours             0.0.0.0:5700->80/tcp           refly_web
d3809f344fed   searxng/searxng:latest                     "/usr/local/searxng/…"   Up 5 hours (healthy)   8080/tcp                       refly_searxng
a13f349fe35b   minio/minio:RELEASE.2025-01-20T14-49-07Z   "/usr/bin/docker-ent…"   Up 5 hours (healthy)   9000-9001/tcp                  refly_minio
e7b398dbd02b   postgres:16-alpine                         "docker-entrypoint.s…"   Up 5 hours (healthy)   5432/tcp                       refly_db
```

您可以通过 `http://localhost:5700` 访问 Refly 应用程序。


## 开始使用 Refly {#start-using-refly}

要开始使用私有部署版的 Refly，请先使用您的邮箱和密码注册一个账户。

![注册](/images/register.webp)

进入后，您可以配置您想要使用的提供商和模型。点击右上角的账户图标并选择 `Settings`。

![设置](/images/settings-new.webp)

添加您的第一个提供商：

![添加提供商](/images/add-provider-1.webp)

![添加提供商弹窗](/images/add-provider-2.webp)

添加您的第一个对话模型：

![添加模型](/images/add-model-1.webp)

![添加模型弹窗](/images/add-model-2.webp)

配置您的默认模型：

![配置默认模型](/images/default-model-config.webp)

祝您聊得愉快！

![开始对话](/images/start-chat-new.webp)

## 故障排除 {#troubleshooting}

如果应用程序无法正常运行，您可以尝试以下步骤：

1. 检查端口 `5700` 是否已被占用。如果是，您可以在 `docker-compose.yml` 文件中更改端口。
2. 运行 `docker ps --filter name=refly_ | grep -v 'healthy'` 来识别 **不健康** 的容器（状态不处于 `healthy`）。
3. 运行 `docker logs <container_id>` 来获取更多关于不健康容器的信息。
4. 如果不健康的容器是 `refly_api`，您可以首先尝试运行 `docker restart refly_api` 来重启容器。
5. 对于其他问题，您可以在容器日志中搜索错误消息的原因。

如果问题仍然存在，您可以在我们的 [GitHub 仓库](https://github.com/refly-ai/refly/issues)中提交 Issue。
