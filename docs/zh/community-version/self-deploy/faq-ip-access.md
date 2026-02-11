# FAQ：通过 IP 地址访问

如果您在云服务器上部署 Refly，并尝试通过 `http://<公网IP>:5700` 访问，可能会遇到登录后无法正常跳转的问题。这是由于 Cookie 域名配置不匹配导致的。

请按照以下步骤调整配置：

## 第一步：确认服务器信息

获取您的云服务器公网 IP 地址，例如：`a.b.c.d`。

## 第二步：修改环境变量配置

修改 `deploy/docker/.env` 文件：

```bash
# 将 ORIGIN 设置为浏览器访问的完整地址，包含协议和端口号
ORIGIN=http://a.b.c.d:5700

# 将 REFLY_COOKIE_DOMAIN 设置为 IP 地址，不要包含协议前缀
REFLY_COOKIE_DOMAIN=a.b.c.d

# 将 REFLY_COOKIE_SECURE 设置为空
REFLY_COOKIE_SECURE=
```

## 第三步：重启服务

修改完配置文件后，需要重启服务以使配置生效：

```bash
docker compose down
docker compose up -d
```

## 第四步：验证与测试

运行以下命令检查容器环境变量是否正确：

```bash
docker exec refly_api env | egrep 'REFLY_COOKIE|ORIGIN'
```

正确环境变量示例：

```bash
ORIGIN=http://a.b.c.d:5700
REFLY_COOKIE_DOMAIN=a.b.c.d
REFLY_COOKIE_SECURE=
REFLY_COOKIE_SAME_SITE=Lax
```

环境变量正确后，清理浏览器缓存和 Cookie，并尝试重新登录。
