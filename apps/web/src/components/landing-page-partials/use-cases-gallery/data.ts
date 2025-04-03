export interface UseCase {
  id: string;
  title: {
    'zh-CN': string;
    en: string;
  };
  description: {
    'zh-CN': string;
    en: string;
  };
  category: string;
  coverImage: string;
  author?: string;
  authorEmail?: string;
  url?: string;
}

export interface Category {
  id: string;
  name: {
    'zh-CN': string;
    en: string;
  };
}

export const categories: Category[] = [
  { id: 'featured', name: { 'zh-CN': '精选', en: 'Featured' } },
  { id: 'research', name: { 'zh-CN': '研究', en: 'Research' } },
  { id: 'visualization', name: { 'zh-CN': '可视化', en: 'Visualization' } },
  { id: 'education', name: { 'zh-CN': '教育', en: 'Education' } },
  { id: 'productivity', name: { 'zh-CN': '生产力', en: 'Productivity' } },
  { id: 'document', name: { 'zh-CN': '文档', en: 'Documentation' } },
  { id: 'life', name: { 'zh-CN': '生活', en: 'Life' } },
];

export const useCasesData: UseCase[] = [
  {
    id: '1',
    title: {
      'zh-CN': '[卡范]三天打造纸牌图库CATxPAPA',
      en: 'Build Card Library CATxPAPA in 3 Days',
    },
    description: {
      'zh-CN': '72小时完成高精度纸牌视觉资产库建设，联合PAPA实验室打造行业标杆案例',
      en: 'Complete high-precision card visual asset library in 72 hours, creating industry benchmark with PAPA Lab',
    },
    category: 'visualization',
    coverImage: 'https://static.refly.ai/share-cover/can-yewsypawximvg5nn66a419iy.png',
    authorEmail: 'kavan****pro',
    url: 'https://refly.ai/share/canvas/can-yu1t20ajt5adt7238i7aax0x',
  },
  {
    id: '2',
    title: {
      'zh-CN': '💬 SVG 通用极简海报',
      en: '💬 SVG Universal Minimalist Poster',
    },
    description: {
      'zh-CN': '专为设计师打造的SVG通用模板，快速生成简约风格海报，适配多种应用场景',
      en: 'SVG universal template for designers, quickly generate minimalist posters for various scenarios',
    },
    category: 'visualization',
    coverImage: 'https://static.refly.ai/share-cover/can-nnz3d3ly5115zxyx5ufy0yj2.png',
    authorEmail: 'design****pro',
    url: 'https://refly.ai/share/canvas/can-wy8pdxxme2v3b6f0vydpnagb',
  },
  {
    id: '3',
    title: {
      'zh-CN': '🚂 提示词大挑战',
      en: '🚂 Prompt Engineering Challenge',
    },
    description: {
      'zh-CN': '通过结构化提示词框架激发创作潜能，日均产出优质内容提升300%',
      en: 'Boost creativity through structured prompt framework, increasing daily quality content by 300%',
    },
    category: 'research',
    coverImage: 'https://static.refly.ai/share-cover/can-kedetsr6fsogqh8x9xc3222p.png',
    authorEmail: 'prompt****ai',
    url: 'https://refly.ai/share/canvas/can-wwoa35mdgw16adebmrhfqu3w',
  },
  {
    id: '4',
    title: {
      'zh-CN': '🛝 Playground',
      en: '🛝 Interactive Learning Sandbox',
    },
    description: {
      'zh-CN': '支持实时反馈的编码/设计实验环境，提供50+可配置参数的创意工作台',
      en: 'Coding/design experimental environment with real-time feedback, offering 50+ configurable parameters',
    },
    category: 'education',
    coverImage: 'https://static.refly.ai/share-cover/can-io39kq9tiaoey5tkm4gngbfj.png',
    authorEmail: 'sandbox****edu',
    url: 'https://refly.ai/share/canvas/can-sa6vabdmvnxmdy14fleikadv',
  },
  {
    id: '5',
    title: {
      'zh-CN': 'Command Line Hero',
      en: 'Command Line Hero',
    },
    description: {
      'zh-CN': '从零构建命令行工具的完整教学体系，覆盖10种常用开发场景',
      en: 'Complete tutorial system for building command line tools from scratch, covering 10 common development scenarios',
    },
    category: 'education',
    coverImage: 'https://static.refly.ai/share-cover/can-xg0itlyqlugkmzull99fbkw4.png',
    authorEmail: 'cli****dev',
    url: 'https://refly.ai/share/canvas/can-xg0itlyqlugkmzull99fbkw4',
  },
  {
    id: '6',
    title: {
      'zh-CN': '🦜 Reflection',
      en: '🦜 Smart Code Reflection System',
    },
    description: {
      'zh-CN': '基于AST分析的代码自检工具，实时定位潜在错误并提供优化建议',
      en: 'AST-based code self-inspection tool, real-time error detection and optimization suggestions',
    },
    category: 'document',
    coverImage: 'https://static.refly.ai/share-cover/can-e7bgew0hrgsa3tg2m9k6vmgb.png',
    authorEmail: 'reflect****dev',
    url: 'https://refly.ai/share/canvas/can-atcrzek4zmzbiidxi4py38tq',
  },
  {
    id: '7',
    title: {
      'zh-CN': '新闻获取工作流',
      en: 'Smart News Aggregation Engine',
    },
    description: {
      'zh-CN': '多源信息自动抓取+AI摘要生成系统，构建企业级信息中枢解决方案',
      en: 'Multi-source information auto-crawling + AI summary generation system, building enterprise information hub solution',
    },
    category: 'research',
    coverImage: 'https://static.refly.ai/share-cover/can-dr9aze5mweefng4mqkw7u8rm.png',
    authorEmail: 'news****ai',
    url: 'https://refly.ai/share/canvas/can-nos3bixj1o7b56eypgvcnmka',
  },
  {
    id: '8',
    title: {
      'zh-CN': 'Artifact v0.4.0 版本特性',
      en: 'Artifact v0.4.0 Features',
    },
    description: {
      'zh-CN': '新增模型压缩算法与分布式训练支持，推理效率提升40%的里程碑更新',
      en: 'Added model compression algorithm and distributed training support, milestone update with 40% inference efficiency improvement',
    },
    category: 'research',
    coverImage: 'https://static.refly.ai/share-cover/can-ephkt33azjuiw2jo3h1v0drt.png',
    authorEmail: 'art****dev',
    url: 'https://refly.ai/share/canvas/can-l5glcma651k8gwrxbeejejdu',
  },
  {
    id: '9',
    title: {
      'zh-CN': '理解大模型 3D 可视化',
      en: 'Understanding Large Models with 3D Visualization',
    },
    description: {
      'zh-CN': '支持Transformer等架构的交互式可视化分析，参数级神经元活动追踪',
      en: 'Interactive visualization analysis supporting architectures like Transformer, parameter-level neuron activity tracking',
    },
    category: 'visualization',
    coverImage: 'https://static.refly.ai/share-cover/can-yevuumd9spmqv7wvyvb1bl6x.png',
    authorEmail: 'vis****ai',
    url: 'https://refly.ai/share/canvas/can-qnn6vcnvt9o1go7px9axv7ea',
  },
  {
    id: '10',
    title: {
      'zh-CN': '产品调研',
      en: 'Smart Product Research',
    },
    description: {
      'zh-CN': '结合NLP与BI技术的市场洞察工具，自动生成SWOT分析报告',
      en: 'Market insight tool combining NLP and BI technology, automatically generating SWOT analysis reports',
    },
    category: 'productivity',
    coverImage: 'https://static.refly.ai/share-cover/can-wj7kocv092e0cq7wqsbco99x.png',
    authorEmail: 'research****pro',
    url: 'https://refly.ai/share/canvas/can-yhh7nn7pts1znvo746ulohko',
  },
  {
    id: '11',
    title: {
      'zh-CN': '产品引导教程',
      en: 'Progressive Interactive Tutorial System',
    },
    description: {
      'zh-CN': '基于用户行为的动态引导机制，新用户上手时间缩短至8分钟',
      en: 'Dynamic guidance mechanism based on user behavior, reducing new user onboarding time to 8 minutes',
    },
    category: 'education',
    coverImage: 'https://static.refly.ai/share-cover/can-xi6qm4afrbhr6w9qt7yr4swy.png',
    authorEmail: 'edu****pro',
    url: 'https://refly.ai/share/canvas/can-sbjeqqovdztecuyce0e9swq3',
  },
  {
    id: '12',
    title: {
      'zh-CN': '数字人台词生成',
      en: 'Virtual Character Script Generator',
    },
    description: {
      'zh-CN': '支持多风格人格设定的AI编剧工具，情感匹配准确率达92%',
      en: 'AI scriptwriting tool supporting multi-style personality settings, with 92% emotion matching accuracy',
    },
    category: 'productivity',
    coverImage: 'https://static.refly.ai/share-cover/can-iffblxq12invsh5fhv35acyy.png',
    authorEmail: 'script****ai',
    url: 'https://refly.ai/share/canvas/can-v78ikqh7rvu6oc8b293e9b1c',
  },
  {
    id: '13',
    title: {
      'zh-CN': '生成数学游戏',
      en: 'Adaptive Math Game Engine',
    },
    description: {
      'zh-CN': '基于知识图谱的动态难度调节系统，覆盖K12阶段200+核心知识点',
      en: 'Dynamic difficulty adjustment system based on knowledge graph, covering 200+ core K12 knowledge points',
    },
    category: 'education',
    coverImage: 'https://static.refly.ai/share-cover/can-az6hziom08gmlagctjo3hj8b.png',
    authorEmail: 'math****edu',
    url: 'https://refly.ai/share/canvas/can-m9ulmwy4mjouijj3b0wxhazr',
  },
  {
    id: '15',
    title: {
      'zh-CN': 'Cursor 新特性编程教学',
      en: 'Cursor New Features Programming Tutorial',
    },
    description: {
      'zh-CN': '揭秘 Cursor 使用技巧，10个实战案例提升开发效率',
      en: 'Unveiling Cursor usage skills, 10 practical cases to improve development efficiency',
    },
    category: 'research',
    coverImage: 'https://static.refly.ai/share-cover/can-bgm7fthqng7cld17508z8pxi.png',
    authorEmail: 'cursor****dev',
    url: 'https://refly.ai/share/canvas/can-xzg7s31bgrardcq7fxxawr58',
  },
  {
    id: '16',
    title: {
      'zh-CN': '实时语音方案讲解',
      en: 'Low-latency Voice Interaction Solution',
    },
    description: {
      'zh-CN': '端到端延迟<200ms的实时语音处理框架，支持32种语言识别',
      en: 'Real-time voice processing framework with <200ms end-to-end latency, supporting 32 language recognition',
    },
    category: 'productivity',
    coverImage: 'https://static.refly.ai/share-cover/can-ewyscqsw0k85p3b58jhz9uen.png',
    authorEmail: 'voice****ai',
    url: 'https://refly.ai/share/canvas/can-o0k3r3hcebtedlaxsv3lx4xi',
  },
  {
    id: '17',
    title: {
      'zh-CN': 'Langchain MCP 辩论讲解',
      en: 'Langchain MCP Architecture Analysis',
    },
    description: {
      'zh-CN': '深入探讨多轮对话中的记忆控制模块，实现上下文保持准确率98%',
      en: 'In-depth discussion of memory control module in multi-turn dialogue, achieving 98% context retention accuracy',
    },
    category: 'document',
    coverImage: 'https://static.refly.ai/share-cover/can-uyc2bmvh2puw6prc7s4m3ria.png',
    authorEmail: 'lang****ai',
    url: 'https://refly.ai/share/canvas/can-y95crco5z9tq33s2n79ejn8e',
  },
  {
    id: '18',
    title: {
      'zh-CN': '可视化信息学习过程',
      en: 'Knowledge Graph Construction Visualization',
    },
    description: {
      'zh-CN': '实时展示神经网络特征提取过程，支持学习路径回溯与分析',
      en: 'Real-time display of neural network feature extraction process, supporting learning path backtracking and analysis',
    },
    category: 'visualization',
    coverImage: 'https://static.refly.ai/share-cover/can-yevuumd9spmqv7wvyvb1bl6x.png',
    authorEmail: 'vis****edu',
    url: 'https://refly.ai/share/canvas/can-jwlr9swyholsrhjibzov4174',
  },
  {
    id: '19',
    title: {
      'zh-CN': 'Gemini 2.0 做动画表情包',
      en: 'Gemini 2.0 Animated Sticker Generator',
    },
    description: {
      'zh-CN': '基于动作捕捉的AI表情生成工具，3分钟创建个性化动态表情包',
      en: 'AI expression generation tool based on motion capture, create personalized animated stickers in 3 minutes',
    },
    category: 'life',
    coverImage: 'https://static.refly.ai/share-cover/can-oxz3pataybig25ghrsqhivk6.png',
    authorEmail: 'sticker****ai',
    url: 'https://refly.ai/share/canvas/can-vxupf35f4d0lc1c5ujh1apfa',
  },
  {
    id: '20',
    title: {
      'zh-CN': '项目策划（数学挑战游戏）',
      en: 'Project Planning (Math Challenge Game)',
    },
    description: {
      'zh-CN': '包含关卡编辑器与数据看板的完整解决方案，日均用户留存率提升65%',
      en: 'Complete solution including level editor and data dashboard, improving daily user retention rate by 65%',
    },
    category: 'productivity',
    coverImage: 'https://static.refly.ai/share-cover/can-az6hziom08gmlagctjo3hj8b.png',
    authorEmail: 'game****edu',
    url: 'https://refly.ai/share/canvas/can-m9ulmwy4mjouijj3b0wxhazr',
  },
  {
    id: '21',
    title: {
      'zh-CN': '高质量诗词创作',
      en: 'High-quality Poetry Creation',
    },
    description: {
      'zh-CN': '基于大模型生成高质量诗词，支持多种风格与主题创作',
      en: 'High-quality poetry creation based on large models, supporting various styles and themes',
    },
    category: 'life',
    coverImage: 'https://static.refly.ai/share-cover/can-ipv22jtnmmt76c5qw5r8i0jm.png',
    authorEmail: 'voice****ai',
    url: 'https://refly.ai/share/canvas/can-w8z6okyeq1srxd42fug3my2e',
  },
  {
    id: '21',
    title: {
      'zh-CN': 'KIMI 1.5 论文可视化解读',
      en: 'KIMI 1.5 Paper Visualization Interpretation',
    },
    description: {
      'zh-CN': '支持Transformer等架构的交互式可视化分析，参数级神经元活动追踪',
      en: 'Interactive visualization analysis supporting architectures like Transformer, parameter-level neuron activity tracking',
    },
    category: 'document',
    coverImage: 'https://static.refly.ai/share-cover/can-r8gsjmvcv6bkqovrz709unuq.png',
    authorEmail: 'vis****ai',
    url: 'https://refly.ai/share/canvas/can-jwlr9swyholsrhjibzov4174',
  },
  {
    id: '23',
    title: {
      'zh-CN': '数字人台词生成之哪吒',
      en: 'Digital Human Script Generation of Nezha',
    },
    description: {
      'zh-CN': '支持多风格人格设定的AI编剧工具',
      en: 'AI scriptwriting tool supporting multi-style personality settings',
    },
    category: 'life',
    coverImage: 'https://static.refly.ai/share-cover/can-iffblxq12invsh5fhv35acyy.png',
    authorEmail: 'voice****ai',
    url: 'https://refly.ai/share/canvas/can-v78ikqh7rvu6oc8b293e9b1c',
  },
  {
    id: '24',
    title: {
      'zh-CN': '高质量图生歌词',
      en: 'High-quality Image-to-Lyrics Generation',
    },
    description: {
      'zh-CN': '支持多风格歌词生成，支持多种音乐风格',
      en: 'Multi-style lyrics generation, supporting various music styles',
    },
    category: 'life',
    coverImage: 'https://static.refly.ai/share-cover/can-at9xix8rb256jfia71nt87fb.png',
    authorEmail: 'voice****ai',
    url: 'https://refly.ai/share/canvas/can-uppnymdbmhdkgf0pkttud21a',
  },
  {
    id: '26',
    title: {
      'zh-CN': '产品发布日志可视化讲解',
      en: 'Product Release Log Visualization',
    },
    description: {
      'zh-CN': '支持产品发布日志可视化讲解, 支持多种风格与主题创作',
      en: 'Support product release log visualization, supporting various styles and themes',
    },
    category: 'document',
    coverImage: 'https://static.refly.ai/share-cover/can-ephkt33azjuiw2jo3h1v0drt.png',
    authorEmail: 'voice****ai',
    url: 'https://refly.ai/share/canvas/can-dktwhjalufui8kx95y2b2r4k',
  },
];
