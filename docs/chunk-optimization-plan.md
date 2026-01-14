# 页面 Chunk 进一步优化方案

## 当前问题分析

1. **存在 3.1MB 的大 chunk** (`4360.js`) - 可能包含共享组件
2. **async chunks 中有多个 400-700KB 的大文件** - 这些可能是页面或大型组件
3. **vendor chunks 已经分离**，但页面级别的共享代码可能还需要优化

## 优化策略

### 策略 1: 分离共享组件库（推荐）⭐⭐⭐⭐⭐

**目标**: 将 ai-workspace-common 中的共享组件分离成多个 chunk，避免所有页面都加载相同的大 chunk

**方案**: 在 rsbuild.config.ts 中添加更精细的 forceSplitting 配置

```typescript
chunkSplit: {
  strategy: 'split-by-experience',
  forceSplitting: {
    // ... 现有 vendor chunks ...

    // === AI Workspace Common - Canvas 相关（只有 workflow 需要）===
    'workspace-canvas': /ai-workspace-common[\\/]src[\\/]components[\\/]canvas/,

    // === AI Workspace Common - Settings 相关 ===
    'workspace-settings': /ai-workspace-common[\\/]src[\\/]components[\\/]settings/,

    // === AI Workspace Common - Editor 相关 ===
    'workspace-editor': /ai-workspace-common[\\/]src[\\/]components[\\/]editor/,

    // === AI Workspace Common - 其他组件 ===
    'workspace-common': /ai-workspace-common[\\/]src[\\/]components/,
  },
}
```

**预期效果**:
- Canvas 组件 (~1.6MB) 单独 chunk，只有 workflow 页面加载
- Settings 组件 (~800KB) 单独 chunk
- Editor 组件 (~300KB) 单独 chunk
- workspace 页面不会加载 Canvas 相关代码

---

### 策略 2: 优化大型 async chunks

**问题识别的大 chunk**:
- `976.js` (694KB)
- `5825.js` (608KB)
- `6339.js` (498KB)
- `192.js` (460KB)
- `9498.js` (416KB)
- `9161.js` (416KB)

**方案**: 使用动态导入拆分这些大组件

#### 2.1 Canvas 内部组件懒加载

```typescript
// packages/ai-workspace-common/src/components/canvas/index.tsx

// 原来：直接导入
import { NodePreview } from './node-preview';
import { SettingsPanel } from './settings-panel';

// 改为：懒加载
const NodePreview = lazy(() => import('./node-preview'));
const SettingsPanel = lazy(() => import('./settings-panel'));
```

#### 2.2 Marketplace 页面优化

```typescript
// packages/web-core/src/pages/marketplace/index.tsx

// 如果有大型图表或列表组件，改为懒加载
const TemplateList = lazy(() => import('./template-list'));
const TemplatePreview = lazy(() => import('./template-preview'));
```

---

### 策略 3: 按路由分组优化 minSize

**方案**: 调整 Rsbuild 的 minSize 配置，让小的页面可以合并

```typescript
performance: {
  chunkSplit: {
    strategy: 'split-by-experience',
    minSize: 20000, // 20KB，小于这个大小的 chunk 会被合并
    maxSize: 500000, // 500KB，大于这个的 chunk 会被拆分
    forceSplitting: {
      // ... vendor chunks ...
    },
  },
}
```

---

### 策略 4: 关键页面优化（workflow & workspace）

#### 4.1 Workspace 页面
**当前状态**: 轻量级，主要是 FrontPage 组件（539行）

**优化**:
```typescript
// packages/ai-workspace-common/src/components/canvas/front-page/index.tsx

// 模板列表懒加载（如果还没做）
const TemplateList = lazy(() =>
  import('@refly-packages/ai-workspace-common/components/canvas-template/template-list')
);

// 最近工作流懒加载
const RecentWorkflows = lazy(() => import('./recent-workflows'));
```

#### 4.2 Workflow 页面
**当前状态**: Canvas 组件很大（1498行）

**优化**:
```typescript
// packages/ai-workspace-common/src/components/canvas/index.tsx

// 面板懒加载
const RunDetailPanel = lazy(() => import('./run-detail-panel'));
const CopilotContainer = lazy(() => import('./copilot-container'));
const ResourcesPanel = lazy(() => import('./canvas-resources'));
const ToolStore = lazy(() => import('../settings/tools-config/tools/tool-store'));

// Settings 相关懒加载
const SettingsDrawer = lazy(() => import('./settings-drawer'));
```

---

### 策略 5: 条件加载 - 根据用户权限/状态

**方案**: 一些功能只有特定用户才需要

```typescript
// 示例：订阅相关组件
if (userHasPremium) {
  const PremiumFeatures = lazy(() => import('./premium-features'));
}

// 示例：管理员功能
if (isAdmin) {
  const AdminPanel = lazy(() => import('./admin-panel'));
}
```

---

## 实施优先级

### P0 - 立即实施（预计收益: -2MB）
1. **分离 Canvas 组件** 到独立 chunk
2. **分离 Settings 组件** 到独立 chunk
3. **调整 minSize/maxSize** 配置

### P1 - 本周实施（预计收益: -1MB）
4. **Canvas 内部组件懒加载** (RunDetailPanel, CopilotContainer 等)
5. **FrontPage 组件懒加载** (TemplateList, RecentWorkflows)

### P2 - 持续优化（预计收益: -500KB）
6. **Marketplace 页面优化**
7. **条件加载优化**

---

## 验证方法

### 1. Bundle 分析
```bash
ANALYZE=true pnpm build --filter=@refly/web
```

查看 Rsdoctor 报告，关注：
- workflow 页面的依赖图
- workspace 页面的依赖图
- 共享 chunk 的大小和内容

### 2. 页面加载测试
```bash
# 启动开发服务器
pnpm dev --filter=@refly/web

# 使用浏览器开发者工具
# 1. Network 面板：清除缓存，加载 workspace 页面
#    - 记录加载的 JS 文件大小
# 2. 切换到 workflow 页面
#    - 记录新加载的 JS 文件
# 3. 验证 workspace 没有加载 Canvas 相关的 chunk
```

### 3. 性能指标
- **workspace 页面初始加载**: 应 < 1.5MB
- **workflow 页面初始加载**: 应 < 3MB
- **FCP**: < 2s
- **LCP**: < 2.5s

---

## 预期成果

### 优化前
- workspace 页面: ~2.5MB（包含不需要的 Canvas 代码）
- workflow 页面: ~4MB
- 总 bundle: ~7.8MB

### 优化后（P0）
- workspace 页面: ~1.5MB（-40%）
- workflow 页面: ~3.5MB（-12.5%）
- 总 bundle: ~7MB（-10%）

### 优化后（P0+P1）
- workspace 页面: ~1.2MB（-52%）
- workflow 页面: ~3MB（-25%）
- 总 bundle: ~6.5MB（-17%）

---

## 注意事项

1. **避免过度分割**: 太多小 chunk 会增加 HTTP 请求数
2. **测试懒加载**: 确保 Suspense fallback 正常工作
3. **监控性能**: 使用 Lighthouse 和真实用户监控
4. **版本兼容**: 确保 Service Worker 正确缓存新的 chunk

---

## 下一步行动

建议从 **P0** 开始实施，因为：
1. 风险低 - 只修改配置文件
2. 收益大 - 预计减少 2MB
3. 实施快 - 1-2 小时即可完成

是否开始实施 P0 优化？
