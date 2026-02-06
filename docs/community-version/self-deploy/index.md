# Self Deploy

## Prerequisites {#prerequisites}

### Hardware Requirements {#hardware-requirements}

- **CPU:** 2 cores minimum
- **RAM:** 4GB minimum (8GB recommended)
- **Storage:** 20GB+ available

### Software Requirements {#software-requirements}

- **Docker:** Version 24.0+
- **Docker Compose:** Version 2.20+

## Steps {#steps}

### 1. Clone the repository {#clone-the-repository}

```bash
git clone https://github.com/refly-ai/refly.git
cd refly
```

::: tip
You can add `--depth 1` to the `clone` command to save disk space and download time.
:::

### 2. Prepare the configuration via `.env` file {#prepare-the-configuration-via-env-file}

```bash
cd deploy/docker
cp env.example .env
```

Edit `.env` with required settings.

#### 2.1. Add Resend API Key (Optional) {#add-resend-api-key-optional}

If you need to send emails, please get your own key from https://resend.com/ and fill it in `.env`:

```
RESEND_API_KEY=your_resend_api_key
```

#### 2.2. Add Fal API Key (Optional) {#add-fal-api-key-optional}

If you need to generate image/audio/video, please get your own key from https://fal.ai/ and fill it in `.env`:

```
TOOLSET_FAL_API_KEY=your_fal_api_key
```

#### 2.3. Accessing via IP address {#ip-access-section}

If you are deploying on a cloud server and accessing it via an IP address, please refer to the [Accessing via IP address](./faq-ip-access.md) for environment variable settings.

### 3. Start the application via docker compose {#start-the-application-via-docker-compose}

```bash
docker compose up -d
```

You can run `docker ps` to check the status of the containers. The expected status for each container should be `Up` and `healthy`. An example output is shown below:

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

You can access the Refly application in `http://localhost:5700`.


## Start Using Refly {#start-using-refly}

To start using the self-deployed version of Refly, first register an account with your email and password.

![Register](/images/register.webp)

After entrance, you can configure the providers and models you want to use. Click on the account icon in the right top corner and select `Settings`.

![Settings](/images/settings-new.webp)

Add your first provider:

![Add provider](/images/add-provider-1.webp)

![Add provider modal](/images/add-provider-2.webp)

Add your first chat model:

![Add model](/images/add-model-1.webp)

![Add model modal](/images/add-model-2.webp)

Configure your default model:

![Configure default model](/images/default-model-config.webp)

Happy chatting!

![Start chat](/images/start-chat-new.webp)

## Troubleshooting {#troubleshooting}

If the application fails to function properly, you can try the following steps:

1. Check if the port `5700` is already in use. If so, you can change the port in the `docker-compose.yml` file.
2. Run `docker ps --filter name=refly_ | grep -v 'healthy'` to identify **unhealthy** containers (whose status is not `healthy`).
3. Run `docker logs <container_id>` to get more information about the unhealthy container.
4. If the unhealthy container is `refly_api`, you can first try to run `docker restart refly_api` to restart the container.
5. For others issues, you can search for the cause of error messages in the container's logs.

If the issue persists, you can raise an issue in our [GitHub repository](https://github.com/refly-ai/refly/issues).
