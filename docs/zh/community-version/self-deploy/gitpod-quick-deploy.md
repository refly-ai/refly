# Gitpod 快速部署

## 1. 简介
Gitpod 是一个基于云的开发环境，它允许你通过浏览器快速启动一个预配置好的开发环境。使用 Gitpod 部署 Refly 可以省去本地环境配置的麻烦，让你快速开始使用 Refly。通过 Gitpod 的一键部署功能，你可以轻松地在几分钟内拥有一个完整的 Refly 工作环境。

## 2. 前提条件
在开始使用 Gitpod 部署 Refly 之前，请确保你满足以下条件：
- **一个 GitHub 账号：** Gitpod 使用 GitHub 账号进行身份验证和仓库访问。
- **（可选）了解 Gitpod 的基本使用：** 虽然本文档会指导你完成部署过程，但对 Gitpod 有基本了解会帮助你更好地使用。

## 3. 部署步骤详解
按照以下步骤，在 Gitpod 中快速部署 Refly：

### 3.1 找到并点击 "Open in Gitpod" 按钮
通常，你可以在 Refly 的 GitHub 仓库的 README 文件中或 Refly 的官方网站上找到一个 "Open in Gitpod" 按钮。点击这个按钮将引导你进入 Gitpod 的设置页面。
![](/images/2025-05-14-15-39-51.png)

### 3.2 授权 Gitpod 访问 GitHub
如果你是第一次使用 Gitpod，系统会要求你授权 Gitpod 访问你的 GitHub 账号。请按照提示完成授权，以便 Gitpod 能够克隆 Refly 仓库并创建工作区。
![](/images/2025-05-14-15-40-28.png)

### 3.3 配置并创建 Gitpod 工作区
在 Gitpod 页面上，你会看到关于 Refly 仓库的信息。通常情况下，你无需修改默认设置。确认信息无误后，点击 "Continue" 或类似的按钮来创建 Gitpod 工作区。
![](/images/2025-05-14-15-40-55.png)

### 3.4 等待工作区准备和服务部署
解释 Gitpod 会自动拉取代码、配置环境，并根据 `.gitpod.yml` 文件执行部署任务。
![](/images/2025-05-14-15-41-24.png)
![](/images/2025-05-14-15-42-02.png)

根据 `.gitpod.yml` 文件，Gitpod 会执行以下 `init` 任务：
```bash
cd deploy/docker && cp ../../apps/api/.env.example .env && docker compose up -d
```
这个命令的作用是：
1. 进入 `deploy/docker` 目录。
2. 复制 `../../apps/api/.env.example` 文件并将其命名为 `.env` 到当前目录。这个文件包含了 Refly 服务运行所需的环境变量配置。
3. 使用 Docker Compose 以后台（`-d`）模式启动 `deploy/docker` 目录下 `docker-compose.yml` 文件中定义的所有服务，包括 api, redis, qdrant, db, minio, searxng, web 等。

你可以在 Gitpod 终端中看到服务启动的过程和日志输出。请耐心等待所有服务成功启动。
![](/images/2025-05-14-15-42-26.png)
![](/images/2025-05-14-15-42-40.png)
![](/images/2025-05-14-15-42-58.png)
### 3.5 访问及使用 Refly
当 `.gitpod.yml` 中定义的服务全部成功启动后，Refly 应用就可以访问了。根据 `.gitpod.yml` 文件中的 `ports` 配置，Gitpod 会暴露一些端口。其中，`5700` 端口被配置为 `onOpen: open-preview`，这意味着 Gitpod 会自动在你当前浏览器中打开一个预览窗口，显示运行在 `5700` 端口的 Refly API 服务。

你可以通过这个预览窗口或 Gitpod 提供的端口转发链接来访问 Refly 应用的 Web 界面。通常 Web 界面会通过 API 端口进行通信。

**初次使用 Refly：**

首次访问 Refly 应用时，你需要注册一个账户并登录。登录后，为了充分使用 Refly 的各项功能，你需要进行必要的个性化配置，包括：

- **配置供应商：** 接入外部 AI 服务和模型。
- **配置模型：** 管理不同类型的模型（LLM、嵌入模型、排序模型）。
- **配置解析器：** 设置网页搜索、URL 解析等功能。
- **配置默认模型：** 设置常用的默认模型。

详细的配置步骤和说明，请参考[个性化设置指南](../personalization.md)。


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
47a3d82c8f16   reflyai/elasticsearch:7.10.2               "/tini -- /usr/local…"   13 minutes ago   Up 13 minutes (healthy)   9300/tcp, 0.0.0.0:9210->9200/tcp                 refly_elasticsearch
ca56521eebd6   redis/redis-stack:latest                   "/entrypoint.sh"         13 minutes ago   Up 13 minutes (healthy)   0.0.0.0:8001->8001/tcp, 0.0.0.0:6381->6379/tcp   refly_redis
4b0b9d2100d0   minio/minio:RELEASE.2025-01-20T14-49-07Z   "/usr/bin/docker-ent…"   13 minutes ago   Up 13 minutes (healthy)   0.0.0.0:9002->9000/tcp, 0.0.0.0:9003->9001/tcp   refly_minio
```

运行日志查看，运行 `docker compose logs -f`， `Ctrl + C` 可以退出。

运行 `docker ps --filter name=refly_ | grep -v 'healthy'` 来识别 **不健康** 的容器（状态不处于 `healthy`）。

查看具体的服务的日志，例如 `api`, `docker compose logs api -f`, 从 docker compose 文件的 service 的命名确定，不要跟 Docker 的容器名混淆。
