/**
 * Comprehensive prompt examples for variable extraction testing and reference
 * Organized by scenario and complexity level
 */

// Examples for variable extraction (buildUnifiedPrompt)
export const VARIABLE_EXTRACTION_EXAMPLES = `## Variable Extraction Reference Examples

### Product Hunt Aggregation Examples

#### Complex PH Top 10 Aggregation and Publishing
**Original Prompt**: 帮我抓取 Product Hunt 今日的 Top 10产品数据（产品名、一句话描述、产品介绍、数据表现「votes数 comment数」、maker 团队信息、网站链接等、产品官网截图），如果产品的 maker 有留 LinkedIn 链接则从 LinkedIn 公开Profile 中总结他的当前职位与过往工作、教育经历。将这些内容整理成为适合公众号发表的文章，一个美观漂亮的中文可视化网页，以及一个音频播客；将上述三个产物的链接总结成一条清楚的消息，发送到我的邮箱
信息源：{{target_date}} 
抓取内容：{{date_content}} 
输出格式：{{generate_content}} 
邮箱： {{email_to}}

**Extracted Variables**:
- target_date (string): 信息源日期
- date_content (string): 抓取内容范围/描述
- generate_content (string): 产出格式与形态
- email_to (string): 接收邮箱

**Processed Prompt**: 请抓取 Product Hunt 今日的 Top 10 产品数据（产品名、一句话描述、产品介绍、数据表现「votes数、comment数」、maker 团队信息、网站链接、产品官网截图）。若发现 maker 留有 LinkedIn 链接，请基于公开 Profile 总结其当前职位与过往工作、教育经历。把以上内容整理为适合公众号发表的文章、一页美观的中文可视化网页、以及一段音频播客；并将三者链接汇总为一条清晰消息发送至 {{email_to}}。
信息源：{{target_date}} 
抓取内容：{{date_content}} 
输出格式：{{generate_content}}

### Travel Planning Examples

#### Complex Travel Planning
**Original Prompt**: 我计划端午去济州岛的偶来小路徒步，5月29号晚上杭州飞济州岛，5月30/31，6月1号2号四天徒步，想要获取100km证书，喜欢在海边徒步，请你帮我做规划（每天的徒步路线，住宿和饮食，以及装备）。以下信息同步给你： 1.我之前徒步每天早8点到晚上7点徒步，这个强度感觉不是很累，可以接受； 2.可以连续多日徒步；3.住宿期望单间，环境安静，条件好一些；4.饮食喜欢吃海鲜；5.节奏比较悠闲，最好有超美的风景拍照点；6.计划21和1号线一天， 5号线和6号线一天，7号线和8号线一天，9号线和10号线号线一天，帮我做一下规划（每天的起始点，住宿的酒店，吃饭的地方，路上的美景

**Extracted Variables**:
- destination (string): 济州岛 - Travel destination
- dates (string): 5月29号-6月2号 - Travel dates  
- departure_city (string): 杭州 - Departure city
- goal (string): 获取100km证书 - Travel goal
- accommodation (string): 单间，环境安静，条件好 - Accommodation preference
- food (string): 海鲜 - Food preference
- pace (string): 悠闲 - Travel pace
- daily_routes (string): 21和1号线一天，5号线和6号线一天，7号线和8号线一天，9号线和10号线一天 - Daily hiking routes

**Processed Prompt**: 我计划从 {{departure_city}} 出发，在 {{dates}} 前往 {{destination}}，目标是 {{goal}}。住宿选择 {{accommodation}}，饮食以 {{food}} 为主，希望保持 {{pace}} 的节奏。每天会按照规划的路线：{{daily_routes}}。

#### Simple Travel Planning
**Original Prompt**: 今年国庆想去马尔代夫潜水，大概5天，预算1万，想住水屋，最好能安排浮潜和出海。

**Extracted Variables**:
- destination (string): 马尔代夫 - Travel destination
- dates (string): 国庆 - Travel dates
- duration_days (string): 5天 - Travel duration
- budget (string): 1万 - Budget
- accommodation (string): 水屋 - Accommodation type
- activities (string): 潜水、浮潜、出海 - Planned activities

**Processed Prompt**: 今年{{dates}}想去{{destination}}{{activities}}，大概{{duration_days}}，预算{{budget}}，想住{{accommodation}}。

### Writing Task Examples

#### Simple Writing Task
**Original Prompt**: 帮我写一篇LinkedIn帖子，主题是AI对产品经理的影响，要简短、有洞见，目标读者是海外的产品经理。

**Extracted Variables**:
- topic (string): AI对产品经理的影响 - Article topic
- platform (string): LinkedIn - Publishing platform
- audience (string): 海外的产品经理 - Target audience
- length (string): 简短 - Content length
- tone (option): 有洞见 - Writing tone

**Processed Prompt**: 帮我写一篇{{platform}}帖子，主题是{{topic}}，要{{length}}、{{tone}}，目标读者是{{audience}}。

### Video Creation Examples

#### Simple Video Creation
**Original Prompt**: 我想做一个短视频，内容是健身打卡，时长1分钟，配乐要动感，字幕只要中文。

**Extracted Variables**:
- topic (string): 健身打卡 - Video topic
- duration (string): 1分钟 - Video duration
- style (option): 实拍 - Video style
- music (string): 动感配乐 - Background music
- subtitle (string): 中文 - Subtitle language

**Processed Prompt**: 我想做一个短视频，内容是{{topic}}，时长{{duration}}，配乐要{{music}}，字幕只要{{subtitle}}。

### Data Analysis Examples

#### Simple Data Analysis
**Original Prompt**: 请帮我分析一下我们Q2的销售数据，重点对比Q1和Q2的GMV变化，输出一份带图表的简报。

**Extracted Variables**:
- data_file (resource): Q2销售数据 - Data source file
- timeframe (string): Q1和Q2 - Analysis timeframe
- metrics (string): GMV变化 - Key metrics to analyze
- deliverable (string): 带图表的简报 - Expected output format

**Processed Prompt**: 请帮我分析一下我们{{data_file}}，重点对比{{timeframe}}的{{metrics}}，输出一份{{deliverable}}。

### Health Plan Examples

#### Simple Health Plan
**Original Prompt**: 我想要一个减脂的饮食和运动计划，早餐可以吃燕麦，中午鸡胸肉，运动每周跑步3次，每次30分钟。

**Extracted Variables**:
- goal (string): 减脂 - Health goal
- diet (string): 早餐燕麦，中午鸡胸肉 - Diet plan
- exercise (string): 跑步 - Exercise type
- frequency (string): 每周3次 - Exercise frequency
- duration (string): 每次30分钟 - Exercise duration

**Processed Prompt**: 我想要一个{{goal}}的{{diet}}，运动{{frequency}}{{exercise}}，{{duration}}。

## Variable Extraction Guidelines

### Key Principles for Variable Extraction:

1. **Entity Identification**: 
   - Identify specific values that can be parameterized
   - Distinguish between fixed content and variable content
   - Focus on user preferences, requirements, and specifications

2. **Variable Classification**:
   - string: Text content, preferences, descriptions
   - resource: Files, data sources, uploads
   - option: Limited choices, style preferences

3. **Template Construction**:
   - Replace specific values with {{variable_name}} placeholders
   - Maintain original semantic meaning
   - Ensure template readability and practicality

4. **Variable Naming**:
   - Use descriptive English names in snake_case format
   - Names should be self-explanatory and concise
   - Avoid conflicts with existing variable names`;

// Examples for APP publishing template generation (buildAppPublishPrompt)
export const APP_PUBLISH_EXAMPLES = `## APP Publishing Template Reference Examples

### Product Hunt Aggregation Examples

#### Complex PH Top 10 Aggregation and Publishing
**Original Prompt**: 帮我抓取 Product Hunt 今日的 Top 10产品数据（产品名、一句话描述、产品介绍、数据表现「votes数 comment数」、maker 团队信息、网站链接等、产品官网截图），如果产品的 maker 有留 LinkedIn 链接则从 LinkedIn 公开Profile 中总结他的当前职位与过往工作、教育经历。将这些内容整理成为适合公众号发表的文章，一个美观漂亮的中文可视化网页，以及一个音频播客；将上述三个产物的链接总结成一条清楚的消息，发送到我的邮箱
信息源：{{target_date}} 
抓取内容：{{date_content}} 
输出格式：{{generate_content}} 
邮箱： {{email_to}}

**Extracted Variables**:
- target_date (string): 信息源日期
- date_content (string): 抓取内容范围/描述
- generate_content (string): 产出格式与形态
- email_to (string): 接收邮箱

**Workflow Publishing Template String**: 我将基于 {{target_date}} 的 Product Hunt 榜单抓取 Top 10 产品，覆盖 {{date_content}}（包含产品名、一句话描述、产品介绍、votes 数、comment 数、maker 团队信息、网站链接、产品官网截图，并在可用时基于 LinkedIn 公开 Profile 总结 maker 的当前职位与过往工作、教育经历）。随后产出三类内容：适合公众号发表的文章、一页美观的中文可视化网页、以及音频播客。完成后会把三者链接汇总为一条清晰消息并发送到 {{email_to}}。产出形态要求：{{generate_content}}。

### Travel Planning Examples

#### Complex Travel Planning
**Original Prompt**: 我计划端午去济州岛的偶来小路徒步，5月29号晚上杭州飞济州岛，5月30/31，6月1号2号四天徒步，想要获取100km证书，喜欢在海边徒步，请你帮我做规划（每天的徒步路线，住宿和饮食，以及装备）。以下信息同步给你： 1.我之前徒步每天早8点到晚上7点徒步，这个强度感觉不是很累，可以接受； 2.可以连续多日徒步；3.住宿期望单间，环境安静，条件好一些；4.饮食喜欢吃海鲜；5.节奏比较悠闲，最好有超美的风景拍照点；6.计划21和1号线一天， 5号线和6号线一天，7号线和8号线一天，9号线和10号线号线一天，帮我做一下规划（每天的起始点，住宿的酒店，吃饭的地方，路上的美景

**Extracted Variables**:
- destination (string): 济州岛 - Travel destination
- dates (string): 5月29号-6月2号 - Travel dates  
- departure_city (string): 杭州 - Departure city
- goal (string): 获取100km证书 - Travel goal
- accommodation (string): 单间，环境安静，条件好 - Accommodation preference
- food (string): 海鲜 - Food preference
- pace (string): 悠闲 - Travel pace
- daily_routes (string): 21和1号线一天，5号线和6号线一天，7号线和8号线一天，9号线和10号线一天 - Daily hiking routes

**Workflow Publishing Template String**: 我计划从 {{departure_city}} 出发，在 {{dates}} 前往 {{destination}}，目标是 {{goal}}。住宿选择 {{accommodation}}，饮食以 {{food}} 为主，希望保持 {{pace}} 的节奏。每天会按照规划的路线：{{daily_routes}}。

#### Simple Travel Planning
**Original Prompt**: 今年国庆想去马尔代夫潜水，大概5天，预算1万，想住水屋，最好能安排浮潜和出海。

**Extracted Variables**:
- destination (string): 马尔代夫 - Travel destination
- dates (string): 国庆 - Travel dates
- duration_days (string): 5天 - Travel duration
- budget (string): 1万 - Budget
- accommodation (string): 水屋 - Accommodation type
- activities (string): 潜水、浮潜、出海 - Planned activities

**Workflow Publishing Template String**: 这次旅程的目的地是 {{destination}}，时间定在 {{dates}}，共 {{duration_days}} 天，预算为 {{budget}}。住宿安排在 {{accommodation}}，活动包括 {{activities}}。

#### Complex Travel Planning (Extended)
**Original Prompt**: 我打算今年10月去马尔代夫度假，行程大概6天，预算一个人1.2万左右。希望能住2晚水屋、2晚沙滩别墅，重点体验浮潜和看海豚。如果能安排1天出海钓鱼更好。最好推荐拍照好看的海滩和日落观景点。

**Extracted Variables**:
- destination (string): 马尔代夫 - Travel destination
- dates (string): 今年10月 - Travel dates
- duration_days (string): 6天 - Travel duration
- budget (string): 1.2万 - Budget
- accommodation (string): 2晚水屋、2晚沙滩别墅 - Accommodation details
- activities (string): 浮潜、看海豚、出海钓鱼 - Planned activities

**Workflow Publishing Template String**: 我将在 {{dates}} 前往 {{destination}}，行程为 {{duration_days}} 天，预算约 {{budget}}。期间会住在 {{accommodation}}，并安排了 {{activities}} 等活动。

### Writing Task Examples

#### Simple Writing Task
**Original Prompt**: 帮我写一篇LinkedIn帖子，主题是AI对产品经理的影响，要简短、有洞见，目标读者是海外的产品经理。

**Extracted Variables**:
- topic (string): AI对产品经理的影响 - Article topic
- platform (string): LinkedIn - Publishing platform
- audience (string): 海外的产品经理 - Target audience
- length (string): 简短 - Content length
- tone (option): 有洞见 - Writing tone

**Workflow Publishing Template String**: 我计划创作一篇关于 {{topic}} 的内容，发布在 {{platform}} 平台，读者群体是 {{audience}}。文章长度为 {{length}}，语气保持 {{tone}}。

#### Complex Writing Task
**Original Prompt**: 帮我写一篇微信公众号文章，主题是"AI如何改变产品经理的工作方式"。文章长度大概2000字，语气希望专业但要有故事感，不要死板。目标读者是互联网行业的年轻从业者，希望能加入真实案例，比如AI在需求分析和用户调研里的应用。

**Extracted Variables**:
- topic (string): AI如何改变产品经理的工作方式 - Article topic
- platform (string): 微信公众号 - Publishing platform
- audience (string): 互联网行业的年轻从业者 - Target audience
- length (string): 2000字 - Content length
- tone (string): 专业但要有故事感，不要死板 - Writing tone

**Workflow Publishing Template String**: 这次的内容主题是 {{topic}}，发布平台是 {{platform}}，主要面向 {{audience}}。我计划写 {{length}} 字左右，语气倾向于 {{tone}}。

### Video Creation Examples

#### Simple Video Creation
**Original Prompt**: 我想做一个短视频，内容是健身打卡，时长1分钟，配乐要动感，字幕只要中文。

**Extracted Variables**:
- topic (string): 健身打卡 - Video topic
- duration (string): 1分钟 - Video duration
- style (option): 实拍 - Video style
- music (string): 动感配乐 - Background music
- subtitle (string): 中文 - Subtitle language

**Workflow Publishing Template String**: 我准备制作一个以 {{topic}} 为主题的视频，时长大约 {{duration}}，整体风格为 {{style}}。配乐选用 {{music}}，并添加 {{subtitle}} 字幕。

#### Complex Video Creation
**Original Prompt**: 我想做一个短视频，主题是"重庆夜景"，时长控制在90秒左右。画面风格要快节奏、有冲击力，最好用电子音乐。开头希望是解放碑航拍，字幕要有中英文双语，结尾有一句口号"山城不夜天"。

**Extracted Variables**:
- topic (string): 重庆夜景 - Video topic
- duration (string): 90秒 - Video duration
- style (string): 快节奏、有冲击力 - Video style
- music (string): 电子音乐 - Background music
- subtitle (string): 中英文双语 - Subtitle language

**Workflow Publishing Template String**: 这个视频的主题是 {{topic}}，时长 {{duration}}，风格上更偏向 {{style}}。会搭配 {{music}} 作为背景音乐，并加上 {{subtitle}}。

### Data Analysis Examples

#### Simple Data Analysis
**Original Prompt**: 请帮我分析一下我们Q2的销售数据，重点对比Q1和Q2的GMV变化，输出一份带图表的简报。

**Extracted Variables**:
- data_file (resource): Q2销售数据 - Data source file
- timeframe (string): Q1和Q2 - Analysis timeframe
- metrics (string): GMV变化 - Key metrics to analyze
- deliverable (string): 带图表的简报 - Expected output format

**Workflow Publishing Template String**: 我需要基于 {{data_file}}（资源）在 {{timeframe}} 期间，分析 {{metrics}}，并最终产出 {{deliverable}}。

#### Complex Data Analysis
**Original Prompt**: 请帮我分析我们电商平台Q2的销售数据，重点对比Q1和Q2的GMV变化，并拆分到各个品类。最好输出带图表的简报，指出增长最快的前3个品类和下滑最大的前2个品类。最后给2条优化建议。

**Extracted Variables**:
- data_file (resource): 电商平台Q2销售数据 - Data source file
- timeframe (string): Q1和Q2 - Analysis timeframe
- metrics (string): GMV变化、品类拆分、增长最快前3个品类、下滑最大前2个品类 - Key metrics to analyze
- deliverable (string): 带图表的简报、2条优化建议 - Expected output format

**Workflow Publishing Template String**: 这次的数据分析将使用 {{data_file}}（资源），聚焦 {{timeframe}} 的时间段，关注 {{metrics}}，并生成 {{deliverable}}。

### Health Plan Examples

#### Simple Health Plan
**Original Prompt**: 我想要一个减脂的饮食和运动计划，早餐可以吃燕麦，中午鸡胸肉，运动每周跑步3次，每次30分钟。

**Extracted Variables**:
- goal (string): 减脂 - Health goal
- diet (string): 早餐燕麦，中午鸡胸肉 - Diet plan
- exercise (string): 跑步 - Exercise type
- frequency (string): 每周3次 - Exercise frequency
- duration (string): 每次30分钟 - Exercise duration

**Workflow Publishing Template String**: 我设定的目标是 {{goal}}，饮食方案为 {{diet}}，运动计划是 {{exercise}}，每周频率为 {{frequency}}，单次时长 {{duration}}。

#### Complex Health Plan
**Original Prompt**: 我最近开始健身，目标是减脂+保持肌肉，想要一份饮食和运动计划。早餐我喜欢吃燕麦和鸡蛋，中午能接受鸡胸肉或牛肉，晚上最好清淡一些。每周安排3次跑步，每次30分钟，外加2次力量训练，器械为主。希望计划能兼顾减脂和肌肉维持，饮食最好简单易做。

**Extracted Variables**:
- goal (string): 减脂+保持肌肉 - Health goal
- diet (string): 早餐燕麦和鸡蛋，中午鸡胸肉或牛肉，晚上清淡 - Diet plan
- exercise (string): 3次跑步，2次力量训练 - Exercise plan
- frequency (string): 每周5次 - Exercise frequency
- duration (string): 跑步每次30分钟 - Exercise duration
- preference (string): 器械为主，简单易做 - Exercise and diet preferences

**Workflow Publishing Template String**: 为了达成 {{goal}}，我会结合 {{diet}} 的饮食习惯与 {{exercise}} 的运动安排，频率是 {{frequency}}，每次运动持续 {{duration}}。运动方式上我更喜欢 {{preference}}。

## Template String Generation Guidelines

### Key Principles for Workflow Publishing Template Strings:

1. **Natural Language Flow**: 
   - Use conversational, helpful tone
   - Start with action-oriented phrases like "I'll help you..." or "I'll create..."
   - Maintain the original user intent and goals

2. **Variable Integration**:
   - Replace all specific values with {{variable_name}} placeholders
   - Ensure every extracted variable is represented
   - Use descriptive variable names that are self-explanatory

3. **Completeness**:
   - Templates should be self-contained and complete
   - Users should understand the entire workflow from the template
   - Include all necessary context and requirements

4. **User Experience**:
   - Focus on benefits and outcomes
   - Avoid technical jargon
   - Provide clear guidance on what users need to provide
   - Maintain professional yet approachable language

### Template String Quality Checklist:
- [ ] All extracted variables are represented with {{variable_name}} placeholders
- [ ] Template maintains original user intent and goals
- [ ] Language is natural and conversational
- [ ] Template is self-contained and complete
- [ ] No technical jargon or complex terminology
- [ ] Clear indication of what the workflow will accomplish
- [ ] Professional yet approachable tone`;
