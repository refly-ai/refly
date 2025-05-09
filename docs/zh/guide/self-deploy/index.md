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

环境变量说明：

- **LLM 推理相关环境变量**：
  - `OPENAI_API_KEY`：您的 OpenAI API 密钥
  - `OPENAI_BASE_URL`: 其他 OpenAI 兼容提供商的根 URL
  - `OPENROUTER_API_KEY`：您的 OpenRouter API 密钥（如果提供，将覆盖官方 OpenAI 端点）
- **向量嵌入相关环境变量**：
  - `EMBEDDINGS_PROVIDER`：向量嵌入提供商，目前支持 `openai`、`jina` 和 `fireworks`
  - `EMBEDDINGS_MODEL_NAME`：向量嵌入模型名称，不同提供商可能不同
  - `OPENAI_API_KEY`：如果 `EMBEDDINGS_PROVIDER` 为 `openai` 则必需
  - `JINA_API_KEY`：如果 `EMBEDDINGS_PROVIDER` 为 `jina` 则必需
  - `FIREWORKS_API_KEY`：如果 `EMBEDDINGS_PROVIDER` 为 `fireworks` 则必需
- **网络搜索相关环境变量**：
  - `SERPER_API_KEY`：[Serper](https://serper.dev/) API 密钥

::: info
所有配置选项的完整列表可以在[配置指南](../configuration.md)中找到。
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
CONTAINER ID   IMAGE                                      COMMAND                  CREATED       STATUS                 PORTS                                                                                  NAMES
71681217973e   reflyai/refly-api:latest                   "docker-entrypoint.s…"   5 hours ago   Up 5 hours (healthy)   3000/tcp, 0.0.0.0:5800-5801->5800-5801/tcp, :::5800-5801->5800-5801/tcp                refly_api
462d7e1181ca   reflyai/qdrant:v1.13.1                     "./entrypoint.sh"        5 hours ago   Up 5 hours (healthy)   0.0.0.0:6333-6334->6333-6334/tcp, :::6333-6334->6333-6334/tcp                          refly_qdrant
fd287fa0a04e   redis/redis-stack:6.2.6-v18                "/entrypoint.sh"         5 hours ago   Up 5 hours (healthy)   0.0.0.0:6379->6379/tcp, :::6379->6379/tcp, 0.0.0.0:8001->8001/tcp, :::8001->8001/tcp   refly_redis
16321d38fc34   reflyai/refly-web:latest                   "/docker-entrypoint.…"   5 hours ago   Up 5 hours             0.0.0.0:5700->80/tcp, [::]:5700->80/tcp                                                refly_web
2e14ec2e55a2   reflyai/elasticsearch:7.10.2               "/tini -- /usr/local…"   5 hours ago   Up 5 hours (healthy)   0.0.0.0:9200->9200/tcp, :::9200->9200/tcp, 9300/tcp                                    refly_elasticsearch
a13f349fe35b   minio/minio:RELEASE.2025-01-20T14-49-07Z   "/usr/bin/docker-ent…"   5 hours ago   Up 5 hours (healthy)   0.0.0.0:9000-9001->9000-9001/tcp, :::9000-9001->9000-9001/tcp                          refly_minio
e7b398dbd02b   postgres:16-alpine                         "docker-entrypoint.s…"   5 hours ago   Up 5 hours (healthy)   0.0.0.0:5432->5432/tcp, :::5432->5432/tcp                                              refly_db
```

最后，您可以通过访问 `http://${HOST_IP}:5700` 来使用 Refly 应用程序，其中 `${HOST_IP}` 是主机的 IP 地址。

::: info
如果无法访问 Refly 应用，请检查以下内容：

- `HOST_IP` 是否正确。
- 应用是否正常运行。如果未运行，请跳转到[故障排除](#troubleshooting)部分。
- 端口 `5700` 是否被任何应用程序防火墙阻止。如果您使用的是云服务器，请特别注意这一点。
:::

### 4. 初始化模型 {#initialize-models}

模型配置通过 `refly_db` PostgreSQL 数据库中的 `refly.model_infos` 表进行管理。我们为一些常见的提供商准备了推荐的模型 SQL 文件：

| 提供商 | `OPENAI_BASE_URL` | SQL 文件 |
| -------- | ----------------- | -------- |
| [OpenAI](https://platform.openai.com/) | (空) | [openai.sql](https://github.com/refly-ai/refly/blob/main/deploy/model-providers/openai.sql) |
| [OpenRouter](https://openrouter.ai/) | `https://openrouter.ai/api/v1` | [openrouter.sql](https://github.com/refly-ai/refly/blob/main/deploy/model-providers/openrouter.sql) |
| [DeepSeek](https://platform.deepseek.com/) | `https://api.deepseek.com` | [deepseek.sql](https://github.com/refly-ai/refly/blob/main/deploy/model-providers/deepseek.sql) |
| [Ollama](https://ollama.com/) | `http://host.docker.internal:11434/v1` | [ollama.sql](https://github.com/refly-ai/refly/blob/main/deploy/model-providers/ollama.sql) |

选择一个提供商并执行其 SQL 文件：

```bash
# 初始化推荐的 OpenAI 模型
curl https://raw.githubusercontent.com/refly-ai/refly/main/deploy/model-providers/openai.sql | docker exec -i refly_db psql -U refly -d refly
```

```bash
# 或者，初始化推荐的 OpenRouter 模型
curl https://raw.githubusercontent.com/refly-ai/refly/main/deploy/model-providers/openrouter.sql | docker exec -i refly_db psql -U refly -d refly
```

```bash
# 或者，初始化推荐的 DeepSeek 模型
curl https://raw.githubusercontent.com/refly-ai/refly/main/deploy/model-providers/deepseek.sql | docker exec -i refly_db psql -U refly -d refly
```

::: warning
Refly 目前仅支持一个模型提供商。如果决定切换到另一个提供商或遇到错误 `duplicate key value violates unique constraint "model_infos_name_key"`，您需要先清空 `refly.model_infos` 表：

```bash
docker exec -it refly_db psql -U refly -d refly -c "TRUNCATE TABLE refly.model_infos;"
```
:::

::: info
有关模型配置的详细说明，请参阅[配置指南](../configuration.md#model-configuration)。
:::

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

如果问题仍然存在，您可以在我们的 [GitHub 仓库](https://github.com/refly-ai/refly/issues)提出问题，或在我们的 [Discord 服务器](https://discord.gg/bWjffrb89h)中联系我们。 