# Code Execution with MCP - Anthropic 文章总结

**来源**: [https://www.anthropic.com/engineering/code-execution-with-mcp](https://www.anthropic.com/engineering/code-execution-with-mcp)  
**发布时间**: 2025年11月4日  
**作者**: Adam Jones, Conor Kelly

---

## 核心思想

MCP (Model Context Protocol) 是连接 AI Agent 和外部系统的开放标准。随着连接的工具数量增加，传统的直接工具调用方式会消耗大量 token，降低效率。**通过代码执行环境调用 MCP 工具**可以大幅提升效率。

---

## 主要问题

### 1. 工具定义占用大量上下文窗口

传统方式将所有工具定义预先加载到上下文中：

```
gdrive.getDocument
  Description: Retrieves a document from Google Drive
  Parameters:
    documentId (required, string): The ID of the document to retrieve
    fields (optional, string): Specific fields to return
  Returns: Document object with title, body content, metadata, permissions, etc.

salesforce.updateRecord
  Description: Updates a record in Salesforce
  Parameters:
    objectType (required, string): Type of Salesforce object
    recordId (required, string): The ID of the record to update
    data (required, object): Fields to update with their new values
  Returns: Updated record object with confirmation
```

**问题**: 当连接数千个工具时，需要处理数十万 token 才能开始执行任务。

### 2. 中间结果消耗额外 token

任务示例："从 Google Drive 下载会议记录，附加到 Salesforce 线索中"

传统流程：

```
TOOL CALL: gdrive.getDocument(documentId: "abc123")
  → 返回 "讨论 Q4 目标...\n[完整记录文本]"
     (加载到模型上下文)

TOOL CALL: salesforce.updateRecord(
  objectType: "SalesMeeting",
  recordId: "00Q5f000001abcXYZ",
  data: { "Notes": "讨论 Q4 目标...\n[完整记录文本再次写入]" }
)
  (模型需要再次将整个记录写入上下文)
```

**问题**: 
- 完整记录内容流经模型两次
- 2小时会议可能需要额外处理 50,000 token
- 更大的文档可能超出上下文窗口限制
- 模型在复制数据时容易出错

---

## 解决方案：代码执行 + MCP

### 核心思路

将 MCP 服务器呈现为代码 API，Agent 通过编写代码与 MCP 交互。

### 实现方式

#### 1. 文件树结构组织工具

```
servers/
├── google-drive/
│   ├── getDocument.ts
│   ├── ... (其他工具)
│   └── index.ts
├── salesforce/
│   ├── updateRecord.ts
│   ├── ... (其他工具)
│   └── index.ts
└── ... (其他服务器)
```

#### 2. 每个工具对应一个文件

```typescript
// ./servers/google-drive/getDocument.ts
import { callMCPTool } from '../../../client.js';

interface GetDocumentInput {
  documentId: string;
}

interface GetDocumentResponse {
  content: string;
}

/* Read a document from Google Drive */
export async function getDocument(input: GetDocumentInput): Promise<GetDocumentResponse> {
  return callMCPTool<GetDocumentResponse>('google_drive__get_document', input);
}
```

#### 3. Agent 编写代码执行任务

```typescript
// 读取 Google Docs 记录并添加到 Salesforce 潜在客户
import * as gdrive from './servers/google-drive';
import * as salesforce from './servers/salesforce';

const transcript = (await gdrive.getDocument({ documentId: 'abc123' })).content;
await salesforce.updateRecord({
  objectType: 'SalesMeeting',
  recordId: '00Q5f000001abcXYZ',
  data: { Notes: transcript }
});
```

### 效果

- **Token 使用量**: 从 150,000 降至 2,000 (减少 98.7%)
- **工具发现**: Agent 通过文件系统探索可用工具
- **按需加载**: 只读取当前任务需要的工具定义

---

## 核心优势

### 1. 渐进式信息披露 (Progressive Disclosure)

模型擅长导航文件系统。将工具呈现为文件系统上的代码，允许模型按需读取工具定义。

**可选方案**: 添加 `search_tools` 工具，支持：
- 按名称搜索
- 控制详细级别（仅名称 / 名称+描述 / 完整定义+Schema）

### 2. 上下文高效的工具结果

在代码中过滤和转换结果后再返回。

示例：获取 10,000 行表格

```typescript
// 无代码执行 - 所有行流经上下文
TOOL CALL: gdrive.getSheet(sheetId: 'abc123')
  → 返回 10,000 行到上下文中手动过滤

// 使用代码执行 - 在执行环境中过滤
const allRows = await gdrive.getSheet({ sheetId: 'abc123' });
const pendingOrders = allRows.filter(row => 
  row['Status'] === 'pending'
);
console.log(`找到 ${pendingOrders.length} 个待处理订单`);
console.log(pendingOrders.slice(0, 5)); // 只记录前 5 个供审查
```

**结果**: Agent 只看到 5 行而非 10,000 行。

### 3. 更强大且高效的控制流

使用熟悉的代码模式（循环、条件、错误处理）而非链式工具调用。

示例：等待 Slack 部署通知

```typescript
let found = false;
while (!found) {
  const messages = await slack.getChannelHistory({ channel: 'C123456' });
  found = messages.some(m => m.text.includes('deployment complete'));
  if (!found) await new Promise(r => setTimeout(r, 5000));
}
console.log('收到部署通知');
```

**额外优势**: 减少"首个 token 时间"延迟 - 代码执行环境处理条件判断，无需等待模型评估。

### 4. 隐私保护操作

中间结果默认留在执行环境中，模型只看到明确日志或返回的内容。

#### 高级功能：自动 PII 标记化

```typescript
const sheet = await gdrive.getSheet({ sheetId: 'abc123' });
for (const row of sheet.rows) {
  await salesforce.updateRecord({
    objectType: 'Lead',
    recordId: row.salesforceId,
    data: { 
      Email: row.email,
      Phone: row.phone,
      Name: row.name
    }
  });
}
```

MCP 客户端拦截并标记化 PII：

```typescript
// Agent 看到的（如果记录了 sheet.rows）：
[
  { salesforceId: '00Q...', email: '[EMAIL_1]', phone: '[PHONE_1]', name: '[NAME_1]' },
  { salesforceId: '00Q...', email: '[EMAIL_2]', phone: '[PHONE_2]', name: '[NAME_2]' },
  ...
]
```

真实数据从 Google Sheets 流向 Salesforce，但**从不经过模型**。

### 5. 状态持久化和技能 (Skills)

#### 状态持久化

```typescript
const leads = await salesforce.query({ 
  query: 'SELECT Id, Email FROM Lead LIMIT 1000' 
});
const csvData = leads.map(l => `${l.Id},${l.Email}`).join('\n');
await fs.writeFile('./workspace/leads.csv', csvData);

// 稍后继续执行
const saved = await fs.readFile('./workspace/leads.csv', 'utf-8');
```

#### 可复用技能

```typescript
// 在 ./skills/save-sheet-as-csv.ts
import * as gdrive from './servers/google-drive';

export async function saveSheetAsCsv(sheetId: string) {
  const data = await gdrive.getSheet({ sheetId });
  const csv = data.map(row => row.join(',')).join('\n');
  await fs.writeFile(`./workspace/sheet-${sheetId}.csv`, csv);
  return `./workspace/sheet-${sheetId}.csv`;
}

// 稍后，在任何 agent 执行中：
import { saveSheetAsCsv } from './skills/save-sheet-as-csv';
const csvPath = await saveSheetAsCsv('abc123');
```

**技能系统**: 添加 `SKILL.md` 文件创建结构化技能，模型可以引用和使用。随着时间推移，Agent 构建高级能力工具箱。

---

## 权衡考虑

代码执行引入自身复杂性：

- 需要安全的执行环境
- 需要适当的沙盒、资源限制和监控
- 增加运维开销和安全考虑

**平衡点**: 
- ✅ 优势：降低 token 成本、减少延迟、改进工具组合
- ⚠️ 成本：实施复杂性

---

## 总结

1. **MCP** 为 Agent 连接工具和系统提供基础协议
2. **问题**: 连接过多服务器时，工具定义和结果消耗大量 token
3. **解决方案**: 代码执行将软件工程的既定模式应用于 Agent
4. **核心价值**: 让 Agent 使用熟悉的编程结构更高效地与 MCP 服务器交互

---

## 相关资源

- [MCP 官网](https://modelcontextprotocol.io/)
- [MCP 服务器集合](https://github.com/modelcontextprotocol/servers)
- [MCP SDK 文档](https://modelcontextprotocol.io/docs/sdk)
- [Cloudflare: Code Mode](https://blog.cloudflare.com/code-mode/)
- [Claude Skills 文档](https://docs.claude.com/en/docs/agents-and-tools/agent-skills/overview)
- [Claude 代码沙盒](https://www.anthropic.com/engineering/claude-code-sandboxing)
- [MCP 社区](https://modelcontextprotocol.io/community/communication)

