# 快速使用指南

## 批量工作流执行测试

### 基本命令

```bash
REFLY_USER_ID="your_user_id" \
LLM_ENDPOINT="https://litellm.powerformer.net/v1" \
LLM_API_KEY="your_key" \
python test-batch-workflow-autogen.py
```

### 输出说明

脚本会每 2 秒自动输出一次进度（或在状态变化时立即输出），格式如下：

```
[14:30:25] 📊 进度: 3/10 | 🔄 生成:2 | 🚀 初始化:1 | ⏳ 执行:0 | ✅ 3 | ❌ 0
[14:30:27] 📊 进度: 5/10 | 🔄 生成:1 | ⏳ 执行:2 | ✅ 5 | ❌ 0
[14:30:30] 📊 进度: 8/10 | ⏳ 执行:2 | ✅ 8 | ❌ 0
[14:30:35] 📊 进度: 10/10 | ✅ 9 | ❌ 1
```

**说明:**
- `[HH:MM:SS]` - 时间戳，显示脚本正在运行
- `3/10` - 已完成 / 总数
- `🔄 生成:2` - 正在生成工作流的查询数（包括填充变量值）
- `🚀 初始化:1` - 正在初始化执行的查询数
- `⏳ 执行:2` - 正在执行中的查询数（轮询状态）
- `✅ 9` - 已成功完成的查询数
- `❌ 1` - 已失败的查询数

### 常见问题

#### Q: 为什么输出停止了？

A: 输出每 2 秒更新一次。如果：
1. 看到时间戳在更新 - 说明脚本正常运行
2. 时间戳停止更新 - 可能是某个 API 调用超时或卡住

如果长时间没有输出，可以：
- 检查 API 服务是否正常
- 使用单线程测试：`MAX_WORKERS=1 python test-batch-workflow-autogen.py`
- 查看 API 服务日志

#### Q: 如何知道哪个查询失败了？

A: 脚本结束后会显示详细的失败信息：

```
❌ 失败 (2 个):

  [3] 分析用户反馈数据，生成可视化报告和改进建议。...
      错误: Workflow generation failed: Invalid query format

  [7] 从研究论文中提取关键信息并生成文献综述。...
      错误: HTTP 500: Internal Server Error
```

#### Q: 如何减少输出？

A: 默认每 2 秒输出一次，已经比较精简。如果想进一步减少，可以修改代码中的时间间隔：

在 `print_progress` 函数中，将 `< 2` 改为更大的值，如 `< 5`（5秒）

#### Q: 如何获取更详细的调试信息？

A: 将来会添加 `VERBOSE=true` 模式，目前请使用单查询脚本调试：

```bash
python test-workflow-autogen.py
```

### 配置选项

| 环境变量 | 说明 | 默认值 |
|---------|------|--------|
| `REFLY_USER_ID` | 用户 ID | 必需 |
| `LLM_ENDPOINT` | LLM API 端点 | 必需 |
| `LLM_API_KEY` | LLM API 密钥 | 必需 |
| `API_URL` | Refly API 地址 | `http://localhost:5800` |
| `MODEL_NAME` | LLM 模型名称 | `openai/gpt-4o` |
| `LOCALE` | 语言设置 | `en-US` |
| `MAX_WORKERS` | 并发线程数 | `20` |
| `QUERIES_FILE` | 查询文件路径 | `queries.txt` |

### 性能建议

1. **本地测试**: `MAX_WORKERS=5`
2. **生产环境**: `MAX_WORKERS=20`（根据 API 服务器性能调整）
3. **遇到限流**: 降低 `MAX_WORKERS` 值

### 查询文件格式

每行一个查询，空行会被忽略：

```
输入一周工作总结，自动提炼并生成 3 篇专业、有洞察力的 LinkedIn 帖子。
根据会议记录生成行动项清单和后续任务分配。
分析用户反馈数据，生成可视化报告和改进建议。
```

