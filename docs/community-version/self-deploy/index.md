# Self Deploy

## Prerequisites {#prerequisites}

To self-deploy Refly, you need to have the following installed:

- Docker (version 20.10.0 or higher)
- *Optional*: PostgreSQL client (either `psql` or GUI-based tools), used for managing usable LLM models
- *Optional*: Kubernetes cluster

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

::: info
A detailed description of all the environment variables is available in the [Configuration](./configuration.md).
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
CONTAINER ID   IMAGE                                      COMMAND                  CREATED       STATUS                 PORTS                                                                                    NAMES
71681217973e   reflyai/refly-api:latest                   "docker-entrypoint.s…"   5 hours ago   Up 5 hours (healthy)   3000/tcp, 0.0.0.0:5800-5801->5800-5801/tcp, :::5800-5801->5800-5801/tcp                  refly_api
462d7e1181ca   reflyai/qdrant:v1.13.1                     "./entrypoint.sh"        5 hours ago   Up 5 hours (healthy)   0.0.0.0:36333-6334->6333-6334/tcp, :::6333-6334->6333-6334/tcp                           refly_qdrant
fd287fa0a04e   redis/redis-stack:6.2.6-v18                "/entrypoint.sh"         5 hours ago   Up 5 hours (healthy)   0.0.0.0:6379->6379/tcp, :::36379->6379/tcp, 0.0.0.0:38001->8001/tcp, :::38001->8001/tcp  refly_redis
16321d38fc34   reflyai/refly-web:latest                   "/docker-entrypoint.…"   5 hours ago   Up 5 hours             0.0.0.0:5700->80/tcp, [::]:5700->80/tcp                                                  refly_web
d3809f344fed   searxng/searxng:latest                     "/usr/local/searxng/…"   5 hours ago   Up 5 hours (healthy)   0.0.0.0:38080->8080/tcp, [::]:38080->8080/tcp                                            refly_searxng
a13f349fe35b   minio/minio:RELEASE.2025-01-20T14-49-07Z   "/usr/bin/docker-ent…"   5 hours ago   Up 5 hours (healthy)   0.0.0.0:39000-39001->9000-9001/tcp, :::39000-39001->9000-9001/tcp                        refly_minio
e7b398dbd02b   postgres:16-alpine                         "docker-entrypoint.s…"   5 hours ago   Up 5 hours (healthy)   0.0.0.0:35432->5432/tcp, :::35432->5432/tcp                                              refly_db
```

### Deploy to Kubernetes cluster

Apply deployment yaml file directory

```bash
cd refly/deploy/kubernetes
kubectl apply -f refly-deployment.yaml
```

Finally, you can access the Refly application in `http://${HOST_IP}:5700` (`http://${HOST_IP}:30001` in Kubernetes), where `${HOST_IP}` is the IP address of the host machine.

::: info
If you cannot access the Refly application, please check the following:

- The `HOST_IP` is correct.
- The application is running properly. If not, jump to [Troubleshooting](#troubleshooting).
- The port `5700`(`30001`) is not being blocked by any application firewall. Check this especially if you are using a cloud server.
:::

## Start Using Refly {#start-using-refly}

To start using self-deployed version of Refly, first register an account with your email and password.

![](/images/register-1.webp)

![](/images/register-2.webp)

After entrance, you can configure the providers and models you want to use. Click on the account icon in the left bottom corner and select `Settings`.

![](/images/settings.webp)

Add your first provider:

![](/images/settings-provider.webp)

![](/images/settings-provider-modal.webp)

Add your first chat model:

![](/images/add-model.webp)

![](/images/add-model-modal.webp)

Configure embedding and reranker model:

![](/images/other-models.webp)

::: info
Embedding model is necessary for the knowledge base retrieval. Reranker model is optional and can be used to rerank the results of the search.
:::

Happy chatting!

![](/images/start-chat.webp)

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

If the issue persists, you can raise an issue in our [GitHub repository](https://github.com/refly-ai/refly/issues), or contact us in our [Discord Server](https://discord.gg/YVuYFjFvRC).
