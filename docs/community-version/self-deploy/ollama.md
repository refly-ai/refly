# Ollama

This guide will walk you through using Refly with Ollama on your own machine.

## Install Refly

We assume that you have followed the [Self Deploy](./index.md) guide to install Refly. It is perfectly OK if you have not configured the environment variables and models yet.

## Install Ollama

Head over to the [Ollama](https://ollama.com/docs/installation) home page and press the "Download" button.

![Ollama Download](/images/ollama-home.webp)

After downloading and running the installer, you can verify Ollama is working properly by running the following command:

```bash
ollama -v
```

## Download Models

Refly requires both embedding models and LLMs. You can download the models by running the following commands:

```bash
# Download your favorite embedding model
ollama pull nomic-embed-text

# Download your favorite LLMs
ollama pull deepseek-r1:7b
ollama pull deepseek-r1:14b
ollama pull llama3.3:70b
```

::: tip
You can find more models to choose from on [Ollama Models](https://ollama.com/search).
:::

Verify that the models are downloaded successfully by running the following command:

```bash
ollama list
```

Make sure the Ollama server is running properly:

```bash
curl http://localhost:11434
```

If the message `Ollama is running` is returned, you are good to go. Otherwise, please run `ollama serve` to start the server.

## Configure Refly

To integrate Ollama with Refly, you need to configure the following environment variables in the `deploy/docker/.env` file:

```bash
# Ollama is perfectly compatible with OpenAI API, so we set the embedding provider to openai here
EMBEDDINGS_PROVIDER=openai

# Choose the embedding model listed in `ollama list`
EMBEDDINGS_MODEL_NAME=nomic-embed-text

# Configure the base URL of the Ollama server
# Since we are accessing Ollama on the host from the container, we need to use `host.docker.internal`
OPENAI_BASE_URL=http://host.docker.internal:11434/v1

# The API key is required but not used, so we just set a dummy value here
OPENAI_API_KEY=ollama
```

::: tip
In this case, we assume that you are running Refly and Ollama on the same host. If you are running Ollama on a remote machine, you need to replace `host.docker.internal` with the IP address of the remote machine.
:::

Next, let's download the example SQL file for Ollama:

```bash
wget https://raw.githubusercontent.com/refly-ai/refly/main/deploy/model-providers/ollama.sql
```

Adjust the SQL file to reflect the models you have downloaded. Then, execute the SQL file against the `refly_db` container:

```bash
cat ollama.sql | docker exec -i refly_db psql -U refly -d refly
```

## Restart Refly

Now you can restart Refly by running the following command:

```bash
docker compose -f deploy/docker/docker-compose.yml up -d