# Sandbox Agent Use Cases & Evaluation Query Set

基于 Sandbox Agent 的能力，这里提供了全面的使用场景和评测查询集。

## 📊 核心能力

Sandbox Agent 支持以下核心能力：

1. **数据分析** - 处理和分析各种数据格式（CSV, JSON, Excel）
2. **可视化** - 生成图表和可视化内容
3. **文件处理** - 读取、转换和生成文件
4. **数学计算** - 执行复杂的数学和统计运算
5. **代码执行** - 运行 Python/JavaScript 代码解决各种问题
6. **机器学习** - 简单的 ML 任务和数据预处理
7. **音视频处理** - 音频/视频编辑、转换、合成和分析
8. **浏览器自动化** - 使用 browser-use 进行网页自动化操作
9. **MCP 工具集成** - 通过代码执行高效调用 MCP 服务器（节省 98%+ token）
10. **前端网页开发** - 创建多文件前端应用，支持 React/Vue/Next.js 等框架，可暴露端口供外部访问

---

## 🎯 Use Cases 分类

### 1. 数据分析类 (Data Analysis)

#### 1.1 CSV 数据分析

**场景描述**: 分析 CSV 文件，提取统计信息和洞察

**Query 评测集**:

```typescript
// Query 1: 基础统计分析
const query1 = {
  description: '分析销售数据基础统计',
  input: '请分析这个 sales.csv 文件，给出每列的基本统计信息（均值、中位数、标准差、最大值、最小值）',
  file: 'sales.csv',
  expectedOutputs: ['统计表格', '数据描述'],
  difficulty: 'easy'
};

// Query 2: 分组聚合分析
const query2 = {
  description: '按类别分组的销售分析',
  input: '分析 sales.csv，按产品类别分组，计算每个类别的总销售额、平均价格和销售数量',
  file: 'sales.csv',
  expectedOutputs: ['分组统计结果', '可能的排序'],
  difficulty: 'medium'
};

// Query 3: 时间序列分析
const query3 = {
  description: '时间序列趋势分析',
  input: '分析 sales.csv 中的日期列，展示每月的销售趋势，并预测下个月的销售额',
  file: 'sales.csv',
  expectedOutputs: ['时间序列图表', '趋势分析', '预测值'],
  difficulty: 'hard'
};

// Query 4: 异常值检测
const query4 = {
  description: '检测数据异常值',
  input: '检查 sales.csv 中的异常值，使用 IQR 方法或 Z-score 方法识别离群点',
  file: 'sales.csv',
  expectedOutputs: ['异常值列表', '可视化展示'],
  difficulty: 'medium'
};

// Query 5: 相关性分析
const query5 = {
  description: '变量相关性分析',
  input: '分析 sales.csv 中各数值列之间的相关性，生成相关性矩阵和热力图',
  file: 'sales.csv',
  expectedOutputs: ['相关性矩阵', '热力图', '相关性解释'],
  difficulty: 'medium'
};
```

#### 1.2 多文件数据对比

**场景描述**: 对比分析多个数据文件

**Query 评测集**:

```typescript
// Query 6: 两个文件对比
const query6 = {
  description: '对比两个时期的数据',
  input: '对比 sales_2023.csv 和 sales_2024.csv，分析销售额的变化趋势和增长率',
  files: ['sales_2023.csv', 'sales_2024.csv'],
  expectedOutputs: ['对比表格', '增长率', '变化趋势图'],
  difficulty: 'medium'
};

// Query 7: 数据合并分析
const query7 = {
  description: '合并多个数据源',
  input: '合并 customers.csv 和 orders.csv（基于 customer_id），分析每个客户的购买行为',
  files: ['customers.csv', 'orders.csv'],
  expectedOutputs: ['合并后的数据集', '客户分析报告'],
  difficulty: 'hard'
};
```

---

### 2. 数据可视化类 (Data Visualization)

**场景描述**: 创建各种图表和可视化

**Query 评测集**:

```typescript
// Query 8: 基础图表生成
const query8 = {
  description: '创建柱状图',
  input: '根据 sales.csv 创建一个柱状图，展示前 10 个产品的销售额',
  file: 'sales.csv',
  expectedOutputs: ['PNG 图表文件', '清晰的标签和标题'],
  difficulty: 'easy'
};

// Query 9: 多子图展示
const query9 = {
  description: '创建综合仪表板',
  input: '创建一个 2x2 的子图布局，分别展示：销售额柱状图、趋势折线图、类别饼图、散点图',
  file: 'sales.csv',
  expectedOutputs: ['包含 4 个子图的 PNG 文件'],
  difficulty: 'hard'
};

// Query 10: 交互式可视化
const query10 = {
  description: '创建箱线图',
  input: '为 sales.csv 中的数值列创建箱线图，展示数据分布和异常值',
  file: 'sales.csv',
  expectedOutputs: ['箱线图 PNG 文件'],
  difficulty: 'medium'
};

// Query 11: 时间序列可视化
const query11 = {
  description: '时间序列图表',
  input: '创建时间序列图表，展示过去 12 个月的销售趋势，包含移动平均线',
  file: 'sales_timeseries.csv',
  expectedOutputs: ['带趋势线的时间序列图'],
  difficulty: 'medium'
};

// Query 12: 地理数据可视化
const query12 = {
  description: '地理分布图',
  input: '根据 stores.csv 中的城市数据，创建销售额的地理分布图',
  file: 'stores.csv',
  expectedOutputs: ['地理分布可视化', '可能是条形图或地图'],
  difficulty: 'hard'
};
```

---

### 3. 文件处理类 (File Processing)

**场景描述**: 文件格式转换、数据清洗和处理

**Query 评测集**:

```typescript
// Query 13: 格式转换
const query13 = {
  description: 'CSV 转 JSON',
  input: '将 data.csv 转换为 JSON 格式，保存为 data.json',
  file: 'data.csv',
  expectedOutputs: ['data.json 文件'],
  difficulty: 'easy'
};

// Query 14: 数据清洗
const query14 = {
  description: '清洗缺失数据',
  input: '清洗 raw_data.csv：删除重复行、填充缺失值（数值列用均值，分类列用众数）、保存为 clean_data.csv',
  file: 'raw_data.csv',
  expectedOutputs: ['clean_data.csv', '清洗报告'],
  difficulty: 'medium'
};

// Query 15: 数据转换
const query15 = {
  description: '宽表转长表',
  input: '将 wide_format.csv 从宽格式转换为长格式（pivot 操作）',
  file: 'wide_format.csv',
  expectedOutputs: ['转换后的 CSV 文件'],
  difficulty: 'medium'
};

// Query 16: 数据拆分
const query16 = {
  description: '按条件拆分文件',
  input: '将 all_data.csv 按年份拆分成多个文件：data_2021.csv, data_2022.csv, data_2023.csv',
  file: 'all_data.csv',
  expectedOutputs: ['多个按年份拆分的 CSV 文件'],
  difficulty: 'medium'
};

// Query 17: 批量处理
const query17 = {
  description: '批量文件处理',
  input: '批量处理文件夹中的所有 CSV 文件，对每个文件计算汇总统计并合并到 summary.csv',
  files: ['folder/*.csv'],
  expectedOutputs: ['summary.csv'],
  difficulty: 'hard'
};
```

---

### 4. 数学和统计计算类 (Math & Statistics)

**场景描述**: 执行复杂的数学和统计计算

**Query 评测集**:

```typescript
// Query 18: 概率计算
const query18 = {
  description: '概率分布计算',
  input: '生成 1000 个符合正态分布（均值=100，标准差=15）的随机数，计算其统计特征并绘制直方图',
  file: null,
  expectedOutputs: ['统计结果', '直方图'],
  difficulty: 'easy'
};

// Query 19: 假设检验
const query19 = {
  description: 'A/B 测试分析',
  input: '对 ab_test.csv 中的两组数据进行 t 检验，判断两组之间是否有显著差异（α=0.05）',
  file: 'ab_test.csv',
  expectedOutputs: ['t 统计量', 'p 值', '结论'],
  difficulty: 'medium'
};

// Query 20: 回归分析
const query20 = {
  description: '线性回归建模',
  input: '对 housing.csv 建立线性回归模型，预测房价。特征包括：面积、房间数、地段等。输出模型性能指标和预测结果',
  file: 'housing.csv',
  expectedOutputs: ['模型参数', 'R²值', '预测结果', '残差图'],
  difficulty: 'hard'
};

// Query 21: 优化问题
const query21 = {
  description: '线性规划优化',
  input: '解决生产计划优化问题：在资源约束下，最大化利润。约束条件在 constraints.csv 中',
  file: 'constraints.csv',
  expectedOutputs: ['最优解', '最大利润值'],
  difficulty: 'hard'
};

// Query 22: 矩阵运算
const query22 = {
  description: '矩阵特征分析',
  input: '读取 matrix.csv，计算其特征值、特征向量和行列式',
  file: 'matrix.csv',
  expectedOutputs: ['特征值', '特征向量', '行列式值'],
  difficulty: 'medium'
};
```

---

### 5. 机器学习类 (Machine Learning)

**场景描述**: 简单的机器学习任务

**Query 评测集**:

```typescript
// Query 23: 分类任务
const query23 = {
  description: '客户流失预测',
  input: '使用 customer_churn.csv 训练一个分类模型预测客户流失。使用决策树或随机森林，输出准确率、混淆矩阵和特征重要性',
  file: 'customer_churn.csv',
  expectedOutputs: ['模型性能指标', '混淆矩阵', '特征重要性图'],
  difficulty: 'hard'
};

// Query 24: 聚类分析
const query24 = {
  description: '客户分群',
  input: '对 customers.csv 进行 K-means 聚类（k=4），识别不同的客户群体并可视化结果',
  file: 'customers.csv',
  expectedOutputs: ['聚类结果', '聚类中心', '可视化图表'],
  difficulty: 'medium'
};

// Query 25: 特征工程
const query25 = {
  description: '特征提取和选择',
  input: '对 raw_features.csv 进行特征工程：创建交互特征、多项式特征，并使用相关性选择最重要的 10 个特征',
  file: 'raw_features.csv',
  expectedOutputs: ['新特征集', '特征重要性排序'],
  difficulty: 'hard'
};

// Query 26: 时间序列预测
const query26 = {
  description: '销售预测',
  input: '基于 historical_sales.csv 的历史数据，使用 ARIMA 或 Prophet 预测未来 30 天的销售额',
  file: 'historical_sales.csv',
  expectedOutputs: ['预测结果', '置信区间', '预测图表'],
  difficulty: 'hard'
};

// Query 27: 推荐系统
const query27 = {
  description: '协同过滤推荐',
  input: '基于 user_ratings.csv 构建简单的协同过滤推荐系统，为指定用户推荐 Top 5 产品',
  file: 'user_ratings.csv',
  expectedOutputs: ['推荐列表', '相似度分数'],
  difficulty: 'hard'
};
```

---

### 6. 文本和 NLP 处理类 (Text & NLP)

**场景描述**: 文本数据分析和处理

**Query 评测集**:

```typescript
// Query 28: 文本清洗
const query28 = {
  description: '清洗评论文本',
  input: '清洗 reviews.csv 中的评论文本：移除标点符号、转小写、去除停用词',
  file: 'reviews.csv',
  expectedOutputs: ['清洗后的文本数据'],
  difficulty: 'medium'
};

// Query 29: 词频分析
const query29 = {
  description: '词频统计和词云',
  input: '分析 articles.csv 中的文章内容，统计词频并生成词云图（Top 50 词）',
  file: 'articles.csv',
  expectedOutputs: ['词频表', '词云图'],
  difficulty: 'medium'
};

// Query 30: 情感分析
const query30 = {
  description: '评论情感分析',
  input: '对 customer_reviews.csv 进行情感分析，分类为正面、负面或中性，并统计各类别占比',
  file: 'customer_reviews.csv',
  expectedOutputs: ['情感标签', '统计图表'],
  difficulty: 'hard'
};
```

---

### 7. 报表生成类 (Report Generation)

**场景描述**: 生成各类分析报告

**Query 评测集**:

```typescript
// Query 31: 月度报表
const query31 = {
  description: '生成月度销售报表',
  input: '基于 monthly_sales.csv 生成月度报表，包括：总销售额、同比增长率、Top 产品、趋势图表',
  file: 'monthly_sales.csv',
  expectedOutputs: ['报表文本', '多个图表', '可能生成 PDF'],
  difficulty: 'hard'
};

// Query 32: 数据质量报告
const query32 = {
  description: '数据质量检查',
  input: '检查 data.csv 的数据质量：缺失值比例、重复行、数据类型、异常值，生成质量报告',
  file: 'data.csv',
  expectedOutputs: ['详细的数据质量报告'],
  difficulty: 'medium'
};

// Query 33: 业务分析报告
const query33 = {
  description: '综合业务分析',
  input: '对 business_data.csv 进行全面分析：描述性统计、趋势分析、预测、建议，生成完整的业务分析报告',
  file: 'business_data.csv',
  expectedOutputs: ['多维度分析结果', '图表集', '业务建议'],
  difficulty: 'hard'
};
```

---

### 8. 数据生成类 (Data Generation)

**场景描述**: 生成测试数据或模拟数据

**Query 评测集**:

```typescript
// Query 34: 生成测试数据
const query34 = {
  description: '生成模拟销售数据',
  input: '生成一个包含 1000 行的模拟销售数据集，包括：日期、产品ID、数量、价格、类别等字段，保存为 mock_sales.csv',
  file: null,
  expectedOutputs: ['mock_sales.csv'],
  difficulty: 'easy'
};

// Query 35: 生成时间序列数据
const query35 = {
  description: '生成带季节性的时间序列',
  input: '生成 365 天的时间序列数据，包含趋势、季节性和随机噪声，保存为 timeseries.csv',
  file: null,
  expectedOutputs: ['timeseries.csv', '可视化图表'],
  difficulty: 'medium'
};
```

---

### 9. API 数据获取类 (API Data Fetching)

**场景描述**: 获取和处理在线数据

**Query 评测集**:

```typescript
// Query 36: 获取股票数据
const query36 = {
  description: '获取股票历史数据',
  input: '获取苹果公司（AAPL）过去一年的股票数据，计算移动平均线并绘制价格走势图',
  file: null,
  expectedOutputs: ['股票数据 CSV', '价格走势图'],
  difficulty: 'hard',
  note: '需要网络访问'
};

// Query 37: 获取天气数据
const query37 = {
  description: '分析天气数据',
  input: '获取北京过去 30 天的天气数据，分析温度变化趋势',
  file: null,
  expectedOutputs: ['天气数据', '温度趋势图'],
  difficulty: 'hard',
  note: '需要 API 密钥'
};
```

---

### 10. 复杂综合任务类 (Complex Tasks)

**场景描述**: 需要多步骤的复杂任务

**Query 评测集**:

```typescript
// Query 38: 端到端数据分析流程
const query38 = {
  description: '完整的数据分析管道',
  input: `执行完整的数据分析流程：
1. 读取 raw_data.csv
2. 数据清洗（处理缺失值、异常值）
3. 探索性数据分析（EDA）
4. 特征工程
5. 建立预测模型
6. 评估模型性能
7. 生成可视化报告`,
  file: 'raw_data.csv',
  expectedOutputs: ['清洗后数据', 'EDA 报告', '模型结果', '可视化图表'],
  difficulty: 'expert'
};

// Query 39: 数据融合分析
const query39 = {
  description: '多源数据融合',
  input: `融合分析多个数据源：
1. 合并 sales.csv、inventory.csv、customer.csv
2. 识别数据不一致性
3. 进行关联分析
4. 生成洞察报告`,
  files: ['sales.csv', 'inventory.csv', 'customer.csv'],
  expectedOutputs: ['融合后数据集', '关联分析结果', '洞察报告'],
  difficulty: 'expert'
};

// Query 40: 自动化决策支持
const query40 = {
  description: '库存优化建议',
  input: `基于 inventory_history.csv 和 sales_forecast.csv：
1. 分析历史库存和销售模式
2. 识别断货和积压风险
3. 计算最优库存水平
4. 生成补货建议`,
  files: ['inventory_history.csv', 'sales_forecast.csv'],
  expectedOutputs: ['风险分析', '最优库存建议', '补货计划'],
  difficulty: 'expert'
};
```

---

### 11. 音视频处理类 (Audio & Video Processing)

**场景描述**: 音频和视频文件的编辑、转换、合成和分析

**Query 评测集**:

```typescript
// Query 41: 音频合成
const query41 = {
  description: '合并多个音频文件',
  input: '将 audio1.mp3、audio2.mp3、audio3.mp3 按顺序合并成一个完整的音频文件 merged_audio.mp3',
  files: ['audio1.mp3', 'audio2.mp3', 'audio3.mp3'],
  expectedOutputs: ['merged_audio.mp3'],
  difficulty: 'medium',
  libraries: ['pydub', 'ffmpeg-python']
};

// Query 42: 视频拼接
const query42 = {
  description: '拼接多段视频',
  input: '将 clip1.mp4、clip2.mp4、clip3.mp4 按顺序拼接成一个完整的视频 final_video.mp4，保持原始分辨率和帧率',
  files: ['clip1.mp4', 'clip2.mp4', 'clip3.mp4'],
  expectedOutputs: ['final_video.mp4'],
  difficulty: 'medium',
  libraries: ['moviepy', 'ffmpeg-python']
};

// Query 43: 视频音频分离
const query43 = {
  description: '提取视频中的音频',
  input: '从 video.mp4 中提取音频轨道，保存为 audio.mp3，并生成无声版本的视频 video_nosound.mp4',
  file: 'video.mp4',
  expectedOutputs: ['audio.mp3', 'video_nosound.mp4'],
  difficulty: 'easy',
  libraries: ['moviepy', 'ffmpeg-python']
};

// Query 44: 音频视频合成
const query44 = {
  description: '为视频添加背景音乐',
  input: '将 background_music.mp3 添加到 video.mp4 中作为背景音乐，如果音乐较短则循环播放，保持原视频音轨，混合音量比例为 70%(原音频) : 30%(背景音乐)',
  files: ['video.mp4', 'background_music.mp3'],
  expectedOutputs: ['video_with_music.mp4'],
  difficulty: 'hard',
  libraries: ['moviepy', 'pydub']
};

// Query 45: 音频格式转换
const query45 = {
  description: '批量转换音频格式',
  input: '将文件夹中的所有 WAV 格式音频文件转换为 MP3 格式（128kbps），保持文件名',
  files: ['audio_folder/*.wav'],
  expectedOutputs: ['多个 MP3 文件'],
  difficulty: 'easy',
  libraries: ['pydub', 'ffmpeg-python']
};

// Query 46: 视频剪辑
const query46 = {
  description: '剪辑视频片段',
  input: '从 video.mp4 中提取 00:30 到 02:45 的片段，保存为 clip.mp4',
  file: 'video.mp4',
  expectedOutputs: ['clip.mp4'],
  difficulty: 'easy',
  libraries: ['moviepy', 'ffmpeg-python']
};

// Query 47: 视频转 GIF
const query47 = {
  description: '视频转动图',
  input: '将 video.mp4 的前 5 秒转换为 GIF 动图，分辨率降至 480p，帧率 10fps',
  file: 'video.mp4',
  expectedOutputs: ['animation.gif'],
  difficulty: 'medium',
  libraries: ['moviepy', 'imageio']
};

// Query 48: 音频波形可视化
const query48 = {
  description: '生成音频波形图',
  input: '分析 audio.mp3，生成波形图和频谱图，输出为 waveform.png 和 spectrogram.png',
  file: 'audio.mp3',
  expectedOutputs: ['waveform.png', 'spectrogram.png'],
  difficulty: 'medium',
  libraries: ['librosa', 'matplotlib', 'scipy']
};

// Query 49: 视频字幕添加
const query49 = {
  description: '为视频添加字幕',
  input: '根据 subtitles.srt 文件为 video.mp4 添加字幕，字幕居中底部显示，白色字体带黑色描边',
  files: ['video.mp4', 'subtitles.srt'],
  expectedOutputs: ['video_with_subtitles.mp4'],
  difficulty: 'hard',
  libraries: ['moviepy', 'ffmpeg-python']
};

// Query 50: 音频降噪
const query50 = {
  description: '音频降噪处理',
  input: '对 noisy_audio.wav 进行降噪处理，移除背景噪音，保存为 clean_audio.wav',
  file: 'noisy_audio.wav',
  expectedOutputs: ['clean_audio.wav', '降噪报告'],
  difficulty: 'hard',
  libraries: ['noisereduce', 'scipy', 'soundfile']
};

// Query 51: 视频压缩
const query51 = {
  description: '压缩视频文件',
  input: '压缩 large_video.mp4，目标大小为原始大小的 50%，保持可接受的质量（CRF=23），输出为 compressed_video.mp4',
  file: 'large_video.mp4',
  expectedOutputs: ['compressed_video.mp4', '压缩报告'],
  difficulty: 'medium',
  libraries: ['ffmpeg-python']
};

// Query 52: 音频速度调整
const query52 = {
  description: '调整音频播放速度',
  input: '将 audio.mp3 的播放速度调整为 1.5 倍，同时保持音调不变（不变成唐老鸭音），保存为 audio_fast.mp3',
  file: 'audio.mp3',
  expectedOutputs: ['audio_fast.mp3'],
  difficulty: 'medium',
  libraries: ['pydub', 'pyrubberband']
};

// Query 53: 视频水印添加
const query53 = {
  description: '为视频添加水印',
  input: '在 video.mp4 的右下角添加 logo.png 水印，透明度 70%，保持水印大小为视频宽度的 10%',
  files: ['video.mp4', 'logo.png'],
  expectedOutputs: ['video_watermarked.mp4'],
  difficulty: 'medium',
  libraries: ['moviepy', 'PIL']
};

// Query 54: 音频分割
const query54 = {
  description: '智能分割音频',
  input: '将 podcast.mp3 按静音片段自动分割成多个独立的音频文件，保存为 segment_1.mp3, segment_2.mp3 等',
  file: 'podcast.mp3',
  expectedOutputs: ['多个分段音频文件', '分割报告'],
  difficulty: 'hard',
  libraries: ['pydub', 'scipy']
};

// Query 55: 视频帧提取
const query55 = {
  description: '提取视频关键帧',
  input: '从 video.mp4 中每隔 1 秒提取一帧，保存为 frame_001.jpg, frame_002.jpg 等',
  file: 'video.mp4',
  expectedOutputs: ['多个 JPG 图片文件'],
  difficulty: 'easy',
  libraries: ['opencv-python', 'moviepy']
};

// Query 56: 音频音量标准化
const query56 = {
  description: '标准化音频音量',
  input: '将多个音频文件的音量标准化到相同水平（-20dB LUFS），保存为 normalized_*.mp3',
  files: ['audio1.mp3', 'audio2.mp3', 'audio3.mp3'],
  expectedOutputs: ['多个标准化后的音频文件'],
  difficulty: 'hard',
  libraries: ['pyloudnorm', 'pydub', 'soundfile']
};

// Query 57: 视频倒放
const query57 = {
  description: '视频倒放效果',
  input: '将 video.mp4 倒放，包括视频和音频都反向播放，保存为 reversed_video.mp4',
  file: 'video.mp4',
  expectedOutputs: ['reversed_video.mp4'],
  difficulty: 'medium',
  libraries: ['moviepy']
};

// Query 58: 音频混音
const query58 = {
  description: '多轨音频混音',
  input: '混合 vocals.mp3、drums.mp3、bass.mp3、guitar.mp3 四个音轨，各轨音量分别为 100%, 80%, 70%, 60%，输出为 mixed.mp3',
  files: ['vocals.mp3', 'drums.mp3', 'bass.mp3', 'guitar.mp3'],
  expectedOutputs: ['mixed.mp3'],
  difficulty: 'hard',
  libraries: ['pydub', 'numpy']
};

// Query 59: 视频转场效果
const query59 = {
  description: '添加视频转场',
  input: '将 clip1.mp4 和 clip2.mp4 拼接，在连接处添加 1 秒的淡入淡出转场效果',
  files: ['clip1.mp4', 'clip2.mp4'],
  expectedOutputs: ['video_with_transition.mp4'],
  difficulty: 'hard',
  libraries: ['moviepy']
};

// Query 60: 音频音高调整
const query60 = {
  description: '调整音频音高',
  input: '将 audio.mp3 的音高提高 2 个半音，保持播放速度不变，保存为 audio_pitch_up.mp3',
  file: 'audio.mp3',
  expectedOutputs: ['audio_pitch_up.mp3'],
  difficulty: 'medium',
  libraries: ['pyrubberband', 'librosa', 'soundfile']
};
```

---

### 12. 浏览器自动化类 (Browser Automation)

**场景描述**: 使用 browser-use 进行网页自动化操作，获取在线内容

**Query 评测集**:

```typescript
// Query 61: B站视频字幕获取
const query61 = {
  description: '获取B站视频字幕',
  input: '访问 B 站视频 https://www.bilibili.com/video/BV1xx411c7mD，获取视频的 CC 字幕或自动生成字幕，保存为 subtitle.srt',
  file: null,
  expectedOutputs: ['subtitle.srt', '字幕文本'],
  difficulty: 'hard',
  libraries: ['browser-use', 'playwright'],
  note: '需要处理登录和反爬机制'
};

// Query 62: YouTube视频字幕提取
const query62 = {
  description: '提取YouTube字幕',
  input: '从 YouTube 视频 https://www.youtube.com/watch?v=xxxxx 中提取英文字幕，保存为 en_subtitle.srt，如果有中文字幕也一并提取',
  file: null,
  expectedOutputs: ['en_subtitle.srt', '可能的 zh_subtitle.srt'],
  difficulty: 'medium',
  libraries: ['youtube-transcript-api', 'browser-use'],
  note: '可以使用 API 或浏览器自动化'
};

// Query 63: 网页内容爬取
const query63 = {
  description: '爬取新闻列表',
  input: '访问新闻网站首页，爬取今日头条新闻的标题、摘要、发布时间和链接，保存为 news.csv',
  file: null,
  expectedOutputs: ['news.csv'],
  difficulty: 'medium',
  libraries: ['browser-use', 'playwright', 'beautifulsoup4']
};

// Query 64: 表单自动填写
const query64 = {
  description: '自动填写表单',
  input: '访问指定表单页面，根据 form_data.json 中的数据自动填写表单字段并提交，截图保存提交结果',
  files: ['form_data.json'],
  expectedOutputs: ['submission_screenshot.png', '提交状态报告'],
  difficulty: 'hard',
  libraries: ['browser-use', 'playwright']
};

// Query 65: 网页截图
const query65 = {
  description: '批量网页截图',
  input: '根据 urls.txt 中的网址列表，访问每个页面并截取全页面截图，保存为 page_1.png, page_2.png 等',
  file: 'urls.txt',
  expectedOutputs: ['多个 PNG 截图文件'],
  difficulty: 'medium',
  libraries: ['browser-use', 'playwright']
};

// Query 66: 视频信息抓取
const query66 = {
  description: '批量获取视频元数据',
  input: '从 video_urls.csv 中读取 B 站/YouTube 视频链接，获取每个视频的标题、时长、播放量、发布日期、作者等信息，保存为 video_metadata.csv',
  file: 'video_urls.csv',
  expectedOutputs: ['video_metadata.csv'],
  difficulty: 'hard',
  libraries: ['browser-use', 'playwright']
};

// Query 67: 动态内容加载
const query67 = {
  description: '爬取动态加载内容',
  input: '访问使用无限滚动的网页，模拟向下滚动 10 次，收集所有加载出来的内容项，保存为 items.json',
  file: null,
  expectedOutputs: ['items.json'],
  difficulty: 'hard',
  libraries: ['browser-use', 'playwright']
};

// Query 68: 登录后操作
const query68 = {
  description: '登录后获取个人数据',
  input: '使用提供的账号密码登录网站，进入个人中心，导出个人收藏/历史记录数据',
  file: 'credentials.json',
  expectedOutputs: ['user_data.json', '截图证明'],
  difficulty: 'expert',
  libraries: ['browser-use', 'playwright'],
  note: '需要处理验证码和安全检查'
};

// Query 69: 搜索结果采集
const query69 = {
  description: '搜索引擎结果采集',
  input: '在 Google/Bing 中搜索 "Python 数据分析"，采集前 3 页的搜索结果（标题、链接、摘要），保存为 search_results.csv',
  file: null,
  expectedOutputs: ['search_results.csv'],
  difficulty: 'medium',
  libraries: ['browser-use', 'playwright']
};

// Query 70: 视频评论采集
const query70 = {
  description: '采集视频评论',
  input: '获取指定 B 站/YouTube 视频的前 100 条评论，包括评论内容、点赞数、发布时间、用户名，保存为 comments.csv',
  file: null,
  expectedOutputs: ['comments.csv'],
  difficulty: 'hard',
  libraries: ['browser-use', 'playwright']
};

// Query 71: 价格监控
const query71 = {
  description: '商品价格监控',
  input: '访问电商网站的商品页面，提取商品名称、当前价格、库存状态、评分，如果有历史价格也一并获取，保存为 product_info.json',
  file: null,
  expectedOutputs: ['product_info.json'],
  difficulty: 'medium',
  libraries: ['browser-use', 'playwright']
};

// Query 72: 网页表格提取
const query72 = {
  description: '提取网页表格数据',
  input: '访问包含数据表格的网页，提取所有表格数据并转换为 CSV 格式，支持分页表格的自动翻页',
  file: null,
  expectedOutputs: ['table_data.csv'],
  difficulty: 'hard',
  libraries: ['browser-use', 'playwright', 'pandas']
};

// Query 73: 文档下载
const query73 = {
  description: '批量下载文档',
  input: '访问文档分享页面，下载页面上所有的 PDF/DOC 文件到本地，保持原始文件名',
  file: null,
  expectedOutputs: ['多个下载的文档文件', '下载日志'],
  difficulty: 'medium',
  libraries: ['browser-use', 'playwright']
};

// Query 74: 网站地图生成
const query74 = {
  description: '生成网站结构图',
  input: '从首页开始爬取网站，记录所有内部链接，生成网站结构树状图，最大深度 3 层',
  file: null,
  expectedOutputs: ['sitemap.json', '结构可视化图'],
  difficulty: 'expert',
  libraries: ['browser-use', 'playwright', 'networkx']
};

// Query 75: 在线工具自动化
const query75 = {
  description: '使用在线转换工具',
  input: '访问在线文件转换网站，上传 document.docx，转换为 PDF 格式并下载',
  file: 'document.docx',
  expectedOutputs: ['document.pdf'],
  difficulty: 'hard',
  libraries: ['browser-use', 'playwright']
};
```

---

### 13. MCP 工具集成类 (MCP Tool Integration)

**场景描述**: 通过代码执行环境与 MCP (Model Context Protocol) 服务器交互，实现高效的工具调用和数据处理

**核心优势**:
- 按需加载工具定义，节省 token (可节省 98%+ 的 token)
- 在执行环境中过滤和转换数据，避免大量中间结果占用上下文
- 使用代码控制流（循环、条件）替代链式工具调用
- 隐私保护：敏感数据不经过模型上下文
- 状态持久化和技能复用

**Query 评测集**:

```typescript
// Query 81: MCP 工具发现与调用
const query81 = {
  description: '探索可用的 MCP 工具并执行任务',
  input: '列出所有可用的 Google Drive 相关工具，然后读取文档 abc123 的内容并总结',
  file: null,
  expectedOutputs: ['工具列表', '文档摘要'],
  difficulty: 'medium',
  mcpServers: ['google-drive'],
  note: '演示工具发现和按需加载'
};

// Query 82: 跨服务数据传输
const query82 = {
  description: '在 MCP 服务之间传输大量数据',
  input: '从 Google Drive 获取销售报告（约 50MB），提取关键指标，将摘要更新到 Salesforce 和 Slack 通知团队',
  file: null,
  expectedOutputs: ['Salesforce 更新确认', 'Slack 消息确认'],
  difficulty: 'hard',
  mcpServers: ['google-drive', 'salesforce', 'slack'],
  benefits: '大文档不经过模型上下文，在执行环境中处理'
};

// Query 83: 数据过滤和聚合
const query83 = {
  description: 'MCP 数据过滤和聚合',
  input: '从 Google Sheets 读取 10,000 行客户数据，筛选出本月活跃用户（status=active, last_login>=30天内），计算各地区分布，保存为 CSV',
  file: null,
  expectedOutputs: ['filtered_customers.csv', '统计报告'],
  difficulty: 'medium',
  mcpServers: ['google-sheets'],
  benefits: '只返回过滤后的结果给模型，节省大量 token'
};

// Query 84: 自动化工作流（轮询）
const query84 = {
  description: '实现轮询等待工作流',
  input: '监控 Slack 频道 #deployments，每 10 秒检查一次，直到出现 "deployment complete" 消息或超时 5 分钟，然后通知结果',
  file: null,
  expectedOutputs: ['监控结果', '通知确认'],
  difficulty: 'hard',
  mcpServers: ['slack'],
  benefits: '使用代码循环而非多次工具调用，更高效'
};

// Query 85: 隐私保护的数据迁移
const query85 = {
  description: 'PII 数据安全迁移',
  input: '从 customers.csv 读取客户信息（包含邮箱、电话、姓名），批量导入到 Salesforce，确保敏感信息不经过 AI 模型',
  file: 'customers.csv',
  expectedOutputs: ['导入报告', '成功/失败统计'],
  difficulty: 'expert',
  mcpServers: ['salesforce'],
  benefits: 'PII 数据仅在执行环境中流转，模型看到的是标记化版本'
};

// Query 86: 技能持久化
const query86 = {
  description: '创建可复用的数据处理技能',
  input: '编写一个可复用函数：从 Google Sheets 导出为 CSV，并保存为技能。然后使用这个技能导出 3 个不同的 Sheet',
  file: null,
  expectedOutputs: ['技能文件 export-sheet-to-csv.ts', '3 个 CSV 文件'],
  difficulty: 'hard',
  mcpServers: ['google-sheets'],
  benefits: 'Agent 可以积累和复用技能，提升效率'
};

// Query 87: 多源数据融合
const query87 = {
  description: '融合多个 MCP 数据源',
  input: `整合销售数据：
1. 从 Salesforce 获取本季度的销售线索
2. 从 Google Analytics 获取网站访问数据
3. 从 Stripe 获取支付数据
4. 关联三个数据源，生成综合报告`,
  file: null,
  expectedOutputs: ['综合销售报告', '关联分析结果'],
  difficulty: 'expert',
  mcpServers: ['salesforce', 'google-analytics', 'stripe'],
  benefits: '在执行环境中完成数据关联，避免大量数据流经模型'
};

// Query 88: 条件批处理
const query88 = {
  description: '条件化批量操作',
  input: `从 project_management.csv 读取任务列表，对每个任务：
- 如果状态是 "待审核"，在 Slack 通知相关人员
- 如果状态是 "已完成"，归档到 Google Drive
- 如果状态是 "阻塞"，创建 JIRA ticket`,
  file: 'project_management.csv',
  expectedOutputs: ['处理日志', '操作统计'],
  difficulty: 'expert',
  mcpServers: ['slack', 'google-drive', 'jira'],
  benefits: '使用代码条件逻辑而非多次往返模型'
};
```

---

### 14. 音视频+浏览器综合应用类 (Media + Browser Integration)

**场景描述**: 结合浏览器自动化和音视频处理的综合任务

**Query 评测集**:

```typescript
// Query 76: 视频字幕下载与嵌入
const query76 = {
  description: '下载字幕并嵌入本地视频',
  input: '从 B 站视频 URL 下载字幕，然后将字幕嵌入到本地的 video.mp4 文件中，生成带字幕的新视频',
  files: ['video.mp4'],
  expectedOutputs: ['video_with_subtitles.mp4', 'subtitle.srt'],
  difficulty: 'expert',
  libraries: ['browser-use', 'moviepy', 'playwright']
};

// Query 77: 批量视频资料整理
const query77 = {
  description: '批量下载视频信息并整理',
  input: `从 playlist.txt 中读取视频播放列表 URL（B站/YouTube）：
1. 获取每个视频的元数据（标题、时长、描述）
2. 下载字幕（如果有）
3. 生成统一格式的目录文件 catalog.md`,
  file: 'playlist.txt',
  expectedOutputs: ['catalog.md', '多个字幕文件', 'metadata.json'],
  difficulty: 'expert',
  libraries: ['browser-use', 'playwright']
};

// Query 78: 视频合集制作
const query78 = {
  description: '制作视频精华合集',
  input: `基于 video_links.csv（包含视频链接和时间戳）：
1. 获取每个视频的字幕
2. 根据时间戳剪辑精华片段
3. 将所有片段拼接成合集
4. 添加统一的片头片尾`,
  files: ['video_links.csv', 'intro.mp4', 'outro.mp4'],
  expectedOutputs: ['highlights_compilation.mp4', '片段列表'],
  difficulty: 'expert',
  libraries: ['browser-use', 'moviepy', 'playwright', 'ffmpeg-python']
};

// Query 79: 播客内容分析
const query79 = {
  description: '播客内容提取与分析',
  input: `从播客平台获取指定节目的音频和描述：
1. 下载音频文件
2. 获取节目描述和标签
3. 对音频进行语音识别生成文字稿
4. 提取关键话题和时间戳`,
  file: null,
  expectedOutputs: ['audio.mp3', 'transcript.txt', 'topics.json'],
  difficulty: 'expert',
  libraries: ['browser-use', 'whisper', 'pydub'],
  note: '需要语音识别能力'
};

// Query 80: 视频教程制作
const query80 = {
  description: '自动化教程视频制作',
  input: `基于教程脚本 tutorial_script.json：
1. 使用浏览器截取操作步骤截图
2. 录制屏幕操作视频片段
3. 添加文字说明和标注
4. 配上背景音乐
5. 生成完整教程视频`,
  files: ['tutorial_script.json', 'background_music.mp3'],
  expectedOutputs: ['tutorial_video.mp4'],
  difficulty: 'expert',
  libraries: ['browser-use', 'playwright', 'moviepy', 'PIL']
};
```

---

### 15. 前端网页开发类 (Frontend Web Development)

**场景描述**: 在沙盒环境中创建完整的前端网页应用，支持多文件项目、端口暴露和外部访问

**核心能力**:
- 多文件前端项目（HTML, CSS, JavaScript/TypeScript）
- 现代前端框架支持（React, Vue, Svelte 等）
- 本地开发服务器启动和端口暴露
- 数据可视化和交互式应用
- 与沙盒内生成的数据无缝集成
- 支持外部用户访问和使用

**Query 评测集**:

```typescript
// Query 89: 简单数据可视化网页
const query89 = {
  description: '创建数据可视化网页',
  input: '基于 sales.csv 创建一个交互式的销售数据仪表板网页，包含图表、筛选器和统计卡片，使用 Chart.js 或 D3.js，启动本地服务器',
  file: 'sales.csv',
  expectedOutputs: ['index.html', 'styles.css', 'app.js', '运行中的服务器 URL'],
  difficulty: 'medium',
  frameworks: ['vanilla-js', 'chart.js'],
  port: 3000
};

// Query 90: React 单页应用
const query90 = {
  description: '创建 React SPA',
  input: '使用 React 创建一个客户管理应用，包含客户列表、详情页、搜索和排序功能。数据来自 customers.json。使用 Vite 搭建开发环境',
  file: 'customers.json',
  expectedOutputs: ['完整的 React 项目结构', '运行中的开发服务器'],
  difficulty: 'hard',
  frameworks: ['react', 'vite'],
  port: 5173,
  projectStructure: [
    'src/App.jsx',
    'src/components/CustomerList.jsx',
    'src/components/CustomerDetail.jsx',
    'package.json',
    'vite.config.js'
  ]
};

// Query 91: 数据分析报告网页
const query91 = {
  description: '生成交互式分析报告',
  input: `分析 quarterly_report.csv 并生成一个美观的交互式报告网页：
1. 执行数据分析（趋势、异常、洞察）
2. 生成可视化图表（保存为图片或使用 JS 库）
3. 创建响应式报告页面，包含导航、图表、数据表格和分析结论
4. 支持导出 PDF 功能`,
  file: 'quarterly_report.csv',
  expectedOutputs: ['report.html', '多个图表文件', 'styles.css', '本地服务器'],
  difficulty: 'hard',
  frameworks: ['vanilla-js', 'chart.js', 'tailwindcss']
};

// Query 92: 实时数据监控面板
const query92 = {
  description: '创建实时监控仪表板',
  input: '创建一个系统监控仪表板，模拟实时数据流（CPU、内存、网络），使用 WebSocket 或轮询更新，包含图表、告警和历史记录',
  file: null,
  expectedOutputs: ['完整的前端+后端项目', '实时更新的仪表板'],
  difficulty: 'expert',
  frameworks: ['react', 'websocket', 'recharts'],
  technologies: ['Node.js 后端', 'Express', 'WebSocket']
};

// Query 93: 表单驱动的应用
const query93 = {
  description: '创建数据录入应用',
  input: '创建一个产品录入系统，包含多步骤表单、表单验证、文件上传预览、数据本地存储（localStorage），并提供数据导出为 CSV 的功能',
  file: null,
  expectedOutputs: ['多页面应用', '表单验证逻辑', '数据管理功能'],
  difficulty: 'medium',
  frameworks: ['vue', 'element-plus']
};

// Query 94: 数据可视化大屏
const query94 = {
  description: '创建全屏数据大屏',
  input: '基于 company_data.json 创建一个全屏数据大屏（类似企业展示大屏），包含：实时数字滚动、地图可视化、排行榜、动态图表、炫酷动画效果',
  file: 'company_data.json',
  expectedOutputs: ['全屏展示页面', '动画效果', '响应式设计'],
  difficulty: 'hard',
  frameworks: ['react', 'echarts', 'framer-motion'],
  style: '科技感、深色主题'
};

// Query 95: 交互式机器学习演示
const query95 = {
  description: 'ML 模型交互式演示页面',
  input: `基于训练好的模型（model.pkl），创建一个交互式演示页面：
1. 用户可以调整输入参数（滑块、输入框）
2. 实时显示预测结果
3. 可视化模型决策边界或特征重要性
4. 提供模型说明和使用指南`,
  file: 'model.pkl',
  expectedOutputs: ['交互式 ML 演示页面', 'Python 后端 API', '前端界面'],
  difficulty: 'expert',
  frameworks: ['react', 'flask', 'plotly'],
  technologies: ['Python 后端', 'RESTful API', 'scikit-learn']
};

// Query 96: 多页面文档网站
const query96 = {
  description: '创建项目文档网站',
  input: '基于 docs/ 文件夹中的 Markdown 文件，生成一个漂亮的文档网站，包含侧边栏导航、搜索功能、代码高亮、响应式设计',
  files: ['docs/*.md'],
  expectedOutputs: ['静态文档网站', '搜索功能', '导航系统'],
  difficulty: 'hard',
  frameworks: ['vitepress', 'markdown-it'],
  features: ['Markdown 渲染', '代码高亮', '搜索']
};

// Query 97: 游戏或交互式应用
const query97 = {
  description: '创建简单的浏览器游戏',
  input: '创建一个简单的数据可视化游戏：用户需要根据图表数据猜测趋势、识别异常等。包含计分系统、关卡设计、排行榜',
  file: 'game_data.json',
  expectedOutputs: ['游戏主页面', '游戏逻辑', '计分系统'],
  difficulty: 'hard',
  frameworks: ['vanilla-js', 'canvas-api', 'chart.js']
};

// Query 98: API 文档和测试界面
const query98 = {
  description: '创建 API 测试工具',
  input: '基于 api_spec.json（OpenAPI 格式），生成一个 API 文档和测试页面，用户可以在页面上测试 API 端点、查看请求/响应示例',
  file: 'api_spec.json',
  expectedOutputs: ['API 文档页面', '交互式测试工具'],
  difficulty: 'hard',
  frameworks: ['react', 'swagger-ui'],
  features: ['API 文档展示', '在线测试', '代码生成']
};

// Query 99: 多语言响应式网站
const query99 = {
  description: '创建多语言企业官网',
  input: '创建一个多页面企业官网，包含首页、产品页、关于我们、联系我们。支持中英文切换、响应式设计、SEO 优化、联系表单',
  file: 'company_info.json',
  expectedOutputs: ['多页面网站', '国际化支持', '响应式设计'],
  difficulty: 'expert',
  frameworks: ['nextjs', 'tailwindcss', 'i18next'],
  features: ['SSR', 'i18n', 'SEO']
};

// Query 100: 数据对比分析工具
const query100 = {
  description: '创建数据对比工具',
  input: '创建一个工具，允许用户上传两个 CSV 文件，自动对比差异、生成对比报告、可视化差异分布。支持导出对比结果',
  file: null,
  expectedOutputs: ['文件上传界面', '对比分析引擎', '结果可视化'],
  difficulty: 'expert',
  frameworks: ['react', 'papaparse', 'antd'],
  features: ['文件处理', '差异分析', '可视化', '导出']
};

// Query 101: 集成沙盒数据的完整应用
const query101 = {
  description: '端到端数据分析应用',
  input: `创建一个完整的数据分析流程应用：
1. 在沙盒中分析 raw_sales.csv（数据清洗、分析、预测）
2. 将分析结果保存为 JSON
3. 创建 React 应用展示结果（图表、表格、洞察）
4. 支持用户上传新数据重新分析
5. 提供下载报告功能`,
  file: 'raw_sales.csv',
  expectedOutputs: ['完整的前后端应用', '数据处理管道', '交互式前端'],
  difficulty: 'expert',
  frameworks: ['react', 'flask', 'pandas', 'recharts'],
  architecture: ['Python 数据处理后端', 'React 前端', 'RESTful API']
};

// Query 102: 实时协作白板
const query102 = {
  description: '创建在线白板应用',
  input: '创建一个简单的在线白板，支持绘图、文字、形状、颜色选择。数据通过 localStorage 持久化。提供导出为图片的功能',
  file: null,
  expectedOutputs: ['白板应用', '绘图功能', '导出功能'],
  difficulty: 'hard',
  frameworks: ['react', 'canvas-api', 'fabric.js'],
  features: ['绘图工具', '状态管理', '导出']
};
```

**实现要点**:

1. **开发服务器启动**
```typescript
// 示例：在沙盒中启动前端服务器
const session = new CodeInterpreterSession({ 
  verbose: true,
  exposePort: 3000  // 暴露端口供外部访问
});

await session.generateResponse(`
创建一个 React 应用并启动开发服务器。
确保服务器监听 0.0.0.0:3000 以便外部访问。
`);
```

2. **多文件项目管理**
```typescript
// 沙盒会自动处理多文件项目
// Agent 会创建完整的项目结构
project/
├── package.json
├── index.html
├── src/
│   ├── App.jsx
│   ├── components/
│   └── utils/
└── vite.config.js
```

3. **数据集成**
```typescript
// 无缝集成沙盒内生成的数据
const response = await session.generateResponse(`
1. 分析 sales.csv 生成统计数据
2. 创建网页展示这些统计数据
3. 启动服务器
`);
```

4. **外部访问**
```typescript
// 获取可访问的 URL
const serverUrl = response.metadata.serverUrl;
console.log(`Visit: ${serverUrl}`);
// 输出: http://sandbox-xyz.e2b.dev:3000
```

---

## 📝 评测框架设计

### 评测维度

```typescript
interface EvaluationCriteria {
  // 1. 功能正确性
  correctness: {
    taskCompleted: boolean;        // 任务是否完成
    outputAccuracy: number;        // 输出准确度 (0-1)
    logicCorrectness: boolean;     // 逻辑是否正确
  };
  
  // 2. 代码质量
  codeQuality: {
    executionSuccess: boolean;     // 代码是否成功执行
    errorHandling: boolean;        // 是否有错误处理
    codeEfficiency: number;        // 代码效率 (0-1)
  };
  
  // 3. 输出质量
  outputQuality: {
    fileGenerated: boolean;        // 是否生成了预期文件
    visualizationQuality: number;  // 可视化质量 (0-1)
    explanationClarity: number;    // 解释清晰度 (0-1)
  };
  
  // 4. 性能指标
  performance: {
    executionTime: number;         // 执行时间（秒）
    iterations: number;            // 需要的迭代次数
    tokensUsed: number;           // 使用的 token 数
  };
}
```

### 难度等级定义

```typescript
enum DifficultyLevel {
  EASY = 'easy',           // 简单：单步操作，明确的输入输出
  MEDIUM = 'medium',       // 中等：需要 2-3 步，有一定复杂性
  HARD = 'hard',           // 困难：多步骤，需要领域知识
  EXPERT = 'expert'        // 专家：端到端流程，需要决策
}
```

---

## 🧪 测试数据集准备

### 推荐的测试数据集

```typescript
const testDatasets = {
  // 1. 销售数据
  sales: {
    filename: 'sales.csv',
    columns: ['date', 'product_id', 'product_name', 'category', 'quantity', 'price', 'total', 'region'],
    rows: 1000,
    features: '包含时间序列、分类、数值数据'
  },
  
  // 2. 客户数据
  customers: {
    filename: 'customers.csv',
    columns: ['customer_id', 'name', 'age', 'gender', 'city', 'signup_date', 'total_spent'],
    rows: 500,
    features: '包含人口统计学数据'
  },
  
  // 3. 库存数据
  inventory: {
    filename: 'inventory.csv',
    columns: ['product_id', 'warehouse', 'stock_level', 'reorder_point', 'last_updated'],
    rows: 200,
    features: '库存管理相关'
  },
  
  // 4. 时间序列数据
  timeseries: {
    filename: 'timeseries.csv',
    columns: ['date', 'value', 'category'],
    rows: 365,
    features: '每日数据，有季节性'
  },
  
  // 5. 文本数据
  reviews: {
    filename: 'reviews.csv',
    columns: ['review_id', 'product_id', 'rating', 'review_text', 'date'],
    rows: 1000,
    features: '产品评论文本'
  },
  
  // 6. 音频数据
  audio: {
    filename: 'audio.mp3',
    duration: '3:45',
    format: 'MP3, 320kbps',
    features: '测试音频处理功能'
  },
  
  // 7. 视频数据
  video: {
    filename: 'video.mp4',
    duration: '2:30',
    resolution: '1920x1080',
    fps: 30,
    features: '测试视频处理功能'
  },
  
  // 8. 字幕数据
  subtitle: {
    filename: 'subtitle.srt',
    format: 'SRT',
    features: '字幕文件用于视频处理'
  }
};
```

---

## 🎯 使用示例

### 示例 1: 运行单个查询评测

```typescript
import { CodeInterpreterSession, File } from '../sandbox-agent';

async function runEvaluation(query: any) {
  const session = new CodeInterpreterSession({ verbose: true });
  
  try {
    await session.start();
    console.log(`Testing: ${query.description}`);
    
    // 加载文件（如果需要）
    const files = query.file 
      ? [File.fromPath(`./test-data/${query.file}`)]
      : [];
    
    // 执行查询
    const startTime = Date.now();
    const response = await session.generateResponse(query.input, files);
    const executionTime = Date.now() - startTime;
    
    // 评估结果
    const evaluation = {
      query: query.description,
      success: response.files.length > 0 || response.content.length > 0,
      executionTime,
      outputFiles: response.files.map(f => f.name),
      codeExecuted: response.codeLog.length,
    };
    
    console.log('Evaluation Result:', evaluation);
    return evaluation;
    
  } finally {
    await session.stop();
  }
}

// 运行评测
runEvaluation(query1);
```

### 示例 2: 批量运行评测集

```typescript
async function runBatchEvaluation(queries: any[]) {
  const results = [];
  
  for (const query of queries) {
    try {
      const result = await runEvaluation(query);
      results.push({ query: query.description, ...result });
    } catch (error) {
      results.push({ 
        query: query.description, 
        error: error.message,
        success: false 
      });
    }
  }
  
  // 生成评测报告
  const report = {
    totalQueries: queries.length,
    successCount: results.filter(r => r.success).length,
    failureCount: results.filter(r => !r.success).length,
    averageTime: results.reduce((sum, r) => sum + (r.executionTime || 0), 0) / results.length,
    details: results
  };
  
  console.log('Batch Evaluation Report:', report);
  return report;
}
```

### 示例 3: 音视频处理任务

```typescript
import { CodeInterpreterSession, File } from '../sandbox-agent';

async function processVideoWithAudio() {
  const session = new CodeInterpreterSession({ verbose: true });
  
  try {
    await session.start();
    
    // 加载视频和音频文件
    const videoFile = File.fromPath('./test-data/video.mp4');
    const audioFile = File.fromPath('./test-data/background_music.mp3');
    
    // 执行音视频合成任务
    const response = await session.generateResponse(
      '将 background_music.mp3 添加到 video.mp4 中作为背景音乐，混合音量比例为 70%(原音频) : 30%(背景音乐)',
      [videoFile, audioFile]
    );
    
    // 保存输出的视频文件
    for (const file of response.files) {
      await file.save('./output/');
      console.log(`Saved: ${file.name}`);
    }
    
    console.log('Video processing completed!');
    
  } finally {
    await session.stop();
  }
}

// 运行示例
processVideoWithAudio();
```

### 示例 4: 浏览器自动化获取字幕

```typescript
import { CodeInterpreterSession } from '../sandbox-agent';

async function fetchVideoSubtitles() {
  const session = new CodeInterpreterSession({ 
    verbose: true,
    // 启用网络访问
    enableNetwork: true 
  });
  
  try {
    await session.start();
    
    // 从 YouTube 获取字幕
    const response = await session.generateResponse(
      '从 YouTube 视频 https://www.youtube.com/watch?v=dQw4w9WgXcQ 中提取英文字幕，保存为 subtitle.srt'
    );
    
    // 检查是否成功获取字幕
    const subtitleFile = response.files.find(f => f.name.endsWith('.srt'));
    if (subtitleFile) {
      await subtitleFile.save('./subtitles/');
      console.log('Subtitle downloaded successfully!');
      console.log('Content preview:', subtitleFile.content.slice(0, 200));
    }
    
  } finally {
    await session.stop();
  }
}

// 运行示例
fetchVideoSubtitles();
```

### 示例 5: 综合任务 - 视频制作流程

```typescript
import { CodeInterpreterSession, File } from '../sandbox-agent';

async function createVideoCompilation() {
  const session = new CodeInterpreterSession({ 
    verbose: true,
    enableNetwork: true,
    timeout: 300000 // 5 分钟超时
  });
  
  try {
    await session.start();
    
    // Step 1: 获取视频字幕
    console.log('Step 1: Fetching subtitles...');
    await session.generateResponse(
      '从 B 站视频 https://www.bilibili.com/video/BV1xx411c7mD 获取字幕，保存为 bilibili_subtitle.srt'
    );
    
    // Step 2: 拼接本地视频
    console.log('Step 2: Concatenating videos...');
    const clip1 = File.fromPath('./clips/clip1.mp4');
    const clip2 = File.fromPath('./clips/clip2.mp4');
    const clip3 = File.fromPath('./clips/clip3.mp4');
    
    await session.generateResponse(
      '将 clip1.mp4、clip2.mp4、clip3.mp4 拼接，在连接处添加淡入淡出转场效果',
      [clip1, clip2, clip3]
    );
    
    // Step 3: 添加背景音乐
    console.log('Step 3: Adding background music...');
    const music = File.fromPath('./audio/background.mp3');
    
    const finalResponse = await session.generateResponse(
      '为拼接好的视频添加背景音乐，音量调整为 30%',
      [music]
    );
    
    // 保存最终视频
    for (const file of finalResponse.files) {
      if (file.name.endsWith('.mp4')) {
        await file.save('./output/final_video.mp4');
        console.log('Final video saved!');
      }
    }
    
  } catch (error) {
    console.error('Error in video compilation:', error);
  } finally {
    await session.stop();
  }
}

// 运行综合示例
createVideoCompilation();
```

---

## 📊 评测指标汇总

### 关键指标

1. **成功率** (Success Rate): 成功完成的查询 / 总查询数
2. **平均执行时间** (Average Execution Time): 所有查询的平均时间
3. **代码执行成功率** (Code Success Rate): 代码无错误执行的比例
4. **输出完整性** (Output Completeness): 生成预期输出的比例
5. **按难度的表现** (Performance by Difficulty): 各难度级别的成功率

### 评测报告模板

```markdown
# Sandbox Agent Evaluation Report

## Summary
- Total Queries: 102
- Success Rate: 85%
- Average Execution Time: 18.2s
- Total Files Generated: 180+

## By Difficulty
- Easy (18 queries): 95% success
- Medium (38 queries): 90% success  
- Hard (32 queries): 82% success
- Expert (14 queries): 68% success

## By Category
- Data Analysis: 90%
- Visualization: 85%
- File Processing: 92%
- Machine Learning: 70%
- Complex Tasks: 65%
- Audio/Video Processing: 80%
- Browser Automation: 75%
- MCP Tool Integration: 88%
- Media + Browser Integration: 70%
- Frontend Web Development: 82%

## New Category Highlights

### MCP Tool Integration (88% success)
- ✅ 按需工具加载和发现
- ✅ 大数据跨服务传输（节省 token）
- ✅ 隐私保护的 PII 数据处理
- ⚠️ 复杂的多源数据融合需要更多优化

### Frontend Web Development (82% success)
- ✅ 简单的数据可视化网页（95% success）
- ✅ React/Vue 单页应用（85% success）
- ✅ 交互式数据仪表板（80% success）
- ⚠️ 复杂的 SSR 应用和实时协作功能需要更多测试

## Failed Queries
1. Query 26 - Time series forecast: Timeout
2. Query 36 - Stock data: Network error
3. Query 38 - End-to-end pipeline: Incomplete output
4. Query 61 - Bilibili subtitle: Anti-crawler issue
5. Query 79 - Podcast analysis: Whisper model loading timeout
6. Query 92 - Real-time monitoring: WebSocket connection timeout
7. Query 99 - Multi-language website: SSR environment setup failed

## Performance Improvements with MCP
- Average token usage reduced by 85% for MCP-based queries
- Privacy-preserving operations: 100% PII data protection
- Tool loading time: 3.2s → 0.4s (87.5% improvement)
```

---

## 🚀 快速开始

```bash
# 1. 准备测试数据
mkdir test-data
# 将测试 CSV 文件放入 test-data 目录

# 2. 运行评测
npx tsx evaluation-runner.ts

# 3. 查看结果
cat evaluation-report.json
```

---

## 📚 扩展阅读

- [Sandbox Agent Documentation](../README.md)
- [Code Execution with MCP - Anthropic 文章总结](./MCP_CODE_EXECUTION.md)
- [测试数据生成脚本](./generate-test-data.ts)
- [评测结果分析工具](./analyze-results.ts)
- [MCP 官方文档](https://modelcontextprotocol.io/)
- [Claude Skills 文档](https://docs.claude.com/en/docs/agents-and-tools/agent-skills/overview)

---

**最后更新**: 2025-11-07  
**查询总数**: 102  
**覆盖类别**: 15

### 新增类别（基于 MCP 和前端开发扩展）

#### 13. MCP 工具集成类 (8 queries)
基于 Anthropic 的 MCP 代码执行最佳实践，通过代码环境调用 MCP 工具，实现高效的工具集成和数据处理。

**核心优势**:
- Token 节省高达 98%+
- 隐私保护（PII 数据不经过模型）
- 状态持久化和技能复用
- 按需加载工具定义

#### 15. 前端网页开发类 (14 queries)
在沙盒环境中创建完整的前端应用，支持多文件项目、端口暴露和外部访问。

**核心能力**:
- 现代前端框架（React, Vue, Next.js 等）
- 数据可视化和交互式应用
- 与沙盒数据无缝集成
- 外部用户可访问

## 📦 依赖库说明

### 音视频处理库

```bash
# Python 音视频处理库
pip install moviepy          # 视频编辑
pip install pydub            # 音频处理
pip install ffmpeg-python    # FFmpeg Python 绑定
pip install librosa          # 音频分析
pip install soundfile        # 音频读写
pip install noisereduce      # 音频降噪
pip install pyrubberband     # 音频时间拉伸和音高变换
pip install pyloudnorm       # 音频响度标准化
pip install opencv-python    # 视频帧处理
pip install imageio          # 图像和视频 IO
pip install scipy            # 科学计算（音频信号处理）
```

### 浏览器自动化库

```bash
# Python 浏览器自动化库
pip install playwright              # 浏览器自动化框架
pip install browser-use             # 高级浏览器自动化
pip install beautifulsoup4          # HTML 解析
pip install selenium                # 备用浏览器自动化工具
pip install youtube-transcript-api  # YouTube 字幕 API

# 安装 Playwright 浏览器
playwright install chromium
```

### 可选高级功能

```bash
# 语音识别（如果需要）
pip install openai-whisper   # OpenAI Whisper 语音识别

# 视频分析
pip install torch torchvision  # 深度学习框架（如需视频内容分析）
```

### 前端开发相关工具

```bash
# Node.js 和包管理器（沙盒环境通常已安装）
node --version  # 验证 Node.js
npm --version   # 验证 npm
# 或使用 pnpm/yarn

# 前端框架和构建工具
npm install -g vite           # 快速的前端构建工具
npm install -g create-react-app  # React 脚手架
npm install -g @vue/cli       # Vue CLI
npm install -g create-next-app   # Next.js 脚手架

# 常用前端库（项目级安装）
npm install react react-dom
npm install vue
npm install chart.js recharts echarts  # 图表库
npm install axios               # HTTP 客户端
npm install tailwindcss        # CSS 框架
npm install antd element-plus  # UI 组件库
```

### MCP 相关工具

```bash
# MCP Python SDK
pip install mcp

# MCP TypeScript/JavaScript SDK
npm install @modelcontextprotocol/sdk

# 常用 MCP 服务器
npm install -g @modelcontextprotocol/server-gdrive
npm install -g @modelcontextprotocol/server-slack
npm install -g @modelcontextprotocol/server-salesforce
```

### 开发服务器配置要点

```python
# Python HTTP 服务器（用于静态文件）
# 确保监听 0.0.0.0 以便外部访问
python -m http.server 8000 --bind 0.0.0.0

# Flask 服务器配置
app.run(host='0.0.0.0', port=5000)

# FastAPI 服务器配置
uvicorn main:app --host 0.0.0.0 --port 8000
```

```javascript
// Node.js Express 服务器配置
app.listen(3000, '0.0.0.0', () => {
  console.log('Server running on port 3000');
});

// Vite 开发服务器配置（vite.config.js）
export default {
  server: {
    host: '0.0.0.0',  // 允许外部访问
    port: 3000
  }
}
```
