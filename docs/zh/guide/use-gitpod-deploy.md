# Gitpod 部署

访问网址 https://github.com/refly-ai/refly, 找到 `Open in Gitpod` 图标，点击图标。
![部署到 Gitpod](/images/deploy-to-gitpod.webp)

如果是第一次，需要你用 GitHub 账号登录 Gitpod， 弹出如下界面。

![Gitpod new workspace](/images/gitpod-new-workspace.webp)


如果你 fork 该项目，并想保存你的修改，建议你点击 `refly` 的下拉框，换成你的项目地址。

点击 `Continue`。


根据个人喜欢选择主题， 下面的 `TERMINAL` 输出有部署日志。部署的配置在 `.gitpod.yml`  文件里。
```yaml
tasks:
  - name: Deploy Services
    init: cd deploy/docker && cp ../../apps/api/.env.example .env &&   docker compose up -d
```



![Gitpod deploy init](/images/docker-compose-up.webp)
部署时间大概需要几分钟。

部署成功了！
![Gitpod deploy success](/images/gitpod-deploy-success.webp)

你可以发现 Gitpod 实际提供了一个虚拟机，里面已经支持了 Docker compose 部署， refly 本身支持 Docker compose 部署，就无痛迁移到 Gitpod。

## 定制化部署
### 1. 环境变量说明

- **LLM 推理相关环境变量**：
  - `OPENAI_API_KEY`：您的 OpenAI API 密钥
  - `OPENAI_BASE_URL`: 其他 OpenAI 兼容提供商的根 URL
  - `OPENROUTER_API_KEY`：您的 OpenRouter API 密钥（如果提供，将覆盖官方 OpenAI 端点）
- **向量嵌入相关环境变量**：
  - `EMBEDDINGS_PROVIDER`：向量嵌入提供商，目前支持 `openai`、`jina` 和 `fireworks`。默认为`jina`，可以按照实际情况进行修改。
  - `EMBEDDINGS_MODEL_NAME`：向量嵌入模型名称，不同提供商可能不同
  - `OPENAI_API_KEY`：如果 `EMBEDDINGS_PROVIDER` 为 `openai` 则必需
  - `JINA_API_KEY`：如果 `EMBEDDINGS_PROVIDER` 为 `jina` 则必需
  - `FIREWORKS_API_KEY`：如果 `EMBEDDINGS_PROVIDER` 为 `fireworks` 则必需
- **网络搜索相关环境变量**：
  - `SERPER_API_KEY`：[Serper](https://serper.dev/) API 密钥

::: info
所有配置选项的完整列表可以在[配置指南](./configuration.md)中找到。
:::

修改完 `.env` 文件后，需要重启。
```shell
cd deploy/docker
docker compose restart
```

### 2. 初始化模型 {#initialize-models}

模型配置通过 `refly_db` PostgreSQL 数据库中的 `refly.model_infos` 表进行管理。我们为一些常见的提供商准备了推荐的模型 SQL 文件：

| 提供商 | `OPENAI_BASE_URL` | SQL 文件 |
| -------- | ----------------- | -------- |
| [OpenAI](https://platform.openai.com/) | (空) | [openai.sql](https://github.com/refly-ai/refly/blob/main/deploy/model-providers/openai.sql) |
| [OpenRouter](https://openrouter.ai/) | `https://openrouter.ai/api/v1` | [openrouter.sql](https://github.com/refly-ai/refly/blob/main/deploy/model-providers/openrouter.sql) |
| [DeepSeek](https://platform.deepseek.com/) | `https://api.deepseek.com` | [deepseek.sql](https://github.com/refly-ai/refly/blob/main/deploy/model-providers/deepseek.sql) |
| [Ollama](https://ollama.com/) | `http://host.docker.internal:11434/v1` | [ollama.sql](https://github.com/refly-ai/refly/blob/main/deploy/model-providers/ollama.sql) |

选择一个提供商并执行其 SQL 文件：

初始化推荐的 OpenAI 模型
```bash
curl https://raw.githubusercontent.com/refly-ai/refly/main/deploy/model-providers/openai.sql | docker exec -i refly_db psql -U refly -d refly
```
或者，初始化推荐的 OpenRouter 模型
```bash
curl https://raw.githubusercontent.com/refly-ai/refly/main/deploy/model-providers/openrouter.sql | docker exec -i refly_db psql -U refly -d refly
```

或者，初始化推荐的 DeepSeek 模型
```bash
curl https://raw.githubusercontent.com/refly-ai/refly/main/deploy/model-providers/deepseek.sql | docker exec -i refly_db psql -U refly -d refly
```

::: warning
Refly 目前仅支持一个模型提供商。如果决定切换到另一个提供商或遇到错误 `duplicate key value violates unique constraint "model_infos_name_key"`，您需要先清空 `refly.model_infos` 表：

```bash
docker exec -it refly_db psql -U refly -d refly -c "TRUNCATE TABLE refly.model_infos;"
```
点击 `问问AI`后，可以看到你初始化好的模型。 
![ai-model-sql-init](/images/ai-model-sql-init.webp)

:::

::: info
有关模型配置的详细说明，请参阅[配置指南](./configuration.md#model-configuration)。
:::


## 升级指南
```shell
docker compose pull
docker compose down
docker compose up -d --remove-orphans
```

## 异常排除
### Gitpod init 失败
自己在终端手动执行 
```shell
cd deploy/docker
cp ../../apps/api/.env.example .env
docker compose up -d
```

### 查看容器运行情况
运行 `docker ps`, 每个容器的预期状态应该是 `Up` 和 `healthy`。以下是示例输出：
```text
CONTAINER ID   IMAGE                                      COMMAND                  CREATED          STATUS                    PORTS                                            NAMES
f2d71a5494b3   reflyai/refly-api:nightly                  "docker-entrypoint.s…"   13 minutes ago   Up 12 minutes (healthy)   3000/tcp, 0.0.0.0:5800-5801->5800-5801/tcp       refly_api
1d339d1ba317   reflyai/refly-web:nightly                  "/docker-entrypoint.…"   13 minutes ago   Up 12 minutes (healthy)   0.0.0.0:5700->80/tcp                             refly_web
6ebfe46441c3   postgres:16-alpine                         "docker-entrypoint.s…"   13 minutes ago   Up 13 minutes (healthy)   0.0.0.0:5435->5432/tcp                           refly_db
563bcdcf1ff8   reflyai/qdrant:v1.13.1                     "./entrypoint.sh"        13 minutes ago   Up 13 minutes (healthy)   0.0.0.0:6333-6334->6333-6334/tcp                 refly_qdrant
47a3d82c8f16   reflyai/elasticsearch:7.10.2               "/tini -- /usr/local…"   13 minutes ago   Up 13 minutes (healthy)   9300/tcp, 0.0.0.0:9210->9200/tcp                 refly_elasticsearch
ca56521eebd6   redis/redis-stack:latest                   "/entrypoint.sh"         13 minutes ago   Up 13 minutes (healthy)   0.0.0.0:8001->8001/tcp, 0.0.0.0:6381->6379/tcp   refly_redis
4b0b9d2100d0   minio/minio:RELEASE.2025-01-20T14-49-07Z   "/usr/bin/docker-ent…"   13 minutes ago   Up 13 minutes (healthy)   0.0.0.0:9002->9000/tcp, 0.0.0.0:9003->9001/tcp   refly_minio
```

或者运行 `docker status`, `Ctrl + C` 可以退出
```text
CONTAINER ID   NAME                  CPU %     MEM USAGE / LIMIT     MEM %     NET I/O           BLOCK I/O         PIDS
f2d71a5494b3   refly_api             0.04%     160.9MiB / 62.79GiB   0.25%     1.5MB / 3.37MB    3.5MB / 229kB     32
1d339d1ba317   refly_web             0.00%     13.49MiB / 62.79GiB   0.02%     301kB / 3.41MB    8.19kB / 8.19kB   17
6ebfe46441c3   refly_db              0.00%     37.39MiB / 62.79GiB   0.06%     47.5kB / 14.4kB   0B / 113MB        7
563bcdcf1ff8   refly_qdrant          0.20%     82.04MiB / 62.79GiB   0.13%     9.04kB / 4.61kB   0B / 4.91MB       75
47a3d82c8f16   refly_elasticsearch   0.17%     1.416GiB / 62.79GiB   2.26%     115kB / 112kB     0B / 7.63MB       80
ca56521eebd6   refly_redis           0.26%     133.8MiB / 62.79GiB   0.21%     3.55MB / 1.38MB   7.49MB / 2.65MB   21
4b0b9d2100d0   refly_minio           0.06%     91.88MiB / 62.79GiB   0.14%     14.1kB / 7.32kB   0B / 3.56MB       21
```

运行日志查看，运行 `docker compose logs -f`， `Ctrl + C` 可以退出。

运行 `docker ps --filter name=refly_ | grep -v 'healthy'` 来识别 **不健康** 的容器（状态不处于 `healthy`）。

查看具体的服务的日志，例如 `api`, `docker compose logs api -f`, 从 docker compose 文件的 service 的命名确定，不要跟 Docker 的容器名混淆。




