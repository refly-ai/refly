# 私有部署

## 前置要求 {#prerequisites}

要自行部署 Refly，您需要安装以下软件：

- Docker (版本 20.10.0 或更高)
- *可选*: PostgreSQL 客户端（可以是 `psql` 或基于 GUI 的工具），用于管理可用的 LLM 模型

::: info
我们计划在未来提供功能完善的原生应用程序，以隐私为重点提供无缝的安装体验。敬请期待！
:::

## 部署步骤 {#steps}

### 1. 克隆代码仓库 {#clone-the-repository}

```bash
git clone https://github.com/refly-ai/refly.git
```

::: tip
如果您只需要使用 Docker 部署，可以在 `clone` 命令中添加 `--depth 1` 参数来节省磁盘空间和下载时间。
:::

### 2. 准备环境配置 {#prepare-the-environment-configuration}

```bash
cd refly/deploy/docker
cp ../../apps/api/.env.example .env
```

::: info
所有环境变量的详细描述可以在[配置指南](./configuration.md)中查看。
:::

### 3. 通过 docker compose 启动应用 {#start-the-application-via-docker-compose}

```bash
docker compose up -d
```

::: tip 对于热情的用户
默认情况下，docker compose 文件会拉取 `latest` 镜像，这是最新的稳定版本。如果您想使用与 Refly Cloud 同步的最新开发版本，可以在 `docker-compose.yml` 文件中将镜像标签 `latest` 替换为 `nightly`。
:::

您可以运行 `docker ps` 来检查容器的状态。每个容器的预期状态应该是 `Up` 和 `healthy`。以下是示例输出：

```bash
CONTAINER ID   IMAGE                                      COMMAND                  CREATED       STATUS                 PORTS                                                                                    NAMES
71681217973e   reflyai/refly-api:latest                   "docker-entrypoint.s…"   5 hours ago   Up 5 hours (healthy)   3000/tcp, 0.0.0.0:5800-5801->5800-5801/tcp, :::5800-5801->5800-5801/tcp                  refly_api
462d7e1181ca   reflyai/qdrant:v1.13.1                     "./entrypoint.sh"        5 hours ago   Up 5 hours (healthy)   0.0.0.0:36333-6334->6333-6334/tcp, :::6333-6334->6333-6334/tcp                           refly_qdrant
fd287fa0a04e   redis/redis-stack:6.2.6-v18                "/entrypoint.sh"         5 hours ago   Up 5 hours (healthy)   0.0.0.0:6379->6379/tcp, :::36379->6379/tcp, 0.0.0.0:38001->8001/tcp, :::38001->8001/tcp  refly_redis
16321d38fc34   reflyai/refly-web:latest                   "/docker-entrypoint.…"   5 hours ago   Up 5 hours             0.0.0.0:5700->80/tcp, [::]:5700->80/tcp                                                  refly_web
d3809f344fed   searxng/searxng:latest                     "/usr/local/searxng/…"   5 hours ago   Up 5 hours (healthy)   0.0.0.0:38080->8080/tcp, [::]:38080->8080/tcp                                            refly_searxng
a13f349fe35b   minio/minio:RELEASE.2025-01-20T14-49-07Z   "/usr/bin/docker-ent…"   5 hours ago   Up 5 hours (healthy)   0.0.0.0:39000-39001->9000-9001/tcp, :::39000-39001->9000-9001/tcp                        refly_minio
e7b398dbd02b   postgres:16-alpine                         "docker-entrypoint.s…"   5 hours ago   Up 5 hours (healthy)   0.0.0.0:35432->5432/tcp, :::35432->5432/tcp  
```

### 在 Kubernetes 集群部署

直接使用部署文件

```bash
cd refly/deploy/kubernetes

kubectl apply -f refly-deployment.yaml
```

最后，您可以通过访问 `http://${HOST_IP}:5700` ( Kubernetes 集群部署访问 `http://${HOST_IP}:30001` ) 来使用 Refly 应用程序，其中 `${HOST_IP}` 是主机的 IP 地址。

::: info
如果无法访问 Refly 应用，请检查以下内容：

- `HOST_IP` 是否正确。
- 应用是否正常运行。如果未运行，请跳转到[故障排除](#troubleshooting)部分。
- 端口 `5700`(`30001`) 是否被任何应用程序防火墙阻止。如果您使用的是云服务器，请特别注意这一点。
:::

## 开始使用 Refly {#start-using-refly}

要开始使用自部署的 Refly，首先注册一个账户，使用您的电子邮件和密码。

![](/images/register-1.webp)

![](/images/register-2.webp)

进入后，您可以配置您想要使用的提供商和模型。点击左下角的账户图标并选择 `Settings`。

![](/images/settings.webp)

添加您的第一个提供商：

![](/images/settings-provider.webp)

![](/images/settings-provider-modal.webp)

添加您的第一个对话模型：

![](/images/add-model.webp)

![](/images/add-model-modal.webp)

配置嵌入和重排序模型：

![](/images/other-models.webp)

::: info
嵌入模型是知识库检索所必需的。重排序模型是可选的，可以用于重新排序搜索结果。
:::

现在，您可以开始对话了！

![](/images/start-chat.webp)

## 升级指南 {#upgrade-guide}

要升级到最新稳定版本，您可以拉取最新镜像并重启容器：

```bash
docker compose pull
docker compose down
docker compose up -d --remove-orphans
```

如果遇到任何问题，请参阅[故障排除](#troubleshooting)部分。

## 故障排除 {#troubleshooting}

如果应用程序无法正常运行，您可以尝试以下步骤：

1. 运行 `docker ps --filter name=refly_ | grep -v 'healthy'` 来识别 **不健康** 的容器（状态不处于 `healthy`）。
2. 运行 `docker logs <container_id>` 来获取更多关于不健康容器的错误信息。
3. 如果不健康的容器是 `refly_api`，您可以首先尝试运行 `docker restart refly_api` 来重启容器。
4. 对于其他容器，您可以在容器日志中搜索错误消息的原因。

如果问题仍然存在，您可以在我们的 [GitHub 仓库](https://github.com/refly-ai/refly/issues)提出问题，或在我们的 [Discord 服务器](https://discord.gg/YVuYFjFvRC)中联系我们。