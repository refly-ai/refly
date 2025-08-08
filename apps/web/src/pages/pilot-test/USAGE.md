# Week1 发散Pilot测试页面使用说明

## 快速开始

### 1. 启动服务

```bash
# 启动API服务器 (在apps/api目录)
cd apps/api
npm run build:fast && node dist/main.js

# 启动Web服务器 (在项目根目录)
cd apps/web
pnpm dev
```

### 2. 访问测试页面

打开浏览器访问: `http://localhost:5173/pilot-test`

## 功能测试

### 创建发散会话

1. 在"创建发散会话"卡片中输入prompt
2. 设置最大发散数和最大深度
3. 点击"创建会话"按钮
4. 查看返回的sessionId

### 查询会话状态

1. 在"查询会话状态"卡片中输入sessionId
2. 点击"查询状态"按钮
3. 查看当前会话的执行状态和进度

### 会话列表管理

1. 点击"刷新列表"按钮获取所有会话
2. 在表格中查看会话详细信息
3. 点击"查看状态"快速查询特定会话

### API响应调试

- 所有API请求和响应都会在"API响应"卡片中显示
- 便于调试和验证API调用

## 浏览器控制台测试

在浏览器控制台中运行以下命令进行快速测试：

```javascript
// 运行完整测试
pilotTest.runFullTest()

// 单独测试各个功能
pilotTest.testCreateSession()
pilotTest.testGetStatus('your-session-id')
pilotTest.testGetSessions()
```

## 测试用例

### 基础测试

1. **简单任务测试**
   - Prompt: "帮我分析人工智能的发展趋势"
   - 最大发散数: 4
   - 最大深度: 3

2. **复杂任务测试**
   - Prompt: "为一家初创公司制定完整的AI产品战略"
   - 最大发散数: 6
   - 最大深度: 4

3. **边界测试**
   - Prompt: "简单问题测试"
   - 最大发散数: 1
   - 最大深度: 1

### 验证要点

- ✅ 会话创建成功，返回正确的sessionId
- ✅ 状态查询返回完整信息
- ✅ 会话列表正常显示
- ✅ API响应格式正确
- ✅ 错误处理正常工作

## 故障排除

### 常见问题

1. **API服务器连接失败**
   - 检查API服务器是否在localhost:5800运行
   - 确认端口没有被占用

2. **页面无法访问**
   - 检查Web服务器是否正常启动
   - 确认访问路径为 `/pilot-test`

3. **API调用失败**
   - 检查浏览器控制台错误信息
   - 确认API端点正确
   - 验证请求格式

### 调试技巧

1. 使用浏览器开发者工具查看网络请求
2. 检查控制台错误信息
3. 使用API响应卡片查看详细响应
4. 利用测试脚本进行快速验证

## 技术细节

- **前端框架**: React + TypeScript
- **UI组件**: Ant Design
- **样式**: Tailwind CSS
- **API调用**: Fetch API
- **状态管理**: React Hooks
- **路由**: React Router

## 下一步

完成Week1测试后，可以继续开发：
- Week2: 集成真实技能服务
- Week3: 前端Canvas可视化
- Week4: 性能优化和错误恢复
