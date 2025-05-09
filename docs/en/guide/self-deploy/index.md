# Self Deploy

## Prerequisites {#prerequisites}

To self-deploy Refly, you need to have the following installed:

- Docker (version 20.10.0 or higher)
- *Optional*: PostgreSQL client (either `psql` or GUI-based tools), used for managing usable LLM models

::: info
We plan to provide a fully-functional native application in the future, offering seamless installation experience in a privacy-focused manner. Stay tuned!
:::

## Steps {#steps}

### 1. Clone the repository {#clone-the-repository}

```bash
git clone https://github.com/refly-ai/refly.git
```

::: tip
If you only need to deploy with Docker, you can add `--depth 1` to the `clone` command to save disk space and download time.
:::

### 2. Prepare the configuration via `.env` file {#prepare-the-configuration-via-env-file}

```bash
cd refly/deploy/docker
cp ../../apps/api/.env.example .env
```

Notes on must-set environment variables:

- **Envs for LLM inference**:
  - `OPENAI_API_KEY`: API key for OpenAI (or any other compatible provider)
  - `OPENAI_BASE_URL`: Base URL for other OpenAI compatible provider
  - `OPENROUTER_API_KEY`: [OpenRouter](https://openrouter.ai/) API key (This will override `OPENAI_BASE_URL` with OpenRouter's if provided)
- **Envs for Embeddings**:
  - `EMBEDDINGS_PROVIDER`: Embeddings provider, currently support `openai`, `jina` and `fireworks`
  - `EMBEDDINGS_MODEL_NAME`: The name of the embeddings model, which could be different for different providers
  - `OPENAI_API_KEY`: Required if `EMBEDDINGS_PROVIDER` is `openai`
  - `JINA_API_KEY`: Required if `EMBEDDINGS_PROVIDER` is `jina`
  - `FIREWORKS_API_KEY`: Required if `EMBEDDINGS_PROVIDER` is `fireworks`
- **Envs for Web Search**:
  - `SERPER_API_KEY`: [Serper](https://serper.dev/) API key

::: info
A comprehensive list of all the configuration options is available in the [Configuration](../configuration.md).
:::

### 3. Start the application via docker compose {#start-the-application-via-docker-compose}

```bash
docker compose up -d
```

::: tip For passionate users
By default, the docker compose file will pull the `latest` image, which is the latest stable version. If you want to use the up-to-date version synced with the Refly Cloud, you can replace image tag `latest` with `nightly` in the `docker-compose.yml` file.
:::

You can run `docker ps` to check the status of the containers. The expected status for each container should be `Up` and `healthy`. An example output is shown below:

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

Finally, you can access the Refly application in `http://${HOST_IP}:5700`, where `${HOST_IP}` is the IP address of the host machine.

::: info
If you cannot access the Refly application, please check the following:

- The `HOST_IP` is correct.
- The application is running properly. If not, jump to [Troubleshooting](#troubleshooting).
- The port `5700` is not being blocked by any application firewall. Check this especially if you are using a cloud server.
:::

### 4. Initialize models {#initialize-models}

Models are configured via the `refly.model_infos` table within the `refly_db` PostgreSQL database. We have prepared the SQL files for some common providers with recommended models:

| Provider | `OPENAI_BASE_URL` | SQL File |
| -------- | ----------------- | -------- |
| [OpenAI](https://platform.openai.com/) | (empty) | [openai.sql](https://github.com/refly-ai/refly/blob/main/deploy/model-providers/openai.sql) |
| [OpenRouter](https://openrouter.ai/) | `https://openrouter.ai/api/v1` | [openrouter.sql](https://github.com/refly-ai/refly/blob/main/deploy/model-providers/openrouter.sql) |
| [DeepSeek](https://platform.deepseek.com/) | `https://api.deepseek.com` | [deepseek.sql](https://github.com/refly-ai/refly/blob/main/deploy/model-providers/deepseek.sql) |
| [Ollama](https://ollama.com/) | `http://host.docker.internal:11434/v1` | [ollama.sql](https://github.com/refly-ai/refly/blob/main/deploy/model-providers/ollama.sql) |

Choose one of the providers and execute it against the `refly_db` container. For example:

```bash
# Initialize recommended OpenAI models
curl https://raw.githubusercontent.com/refly-ai/refly/main/deploy/model-providers/openai.sql | docker exec -i refly_db psql -U refly -d refly
```

```bash
# Or, initialize recommended OpenRouter models
curl https://raw.githubusercontent.com/refly-ai/refly/main/deploy/model-providers/openrouter.sql | docker exec -i refly_db psql -U refly -d refly
```

```bash
# Or, initialize recommended DeepSeek models
curl https://raw.githubusercontent.com/refly-ai/refly/main/deploy/model-providers/deepseek.sql | docker exec -i refly_db psql -U refly -d refly
```

::: warning
Refly currently only support one model provider. If you decide to switch to another provider or encounter the error `duplicate key value violates unique constraint "model_infos_name_key"`, you need to truncate the `refly.model_infos` table first:

```bash
docker exec -it refly_db psql -U refly -d refly -c "TRUNCATE TABLE refly.model_infos;"
```
:::

::: info
For detailed explanation of model configurations, please refer to the [Configuration](../configuration.md#model-configuration) page.
:::

## Upgrade Guide {#upgrade-guide}

To upgrade to the latest stable version, you can pull the latest image and restart the containers:

```bash
docker compose pull
docker compose down
docker compose up -d --remove-orphans
```

If you run into any issues, please refer to the [Troubleshooting](#troubleshooting) section.

## Troubleshooting {#troubleshooting}

If the application fails to function properly, you can try the following steps:

1. Run `docker ps --filter name=refly_ | grep -v 'healthy'` to identify **unhealthy** containers (whose status is not `healthy`).
2. Run `docker logs <container_id>` to get more information about the unhealthy container.
3. If the unhealthy container is `refly_api`, you can first try to run `docker restart refly_api` to restart the container.
4. For others, you can search for the cause of error messages in the container's logs.

If the issue persists, you can raise an issue in our [GitHub repository](https://github.com/refly-ai/refly/issues), or contact us in our [Discord Server](https://discord.gg/bWjffrb89h).
