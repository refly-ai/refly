# MinerU 解析器状态检查

## ✅ 已完成的集成

### 1. 解析器文件
- ✅ `apps/api/src/modules/knowledge/parsers/mineru.parser.ts` - 已创建
- ✅ 包含完整的 MinerU API 集成
- ✅ 支持 mock 模式用于测试
- ✅ 支持批量上传和 URL 解析两种模式

### 2. 工厂集成
- ✅ `apps/api/src/modules/knowledge/parsers/factory.ts` - 已集成
- ✅ 在 PDF 解析器选择逻辑中添加了 MinerU 支持
- ✅ 当 `providerKey === 'mineru'` 时使用 MinerU 解析器

### 3. 提供商配置
- ✅ `packages/utils/src/provider.ts` - 已配置 MinerU 提供商
- ✅ `packages/providers/src/provider-checker/provider-checker.ts` - 已添加健康检查

## 🔧 配置要求

### 环境变量
```bash
MINERU_API_KEY=your_mineru_api_key_here
```

### 提供商配置
在数据库中配置 MinerU 提供商：
- `providerKey`: `mineru`
- `name`: `MinerU`
- `apiKey`: 你的 MinerU API 密钥
- `baseUrl`: `https://mineru.net/api/v4` (可选，有默认值)

## 🧪 测试方法

### 1. Mock 模式测试
```typescript
const parser = new MineruParser({
  mockMode: true,
  apiKey: 'test-key'
});

const result = await parser.parse('test content');
// 应该返回: { content: 'Mocked MinerU content', metadata: { source: 'mineru' } }
```

### 2. 实际 API 测试
```typescript
const parser = new MineruParser({
  apiKey: process.env.MINERU_API_KEY,
  useBatchUpload: true,
  isOcr: false,
  enableFormula: true,
  enableTable: true,
  language: 'ch'
});

const result = await parser.parse(pdfBuffer);
```

## 📋 功能特性

### 支持的文档类型
- ✅ PDF 文档
- ✅ 支持 OCR 文本识别
- ✅ 支持公式识别
- ✅ 支持表格识别
- ✅ 支持中文语言

### 解析模式
- ✅ 批量上传模式 (推荐)
- ✅ URL 解析模式 (备用)

### 错误处理
- ✅ API 密钥验证
- ✅ 网络错误处理
- ✅ 解析失败处理
- ✅ 超时处理

## 🚀 使用流程

1. **配置 API 密钥**: 设置 `MINERU_API_KEY` 环境变量
2. **配置提供商**: 在数据库中添加 MinerU 提供商配置
3. **上传 PDF**: 通过知识库 API 上传 PDF 文件
4. **自动解析**: 系统会自动选择 MinerU 解析器处理 PDF
5. **获取结果**: 返回解析后的 Markdown 内容

## 🔍 验证步骤

1. 检查 API 服务器是否正常运行
2. 验证 MinerU 提供商配置是否正确
3. 上传一个 PDF 文件进行测试
4. 检查解析结果是否包含预期的内容

## 📝 注意事项

- MinerU 解析器需要有效的 API 密钥
- 解析过程可能需要一些时间，特别是对于大型文档
- 建议在生产环境中使用批量上传模式以获得更好的性能
- 如果 MinerU 服务不可用，系统会自动回退到其他 PDF 解析器 