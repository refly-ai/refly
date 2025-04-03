export interface Artifact {
  id: string;
  title: {
    'zh-CN': string;
    en: string;
  };
  description?: {
    'zh-CN': string;
    en: string;
  };
  coverImage: string;
  type: 'canvas' | 'code' | 'answer' | 'doc';
  author?: string;
  authorEmail?: string;
  url: string;
}

export const artifactGalleryData: Artifact[] = [
  {
    id: '1',
    title: {
      'zh-CN': 'PPT 自动生成：轻松掌握 MCP 协议',
      en: 'Automatic PPT Generation: Master MCP Protocol Effortlessly',
    },
    description: {
      'zh-CN': '无需手动制作，一键生成专业 PPT，加速 MCP 协议学习。',
      en: 'Generate professional PPT with one click, accelerate MCP protocol learning without manual effort.',
    },
    coverImage: 'https://static.refly.ai/artifact-cover/mcp-ppt.webp',
    type: 'canvas',
    author: 'kavan',
    authorEmail: 'alex****dev',
    url: 'https://refly.ai/share/code/cod-flv5cjcmzftvrkqvicokfpu5',
  },
  {
    id: '2',
    title: {
      'zh-CN': '可视化网页：生动解读 MCP 协议奥秘',
      en: 'Visual Webpage: Dynamic Interpretation of MCP Protocol',
    },
    description: {
      'zh-CN': '告别枯燥文档，交互式网页让 MCP 协议概念一目了然。',
      en: 'Say goodbye to boring documentation, interactive webpage makes MCP protocol concepts crystal clear.',
    },
    coverImage: 'https://static.refly.ai/artifact-cover/mcp-website.webp',
    type: 'canvas',
    author: 'roxa',
    authorEmail: 'sara****web',
    url: 'https://refly.ai/share/code/cod-f2xpysxkpb8ovn5751koanxo',
  },
  {
    id: '3',
    title: {
      'zh-CN': 'AI 助教：讲师课程知识体系一键搭建',
      en: 'AI Teaching Assistant: One-Click Course Knowledge System Building',
    },
    description: {
      'zh-CN': '告别繁琐的手动整理，AI 智能构建课程知识框架，提升教学效率。',
      en: 'Say goodbye to tedious manual organization, AI intelligently builds course knowledge framework to improve teaching efficiency.',
    },
    coverImage: 'https://static.refly.ai/artifact-cover/course-outline.webp',
    type: 'code',
    author: '142',
    authorEmail: 'mike****pro',
    url: 'https://refly.ai/share/code/cod-eiuua6fou3aci24dn0ljxzme',
  },
  {
    id: '4',
    title: {
      'zh-CN': 'AI 互动小学数学辅导：趣味练习，爱上数学',
      en: 'AI Interactive Math Tutoring: Fun Practice, Love Math',
    },
    description: {
      'zh-CN': '寓教于乐，AI 驱动的互动问答，让孩子在游戏中爱上数学，提升成绩。',
      en: 'Learning through play, AI-driven interactive Q&A helps children love math through games and improve grades.',
    },
    coverImage: 'https://static.refly.ai/artifact-cover/math-qa.webp',
    type: 'doc',
    author: 'tin',
    authorEmail: 'john****edu',
    url: 'https://refly.ai/share/code/cod-i2nti1w421d7akwlyjgmyh2y',
  },
  {
    id: '5',
    title: {
      'zh-CN': '网页一键复刻：快速搭建活动页面',
      en: 'One-Click Webpage Clone: Quick Event Page Building',
    },
    description: {
      'zh-CN': '无需编码，输入链接即可快速复刻网页，高效搭建活动落地页。',
      en: 'No coding needed, quickly clone webpages by entering links, efficiently build event landing pages.',
    },
    coverImage: 'https://static.refly.ai/artifact-cover/copy-web.webp',
    type: 'canvas',
    author: 'je',
    authorEmail: 'emma****dev',
    url: 'https://refly.ai/share/code/cod-e2ufkvekg6ixndnombwamn9w',
  },
  {
    id: '6',
    title: {
      'zh-CN': 'AI 洞察：每日生成技术前沿日报',
      en: 'AI Insights: Daily Tech Frontier Report Generation',
    },
    description: {
      'zh-CN': '追踪最新 AI 技术动态，每日自动生成日报，洞悉行业趋势。',
      en: 'Track the latest AI technology trends, automatically generate daily reports, and gain industry insights.',
    },
    coverImage: 'https://static.refly.ai/artifact-cover/daily-report.webp',
    type: 'code',
    author: 'eric',
    authorEmail: 'ryan****tech',
    url: 'https://refly.ai/share/code/cod-mr4j3yq81l5g7sckv2l99nzt',
  },
  {
    id: '7',
    title: {
      'zh-CN': '文化传承新方式：沉浸式传统文化宣传网页',
      en: 'New Way of Cultural Heritage: Immersive Traditional Culture Promotion',
    },
    description: {
      'zh-CN': '打造精美互动网页，生动展现传统文化魅力，提升文化传播效果。',
      en: 'Create beautiful interactive webpages to vividly showcase traditional culture and enhance cultural communication.',
    },
    coverImage: 'https://static.refly.ai/artifact-cover/tr-pass.webp',
    type: 'canvas',
    author: 'eric',
    authorEmail: 'lisa****art',
    url: 'https://refly.ai/share/code/cod-g1vr8mdj0bzrec6zd6kgbqta',
  },
  {
    id: '8',
    title: {
      'zh-CN': '物理概念可视化：动态演示运动规律',
      en: 'Physics Concept Visualization: Dynamic Motion Law Demonstration',
    },
    description: {
      'zh-CN': '抽象物理概念不再难懂，可视化动画生动呈现运动规律，加深理解。',
      en: 'Abstract physics concepts made easy, visualization animations vividly present motion laws for deeper understanding.',
    },
    coverImage: 'https://static.refly.ai/artifact-cover/ph-vis.webp',
    type: 'doc',
    author: 'kate',
    authorEmail: 'mark****sci',
    url: 'https://refly.ai/share/code/cod-qfzt3v72625gvchj7py4y5d6',
  },
  {
    id: '9',
    title: {
      'zh-CN': 'AI 驱动产品分析：洞察用户需求',
      en: 'AI-Driven Product Analysis: User Needs Insights',
    },
    description: {
      'zh-CN': '快速分析海量数据，AI 助力产品经理洞察用户需求，优化产品策略。',
      en: 'Quickly analyze massive data, AI helps product managers understand user needs and optimize product strategies.',
    },
    coverImage: 'https://static.refly.ai/artifact-cover/product-analyais.webp',
    type: 'canvas',
    author: 'kate',
    authorEmail: 'dave****pm',
    url: 'https://refly.ai/share/code/cod-hobauraakn8v2ah3xbxlrdlq',
  },
  {
    id: '10',
    title: {
      'zh-CN': '手写字识别新突破：AI 模型精准高效',
      en: 'Handwriting Recognition Breakthrough: Precise AI Model',
    },
    description: {
      'zh-CN': '高精度 AI 模型，快速识别手写文字，应用场景广泛。',
      en: 'High-precision AI model for quick handwriting recognition with wide application scenarios.',
    },
    coverImage: 'https://static.refly.ai/artifact-cover/use-ai-model.webp',
    type: 'code',
    author: 'kate',
    authorEmail: 'jack****ai',
    url: 'https://refly.ai/share/code/cod-wbip3mto5ogaffg0scwjm4iy',
  },
  {
    id: '11',
    title: {
      'zh-CN': '神经网络可视化：揭秘 AI 黑盒',
      en: 'Neural Network Visualization: Unveiling AI Black Box',
    },
    description: {
      'zh-CN': '深入神经网络内部，可视化展现网络结构和运行机制，助力研究。',
      en: 'Dive into neural networks, visualize network structure and operation mechanisms to aid research.',
    },
    coverImage: 'https://static.refly.ai/artifact-cover/nn-vis.webp',
    type: 'canvas',
    author: 'kate',
    authorEmail: 'nina****ml',
    url: 'https://refly.ai/share/code/cod-hqkwth5o86zdnr71hq85q7i2',
  },
  {
    id: '12',
    title: {
      'zh-CN': '个性化学习：AI 自动生成强化学习课程',
      en: 'Personalized Learning: AI-Generated Reinforcement Learning Course',
    },
    description: {
      'zh-CN': '根据学习需求定制课程，AI 智能生成强化学习内容，提升学习效率。',
      en: 'Customize courses based on learning needs, AI generates reinforcement learning content to improve efficiency.',
    },
    coverImage: 'https://static.refly.ai/artifact-cover/ai-tutorial-rl.webp',
    type: 'canvas',
    author: 'kate',
    authorEmail: 'paul****rl',
    url: 'https://refly.ai/share/code/cod-l05zo0udoaptkav6shh4bstx',
  },
  {
    id: '13',
    title: {
      'zh-CN': 'Python 文档自动生成：告别繁琐撰写',
      en: 'Python Doc Auto-Generation: Goodbye to Tedious Writing',
    },
    description: {
      'zh-CN': '一键生成规范 Python 文档，节省开发者时间，提升开发效率。',
      en: 'One-click generation of standardized Python documentation, saving developer time and improving efficiency.',
    },
    coverImage: 'https://static.refly.ai/artifact-cover/doc-write.webp',
    type: 'code',
    author: 'kate',
    authorEmail: 'tony****py',
    url: 'https://refly.ai/share/code/cod-gtpds4grjof4ysb3z3cmghd9',
  },
  {
    id: '14',
    title: {
      'zh-CN': '创意无限：零代码生成专属像素游戏',
      en: 'Unlimited Creativity: No-Code Pixel Game Generation',
    },
    description: {
      'zh-CN': '无需编程，轻松创作个性化像素游戏，激发创意，快速实现游戏想法。',
      en: 'Create personalized pixel games without programming, spark creativity, and quickly realize game ideas.',
    },
    coverImage: 'https://static.refly.ai/artifact-cover/ai-game.webp',
    type: 'canvas',
    author: 'kate',
    authorEmail: 'zack****game',
    url: 'https://refly.ai/share/code/cod-q1wutasube20hy6zczchql8e',
  },
  {
    id: '15',
    title: {
      'zh-CN': '向量嵌入可视化：探索数据潜在关联',
      en: 'Vector Embedding Visualization: Explore Data Connections',
    },
    description: {
      'zh-CN': '抽象向量数据可视化呈现，发现数据间的隐藏关系，辅助数据分析决策。',
      en: 'Visualize abstract vector data to discover hidden relationships and support data analysis decisions.',
    },
    coverImage: 'https://static.refly.ai/artifact-cover/embedding-tutorial.webp',
    type: 'canvas',
    author: 'kate',
    authorEmail: 'lucy****viz',
    url: 'https://refly.ai/share/code/cod-rbunlh24m7x9g1s0uid3eddv',
  },
  {
    id: '16',
    title: {
      'zh-CN': 'AI 漫画师：快速生成个性化 2D 漫画',
      en: 'AI Comic Artist: Quick Personalized 2D Comic Generation',
    },
    description: {
      'zh-CN': '输入关键词，AI 快速生成 2D 漫画，助力内容创作，降低漫画制作门槛。',
      en: 'Input keywords for AI to quickly generate 2D comics, aid content creation, and lower comic production barriers.',
    },
    coverImage: 'https://static.refly.ai/artifact-cover/ai-comics.webp',
    type: 'canvas',
    author: 'kate',
    authorEmail: 'iris****art',
    url: 'https://refly.ai/share/code/cod-a440c46g6xxrwikr39v1iw33',
  },
  {
    id: '17',
    title: {
      'zh-CN': 'AI 著书：快速生成 Agent 技术入门指南',
      en: 'AI Book Writing: Quick Agent Technology Beginner Guide',
    },
    description: {
      'zh-CN': 'AI 辅助撰写书籍，高效生成 Agent 技术专业书籍，加速知识传播。',
      en: 'AI-assisted book writing, efficiently generate Agent technology professional books, accelerate knowledge sharing.',
    },
    coverImage: 'https://static.refly.ai/artifact-cover/ai-tutorial-agent.webp',
    type: 'doc',
    author: 'kate',
    authorEmail: 'owen****doc',
    url: 'https://refly.ai/share/code/cod-hoxaeo0dbqpsw8skn4say0hi',
  },
  {
    id: '18',
    title: {
      'zh-CN': 'AI 智能 SWOT 分析：洞察产品竞争优势',
      en: 'AI Smart SWOT Analysis: Product Competitive Advantage Insights',
    },
    description: {
      'zh-CN': '快速生成产品 SWOT 分析报告，助力企业全面了解自身优势与劣势，制定竞争策略。',
      en: 'Quickly generate product SWOT analysis reports, help enterprises understand strengths and weaknesses, develop competitive strategies.',
    },
    coverImage: 'https://static.refly.ai/artifact-cover/swot.webp',
    type: 'canvas',
    author: 'kate',
    authorEmail: 'adam****biz',
    url: 'https://refly.ai/share/code/cod-ylb450vj90kz7tdtw0q6jntb',
  },
  {
    id: '19',
    title: {
      'zh-CN': '操作系统可视化教程：轻松入门核心原理',
      en: 'OS Visualization Tutorial: Easy Core Principles Introduction',
    },
    description: {
      'zh-CN': '抽象操作系统原理可视化呈现，交互式学习教程，降低学习门槛，提升学习趣味性。',
      en: 'Visualize abstract OS principles, interactive learning tutorials, lower learning barriers, enhance learning interest.',
    },
    coverImage: 'https://static.refly.ai/artifact-cover/ai-tutorial-os.webp',
    type: 'canvas',
    author: 'kate',
    authorEmail: 'hugo****sys',
    url: 'https://refly.ai/share/code/cod-p42ssfnmqdqebth4v14ypr0r',
  },
  {
    id: '20',
    title: {
      'zh-CN': '音乐影响力分析：洞察音乐传播趋势',
      en: 'Music Impact Analysis: Music Spread Trend Insights',
    },
    description: {
      'zh-CN': '分析音乐传播数据，洞察音乐影响力，为音乐创作和推广提供数据支持。',
      en: 'Analyze music spread data, gain music influence insights, provide data support for music creation and promotion.',
    },
    coverImage: 'https://static.refly.ai/artifact-cover/music-pass.webp',
    type: 'canvas',
    author: 'kate',
    authorEmail: 'jazz****pro',
    url: 'https://refly.ai/share/code/cod-rvu9hnxoiclghwrw9k02hcs8',
  },
  {
    id: '21',
    title: {
      'zh-CN': '跨域技术难题解答：AI 专家在线',
      en: 'CORS Technical Solutions: AI Expert Online',
    },
    description: {
      'zh-CN': '解决复杂跨域技术问题，AI 智能问答系统，快速定位问题根源，提供解决方案。',
      en: 'Solve complex CORS technical issues, AI Q&A system quickly identifies root causes and provides solutions.',
    },
    coverImage: 'https://static.refly.ai/artifact-cover/cors-qna.webp',
    type: 'code',
    author: 'kate',
    authorEmail: 'dean****dev',
    url: 'https://refly.ai/share/code/cod-g8i2x9gg21eeyblpozhynq1r',
  },
  {
    id: '22',
    title: {
      'zh-CN': 'RAG 技术深度解读：对比分析，选型不愁',
      en: 'RAG Technology Deep Dive: Comparative Analysis for Easy Selection',
    },
    description: {
      'zh-CN': '深入剖析 RAG 技术，多维度对比分析，助力开发者选择最适合的 RAG 技术方案。',
      en: 'In-depth RAG technology analysis, multi-dimensional comparison to help developers choose the best RAG solution.',
    },
    coverImage: 'https://static.refly.ai/artifact-cover/book.webp',
    type: 'doc',
    author: 'kate',
    authorEmail: 'rick****rag',
    url: 'https://refly.ai/share/code/cod-zx610tter978d93et5qf1br2',
  },
];
