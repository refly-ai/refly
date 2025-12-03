# Workflow Autogen 认证迁移计划

## 概述

为解决安全问题，需要为 Workflow Autogen 相关接口添加认证，去除测试专用的无认证接口，并更新测试脚本以支持认证。

---

## 一、后端接口修改

### 1.1 添加认证：`copilot-autogen/generate`

**文件**: `apps/api/src/modules/copilot-autogen/copilot-autogen.controller.ts`

**修改内容**:
- 添加 `@UseGuards(JwtAuthGuard)`
- 添加 `@LoginedUser() user: UserModel` 参数
- 从 `user.uid` 获取用户 ID，不再从 request body 中获取
- 更新 DTO：移除 `uid` 字段（从 user 对象获取）

**影响**:
- ✅ 不影响已有功能（这是新功能）
- ⚠️ 需要前端/脚本传递认证信息

---

### 1.2 删除测试接口：`workflow/initialize-test`

**文件**: `apps/api/src/modules/workflow/workflow.controller.ts`

**删除内容**:
- `@Post('initialize-test')` 方法：`initializeWorkflowTest()`
- 第 82-126 行

**影响**:
- ✅ 正式接口 `POST /v1/workflow/initialize` 保持不变
- ✅ 不影响已有功能

---

### 1.3 删除测试接口：`workflow/detail-test`

**文件**: `apps/api/src/modules/workflow/workflow.controller.ts`

**删除内容**:
- `@Get('detail-test')` 方法：`getWorkflowDetailTest()`
- 第 132-169 行

**影响**:
- ✅ 正式接口 `GET /v1/workflow/detail` 保持不变
- ✅ 不影响已有功能

---

### 1.4 删除测试接口文档

**文件**: `apps/api/src/modules/workflow/TEST-ENDPOINT-README.md`

**操作**: 删除整个文件

---

### 1.5 更新 DTO 定义

**文件**: `apps/api/src/modules/copilot-autogen/copilot-autogen.dto.ts`

**修改内容**:
- 从 `GenerateWorkflowRequest` 中移除 `uid` 字段（改为从认证用户获取）

---

## 二、测试脚本修改

### 2.1 修改主测试脚本

**文件**: `scripts/workflow-autogen/test-workflow-autogen.py`

**修改内容**:

1. **环境变量调整**:
   - 移除: `REFLY_USER_ID`
   - 新增: `REFLY_EMAIL`, `REFLY_PASSWORD`

2. **添加登录函数**:
   ```python
   def login(session, api_url, email, password):
       """Login and establish authenticated session"""
       response = session.post(
           f"{api_url}/v1/auth/email/login",
           json={"email": email, "password": password}
       )
       response.raise_for_status()
   ```

3. **使用 Session 替代 requests**:
   - 创建 `session = requests.Session()`
   - 所有 `requests.post/get` 改为 `session.post/get`

4. **API 调用修改**:
   - `copilot-autogen/generate`: 移除 payload 中的 `uid`
   - `workflow/initialize-test` → `workflow/initialize`
   - `workflow/detail-test` → `workflow/detail`

---

### 2.2 修改批量测试脚本

**文件**: `scripts/workflow-autogen/test-batch-workflow-autogen.py`

**修改内容**: 同 2.1

---

### 2.3 更新文档

**文件**: 
- `scripts/workflow-autogen/README-workflow-execution.md`
- `scripts/workflow-autogen/README-batch-workflow-autogen.md`
- `scripts/workflow-autogen/USAGE.md`

**修改内容**:
- 更新环境变量说明（`REFLY_EMAIL`/`REFLY_PASSWORD` 替代 `REFLY_USER_ID`）
- 更新 API 端点说明（使用正式接口）
- 更新使用示例

---

## 三、详细修改清单

### 3.1 后端文件（5 个文件）

```
✏️ apps/api/src/modules/copilot-autogen/copilot-autogen.controller.ts
  - 添加 @UseGuards(JwtAuthGuard)
  - 添加 @LoginedUser() user 参数
  - 从 user.uid 获取 uid

✏️ apps/api/src/modules/copilot-autogen/copilot-autogen.dto.ts
  - 移除 uid 字段

✏️ apps/api/src/modules/workflow/workflow.controller.ts
  - 删除 initializeWorkflowTest() 方法（82-126 行）
  - 删除 getWorkflowDetailTest() 方法（132-169 行）

🗑️ apps/api/src/modules/workflow/TEST-ENDPOINT-README.md
  - 删除整个文件

✏️ apps/api/src/modules/copilot-autogen/copilot-autogen.service.ts
  - 检查是否需要调整参数传递
```

### 3.2 脚本文件

```
✏️ scripts/workflow-autogen/test-workflow-autogen.py
  - 添加 login_with_session() 函数
  - 使用 requests.Session()
  - 更新环境变量（EMAIL/PASSWORD）
  - 修改 API 端点（去掉 -test 后缀）
  - 移除 payload 中的 uid
  - 所有 requests.post/get 改为 session.post/get

✏️ scripts/workflow-autogen/test-batch-workflow-autogen.py
  - 添加 login_with_session() 函数
  - 使用 requests.Session()
  - 更新环境变量（EMAIL/PASSWORD）
  - 修改 API 端点（去掉 -test 后缀）
  - 移除 payload 中的 uid
  - 所有 requests.post/get 改为 session.post/get
  - 更新函数签名（传递 session 替代 uid）

⏸️ scripts/workflow-autogen/USAGE.md
  - 暂不修改（可选）

⏸️ scripts/workflow-autogen/README-*.md
  - 暂不修改（可选）
```

---

## 四、测试策略（快速验证优先）

### 🚀 阶段 1：快速测试 generate 接口（5 分钟）

**优点**: 快速验证认证是否正常工作，无需等待工作流执行

```bash
# 1. 启动后端
pnpm --filter @refly/api dev

# 2. 测试未认证访问（应返回 401）
curl -X POST http://localhost:5800/v1/copilot-autogen/generate \
  -H "Content-Type: application/json" \
  -d '{"query": "test", "locale": "en-US"}'
# 预期: 401 Unauthorized

# 3. 使用临时脚本测试认证登录
python test-generate-auth.py
# 预期: 
# ✅ Login successful
# ✅ Generate successful: Canvas ID = canvas_xxx
```

---

### ✅ 阶段 2：完整流程测试（15 分钟）

运行完整的工作流生成和执行：

```bash
# 设置环境变量
export REFLY_EMAIL="your@email.com"
export REFLY_PASSWORD="your_password"
export LLM_ENDPOINT="https://litellm.powerformer.net/v1"
export LLM_API_KEY="your_key"

# 运行完整测试
python scripts/workflow-autogen/test-workflow-autogen.py \
  --query "生成一个简单的问候工作流"

# 验证流程:
# ✅ 登录成功
# ✅ 生成工作流成功
# ✅ 初始化执行成功
# ✅ 轮询状态成功
# ✅ 工作流执行完成
```

---

### 🔍 阶段 3：验证测试接口已删除

```bash
# 验证旧的测试接口不可用
curl -X POST http://localhost:5800/v1/workflow/initialize-test
# 预期: 404 Not Found

curl -X GET "http://localhost:5800/v1/workflow/detail-test?executionId=xxx&uid=xxx"
# 预期: 404 Not Found
```

---

## 五、实施步骤（推荐顺序）

> **说明**: 本次迁移暂不修改批量脚本，优先验证单个工作流生成

### 步骤 1：修改后端 - 添加认证到 generate 接口

**文件**: `apps/api/src/modules/copilot-autogen/copilot-autogen.controller.ts`

```typescript
// 添加 import
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { LoginedUser } from '../../utils/decorators/user.decorator';
import { User as UserModel } from '@prisma/client';

// 修改方法
@UseGuards(JwtAuthGuard)
@Post('generate')
async generateWorkflow(
  @LoginedUser() user: UserModel,
  @Body() body: Omit<GenerateWorkflowRequest, 'uid'>
) {
  const request = { ...body, uid: user.uid };
  // ... 原有逻辑
}
```

**验证**: 
```bash
# 启动后端
pnpm --filter @refly/api dev

# 测试未认证访问（应返回 401）
curl -X POST http://localhost:5800/v1/copilot-autogen/generate \
  -H "Content-Type: application/json" \
  -d '{"query": "test", "locale": "en-US"}'
```

---

### 步骤 2：快速测试 - 仅测试 generate 接口认证

创建临时测试脚本验证认证：

```python
# test-generate-auth.py
import requests
import os

api_url = os.getenv("API_URL", "http://localhost:5800")
email = os.getenv("REFLY_EMAIL")
password = os.getenv("REFLY_PASSWORD")

# 创建 session
session = requests.Session()

# 登录
print("🔐 Logging in...")
response = session.post(
    f"{api_url}/v1/auth/email/login",
    json={"email": email, "password": password}
)
response.raise_for_status()
print("✅ Login successful")

# 测试 generate 接口
print("\n🤖 Testing generate API...")
response = session.post(
    f"{api_url}/v1/copilot-autogen/generate",
    json={
        "query": "生成一个简单的工作流",
        "locale": "zh-Hans"
    }
)
response.raise_for_status()
data = response.json()
print(f"✅ Generate successful: Canvas ID = {data['data']['canvasId']}")
```

**运行测试**:
```bash
REFLY_EMAIL="your@email.com" REFLY_PASSWORD="your_pass" \
  python test-generate-auth.py
```

---

### 步骤 3：修改主测试脚本

**文件**: `scripts/workflow-autogen/test-workflow-autogen.py`

**主要修改点**:

添加登录状态功能，参考 test-generate-auth.py 中的实现。

3. **替换所有 API 调用**:
```python
# 原: /v1/workflow/initialize-test
# 改: /v1/workflow/initialize

# 原: /v1/workflow/detail-test
# 改: /v1/workflow/detail

# 移除 payload 中的 uid 字段
payload = {
    "query": query,
    "locale": locale,
}
```

---

### 步骤 4：删除测试接口

**文件**: `apps/api/src/modules/workflow/workflow.controller.ts`

删除以下方法（保留正式接口）:
- `initializeWorkflowTest()` (第 82-126 行)
- `getWorkflowDetailTest()` (第 132-169 行)

删除文件:
- `apps/api/src/modules/workflow/TEST-ENDPOINT-README.md`

---

### 步骤 5：完整测试

```bash
# 设置环境变量
export REFLY_EMAIL="your@email.com"
export REFLY_PASSWORD="your_password"
export LLM_ENDPOINT="https://litellm.powerformer.net/v1"
export LLM_API_KEY="your_key"
export API_URL="http://localhost:5800"

# 测试完整流程
python scripts/workflow-autogen/test-workflow-autogen.py \
  --query "输入一周工作总结，自动生成3篇LinkedIn帖子"
```

**预期输出**:
```
🔐 Logging in...
   Email: your@email.com
✅ Login successful

Testing Workflow Execution...
Endpoint: http://localhost:5800/v1/copilot-autogen/generate

Sending request...

✅ Workflow generated successfully!
   Canvas ID: canvas_xxx
   ...
```

---

### 步骤 6：更新文档（可选）

**文件**: `scripts/workflow-autogen/USAGE.md`

更新环境变量说明：
```markdown
# 旧
REFLY_USER_ID="user_xxx"

# 新
REFLY_EMAIL="your@email.com"
REFLY_PASSWORD="your_password"
```

## 实施进度

- [x] 步骤1: 添加认证到 `copilot-autogen/generate` 接口
- [x] 步骤2: 快速测试 `test-generate-auth.py`
- [x] 步骤3: 修改主测试脚本 `test-workflow-autogen.py`
  - ✅ 添加 `login_with_session()` 函数
  - ✅ 替换环境变量（REFLY_EMAIL/REFLY_PASSWORD 替代 REFLY_USER_ID）
  - ✅ 使用 `requests.Session()` 替代直接的 requests 调用
  - ✅ 更新 API 端点（`/initialize-test` → `/initialize`, `/detail-test` → `/detail`）
  - ✅ 从 generate payload 中移除 uid 字段
  - ✅ 更新函数签名以传递 session 对象
- [x] 步骤4: 删除测试接口 `initialize-test` 和 `detail-test`
  - ✅ 删除 `initializeWorkflowTest()` 方法（workflow.controller.ts 第 82-126 行）
  - ✅ 删除 `getWorkflowDetailTest()` 方法（workflow.controller.ts 第 132-169 行）
  - ✅ 删除文件 `TEST-ENDPOINT-README.md`
- [x] 步骤5: 完整流程测试
  - ✅ 验证旧测试接口已删除
    - `POST /v1/workflow/initialize-test` → 404 Not Found
    - `GET /v1/workflow/detail-test` → 404 Not Found
  - ✅ 验证正式接口需要认证
    - `POST /v1/copilot-autogen/generate` (未认证) → 401 Unauthorized
    - `POST /v1/workflow/initialize` (未认证) → 401 Unauthorized
  - ✅ 完整工作流测试成功（从终端历史验证）
    - 登录成功
    - 生成工作流成功（4个节点）
    - 初始化执行成功
    - 工作流执行完成（4/4节点，耗时60.2秒）
- [ ] 步骤6: 更新文档（可选）

## 本次实施范围

### ✅ 包含

- ✅ `copilot-autogen/generate` 加认证
- ✅ 删除 `workflow/initialize-test` 和 `detail-test`
- ✅ 修改 `test-workflow-autogen.py` 支持认证
- ✅ 修改 `test-batch-workflow-autogen.py` 支持认证
- ✅ 完整流程测试

### ⏸️ 暂不包含

- ⏸️ 文档更新（可选）
