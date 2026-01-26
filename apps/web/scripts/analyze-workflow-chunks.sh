#!/bin/bash

# 分析 workflow 页面实际加载的所有 chunk

echo "==================================="
echo "Workflow 页面 Chunk 分析"
echo "==================================="
echo ""

# 1. 找到所有可能被 workflow 加载的文件
echo "📦 生成的 chunk 文件:"
echo ""

cd apps/web/dist/static/js 2>/dev/null || cd dist/static/js 2>/dev/null || {
  echo "❌ 错误：找不到 dist 目录，请先运行构建"
  echo "   运行: cd apps/web && pnpm build"
  exit 1
}

# 显示主要的 lib 和 group chunk
echo "🔹 核心库:"
ls -lh lib-*.js 2>/dev/null | awk '{printf "   %-40s %8s\n", $9, $5}'

echo ""
echo "🔹 页面组 chunk:"
ls -lh async/group-*.js 2>/dev/null | awk '{printf "   %-40s %8s\n", $9, $5}' || \
ls -lh group-*.js 2>/dev/null | awk '{printf "   %-40s %8s\n", $9, $5}'

echo ""
echo "🔹 异步组件 chunk (前 10 个最大的):"
find async -name "*.js" -type f 2>/dev/null | xargs ls -lh | sort -k5 -hr | head -10 | awk '{printf "   %-40s %8s\n", $9, $5}' || echo "   (没有 async 目录)"

echo ""
echo "==================================="
echo "📊 总体积统计:"
echo "==================================="

# 计算总大小
total_size=$(find . -name "*.js" -type f -exec stat -f%z {} \; 2>/dev/null | awk '{s+=$1} END {print s}' || \
             find . -name "*.js" -type f -exec stat -c%s {} \; 2>/dev/null | awk '{s+=$1} END {print s}')

if [ -n "$total_size" ]; then
  total_mb=$(echo "scale=2; $total_size / 1024 / 1024" | bc)
  echo "   总 JS 体积: ${total_mb} MB"
else
  echo "   无法计算总体积"
fi

echo ""
echo "==================================="
echo "💡 说明:"
echo "==================================="
echo ""
echo "group-workflow.js 只有几 KB 是正常的！"
echo ""
echo "实际加载时会包括："
echo "  1. lib-react.js - React 核心库"
echo "  2. lib-router.js - React Router"
echo "  3. lib-xxx.js - Ant Design 等大型库"
echo "  4. async/*.js - 共享组件（包括 canvas 组件）"
echo "  5. group-workflow.js - 页面逻辑代码"
echo ""
echo "要查看页面实际加载了哪些文件："
echo "  1. 运行: cd apps/web && pnpm preview"
echo "  2. 打开浏览器 DevTools → Network"
echo "  3. 访问 workflow 页面"
echo "  4. 查看加载的所有 JS 文件及其大小"
echo ""
