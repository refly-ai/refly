# Ollama

本指南将指导您在自己的机器上使用 Refly 和 Ollama。

## 安装 Refly

我们假设您已经按照[自部署](./index.md)指南安装了 Refly。如果您还没有配置环境变量和模型，也没有关系。

## 安装 Ollama

前往 [Ollama](https://ollama.com/docs/installation) 主页并点击"Download"按钮。

![Ollama 下载](/images/ollama-home.webp)

下载并运行安装程序后，您可以通过运行以下命令来验证 Ollama 是否正常工作：

```bash
ollama -v
```

## 下载模型

Refly 需要嵌入模型和大语言模型。您可以通过运行以下命令来下载模型：

```bash
# 下载您喜欢的嵌入模型
ollama pull nomic-embed-text

# 下载您喜欢的大语言模型
ollama pull deepseek-r1:7b
ollama pull deepseek-r1:14b
ollama pull llama3.3:70b
```

::: tip
您可以在 [Ollama Models](https://ollama.com/search) 上找到更多可供选择的模型。
:::

通过运行以下命令验证模型是否成功下载：

```bash
ollama list
```

确保 Ollama 服务器正在正常运行：

```bash
curl http://localhost:11434
```

如果返回消息 `Ollama is running`，则说明一切正常。否则，请运行 `ollama serve` 来启动服务器。

## 配置 Refly

要将 Ollama 与 Refly 集成，您需要在 `deploy/docker/.env` 文件中配置以下环境变量：

```bash
# Ollama 完全兼容 OpenAI API，所以这里我们将嵌入提供商设置为 openai
EMBEDDINGS_PROVIDER=openai

# 选择在 `ollama list` 中列出的嵌入模型
EMBEDDINGS_MODEL_NAME=nomic-embed-text

# 配置 Ollama 服务器的基础 URL
# 由于我们从容器中访问主机上的 Ollama，所以需要使用 `host.docker.internal`
OPENAI_BASE_URL=http://host.docker.internal:11434/v1

# API 密钥是必需的但不会被使用，所以我们只需设置一个虚拟值
OPENAI_API_KEY=ollama
```

::: tip
在这种情况下，我们假设您在同一台主机上运行 Refly 和 Ollama。如果您在远程机器上运行 Ollama，则需要将 `host.docker.internal` 替换为远程机器的 IP 地址。
:::

接下来，让我们下载 Ollama 的示例 SQL 文件：

```bash
wget https://raw.githubusercontent.com/refly-ai/refly/main/deploy/model-providers/ollama.sql
```

调整 SQL 文件以反映您已下载的模型。然后，对 `refly_db` 容器执行 SQL 文件：

```bash
cat ollama.sql | docker exec -i refly_db psql -U refly -d refly
```

## 重启 Refly

现在您可以通过运行以下命令重启 Refly：

```bash
docker compose -f deploy/docker/docker-compose.yml up -d