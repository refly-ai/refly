const translations = {
  generateTitle: {
    title: '生成标题',
    description: '成功生成标题：{{title}}, 耗时 {{duration}} 毫秒',
  },
  generateTitleFailed: {
    title: '生成标题',
    description: '由于模型能力不足，无法生成标题，使用提问作为默认标题',
  },
  rewriteQuery: {
    title: '分解问题',
    description: '子查询：{{rewrittenQueries}}, 耗时 {{duration}} 毫秒',
  },
  translateQuery: {
    title: '翻译查询',
    description: '翻译后的查询：{{translatedQueries}}, 耗时 {{duration}} 毫秒',
  },
  webSearchCompleted: {
    title: '网页搜索完成',
    description: '总共 {{totalResults}} 个结果, 耗时 {{duration}} 毫秒',
  },
  librarySearchCompleted: {
    title: '知识库搜索完成',
    description: '总共 {{totalResults}} 个结果, 耗时 {{duration}} 毫秒',
  },
  translateResults: {
    title: '翻译结果',
    description: '总共 {{totalResults}} 个结果, 耗时 {{duration}} 毫秒',
  },
  rerankResults: {
    title: '选择关联结果',
    description: '总共 {{totalResults}} 个结果, 耗时 {{duration}} 毫秒',
  },
  generateAnswer: {
    title: '生成答案',
    description: '开始生成答案...',
  },
  extractUrls: {
    title: '提取网页链接',
    description: '总共 {{totalResults}} 个结果, 耗时 {{duration}} 毫秒',
  },
  crawlUrls: {
    title: '阅读网页链接',
    description: '总共 {{totalResults}} 个结果, 耗时 {{duration}} 毫秒',
  },
  analyzeQuery: {
    title: '分析需求',
    description: '分析需求完成，耗时 {{duration}} 毫秒',
  },
  generatingCodeArtifact: {
    title: '生成小组件',
    description: '小组件生成中，耗时 {{duration}} 毫秒',
  },
  codeArtifactGenerated: {
    title: '组件生成完成',
    description: '组件生成完成，耗时 {{duration}} 毫秒',
  },
  generateCodeArtifactTitle: {
    title: '生成组件标题',
    description: '成功生成标题：{{title}}, 耗时 {{duration}} 毫秒',
  },
  generateCodeArtifactTitleFailed: {
    title: '生成组件标题',
    description: '由于模型能力不足，无法生成标题，使用提问作为默认标题',
  },
  // 图像生成翻译
  'image.generating': {
    title: '生成图像',
    description: '正在根据提示词生成图像: {{prompt}}',
  },
  'image.api.request': {
    title: 'API请求',
    description: '正在发送请求到图像API: {{url}}',
  },
  'image.api.error': {
    title: 'API错误',
    description: '图像生成API错误: {{status}} - {{error}}',
  },
  'image.stream.error': {
    title: '流处理错误',
    description: '读取响应流错误: {{error}}',
  },
  'image.stream.processing': {
    title: '处理流数据',
    description: '正在处理提示词的图像生成: {{prompt}}',
  },
  'image.stream.progress': {
    title: '生成进度',
    description: '图像生成进行中，已用时 {{seconds}} 秒',
  },
  'image.url.found': {
    title: '已找到图像URL',
    description: '在响应中找到图像URL: {{url}}',
  },
  'image.genid.found': {
    title: '已找到生成ID',
    description: '找到生成ID: {{genId}}',
  },
  'image.timeout': {
    title: '生成超时',
    description: '图像生成在 {{timeout}} 秒后超时',
  },
  'image.url.found.alternative': {
    title: '已找到替代URL',
    description: '找到替代图像URL: {{url}}',
  },
  'image.url.missing': {
    title: 'URL缺失',
    description: '无法从响应中提取图像URL (响应长度: {{responseLength}})',
  },
  'image.artifact.created': {
    title: '图像成品已创建',
    description: '已创建图像成品: {{title}}',
  },
  'image.node.creating': {
    title: '创建图像节点',
    description: '正在为图像创建画布节点: {{entityId}}',
  },
  'image.node.created': {
    title: '图像节点已创建',
    description: '图像的画布节点已创建: {{entityId}}',
  },
  // 图像生成进度消息
  'image.queue.status': {
    title: '图像生成排队中',
    description: 'ID: `{{taskId}}`\n排队中...',
  },
  'image.generate.status': {
    title: '图像生成已开始',
    description: '生成中...',
  },
  'image.progress.status': {
    title: '图像生成进度',
    description: '进度 {{percentage}}% {{progressBar}}',
  },
  'image.complete.status': {
    title: '图像生成完成',
    description: '生成完成 ✅',
  },
  'image.genid.display': {
    title: '图像生成ID',
    description: 'gen_id: `{{genId}}`',
  },
  'image.genid.copyable': {
    title: '图像ID (点击复制)',
    description: '`{{genId}}` (点击可复制)',
  },
  'image.genid.missing': {
    title: '未找到图像ID',
    description: '⚠️ 未能提取出图像ID，但图像已成功生成',
  },

  // 图像生成错误消息
  'image.error.timeout': {
    title: '处理超时',
    description: '响应处理超时，请稍后重试。',
  },
  'image.error.generation': {
    title: '图像生成错误',
    description:
      '错误: {{message}}\n\n可能的解决方法:\n1. 检查API密钥是否有效\n2. 确认网络连接正常\n3. 简化提示词\n4. 检查API服务是否可用',
  },
  'image.error.creation': {
    title: '消息创建错误',
    description: '创建图像消息时出错: {{error}}',
  },

  // 图像生成结果消息
  'image.result.title': {
    title: '生成的图像',
    description: '基于提示词: {{prompt}}',
  },
  'image.result.id': {
    title: '图像生成ID',
    description: '生成ID: `{{genId}}`',
  },
  'image.result.copy': {
    title: '复制ID进行编辑',
    description: '复制此ID来编辑图像:\n`{{genId}}`',
  },
  'image.result.instructions': {
    title: '编辑说明',
    description: '您可以{{action}}来修改此图像。',
  },
  'image.result.copySection': {
    title: '可复制ID区域',
    description:
      '-----------------------------\n📋 **可复制的图像ID：**\n`{{genId}}`\n-----------------------------',
  },
  'image.result.note': {
    title: '显示说明',
    description: '注意: 如果图像未显示在画板中，请检查网络连接或刷新页面。',
  },
};

export default translations;
