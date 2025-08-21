import { z } from 'zod';
import { CanvasContentItem } from '../../canvas/canvas.dto';
import { PilotSession, PilotStep } from '@refly/openapi-schema';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { buildFormattedExamples } from './examples';

/**
 * Schema for pilot steps with workflowStage to enforce proper tool sequencing
 */
export const pilotStepSchema = z
  .object({
    name: z.string().describe('A clear and concise title for the step'),
    skillName: z
      .enum([
        'commonQnA',
        'webSearch',
        'librarySearch',
        'generateDoc',
        'codeArtifacts',
        'generateMedia', // Unified multimodal skill for image, video, and audio
      ])
      .describe('The name of the skill to invoke'),
    priority: z.number().min(1).max(5).describe('Priority level from 1 (highest) to 5 (lowest)'),
    query: z.string().describe('The query to ask the skill'),
    contextItemIds: z
      .array(z.string())
      .describe('The ID list of the relevant canvas items for this step'),
    workflowStage: z
      .enum(['research', 'analysis', 'synthesis', 'creation'])
      .describe(
        'The workflow stage this step belongs to - must follow proper sequencing: research (early) → analysis (middle) → synthesis (optional) → creation (final). Each stage uses specific tools: research uses webSearch/librarySearch/commonQnA, analysis uses commonQnA, synthesis uses commonQnA, creation uses generateDoc/codeArtifacts/generateMedia only after sufficient context gathering.',
      ),
  })
  .describe('A single action step of the pilot');

export const multiStepSchema = z
  .object({
    steps: z.array(pilotStepSchema).describe('A list of steps of the pilot'),
  })
  .describe('A list of steps of the pilot');

export type PilotStepRawOutput = z.infer<typeof pilotStepSchema>;

/**
 * Detects the complexity of media generation requests
 * @param userQuestion The user's original question/request
 * @returns 'simple' for straightforward media requests, 'complex' for research-heavy requests, 'none' for non-media requests
 */
export function detectMediaIntentComplexity(userQuestion: string): 'simple' | 'complex' | 'none' {
  const question = userQuestion.toLowerCase();

  // Media type keywords (combined from existing detection logic)
  const mediaKeywords = [
    // Image keywords
    '图片',
    '图像',
    '照片',
    '插图',
    '设计',
    '海报',
    '标志',
    '图标',
    '示意图',
    '画',
    '绘制',
    '图表',
    'image',
    'picture',
    'photo',
    'illustration',
    'design',
    'poster',
    'logo',
    'icon',
    'diagram',
    'draw',
    'chart',
    'graphic',
    'visual',
    'artwork',
    'banner',
    // Video keywords
    '视频',
    '动画',
    '短片',
    '演示',
    '录像',
    '影片',
    '动态',
    '片段',
    '电影',
    'video',
    'animation',
    'demo',
    'demonstration',
    'movie',
    'clip',
    'footage',
    'commercial',
    'trailer',
    'motion',
    'animated',
    'film',
    // Audio keywords
    '音频',
    '音乐',
    '声音',
    '语音',
    '音效',
    '背景音',
    '播客',
    '配音',
    '歌曲',
    '录音',
    'audio',
    'music',
    'sound',
    'voice',
    'speech',
    'podcast',
    'narration',
    'song',
    'recording',
    'sound effect',
    'jingle',
    'soundtrack',
    'background music',
  ];

  // Check if it's a media request
  const hasMediaKeywords = mediaKeywords.some((keyword) => question.includes(keyword));
  if (!hasMediaKeywords) {
    return 'none';
  }

  // Complex request indicators (requires research/analysis)
  const complexIndicators = [
    // Trend and analysis keywords
    '最新',
    '趋势',
    '流行',
    '热门',
    '对比',
    '分析',
    '研究',
    '调查',
    '竞品',
    '市场',
    'latest',
    'trend',
    'trending',
    'popular',
    'analysis',
    'research',
    'study',
    'competitor',
    'market',
    'industry',
    // Time-sensitive keywords
    '2024',
    '2023',
    '当前',
    '现在',
    '今年',
    'current',
    'recent',
    'modern',
    'contemporary',
    // Research-heavy keywords
    '基于',
    '根据',
    '参考',
    'based on',
    'according to',
    'reference',
    'inspired by',
  ];

  // Simple request indicators (self-contained descriptions)
  const simpleIndicators = [
    // Direct creative requests
    '创建',
    '制作',
    '生成',
    '设计一个',
    '画一个',
    'create',
    'make',
    'generate',
    'design a',
    'draw a',
    // Style descriptors
    '简约',
    '现代',
    '可爱',
    '专业',
    '彩色',
    'simple',
    'modern',
    'cute',
    'professional',
    'colorful',
    // Size/format descriptors
    'logo',
    '头像',
    '壁纸',
    'avatar',
    'wallpaper',
    'banner',
  ];

  const hasComplexIndicators = complexIndicators.some((indicator) => question.includes(indicator));
  const hasSimpleIndicators = simpleIndicators.some((indicator) => question.includes(indicator));

  // Decision logic: if has complex indicators, mark as complex
  // If has simple indicators and no complex indicators, mark as simple
  // Otherwise default to complex for safety
  if (hasComplexIndicators) {
    return 'complex';
  } else if (hasSimpleIndicators) {
    return 'simple';
  } else {
    return 'complex'; // Default to complex for safety
  }
}

/**
 * Generates streamlined guidance for simple media requests
 * @returns Guidance text for simple media generation workflows
 */
export function generateSimpleMediaGuidance(): string {
  return `
## STREAMLINED MEDIA GENERATION MODE
Detected: Simple, self-contained media request

### Optimized Workflow (1-2 Steps):
- **DIRECT APPROACH**: Skip extensive research for clear creative briefs
- **FOCUS**: Convert user intent directly to high-quality English prompts
- **EFFICIENCY**: Minimize unnecessary context gathering steps

### Media Generation Guidelines:
1. **Immediate Generation**: Use generateMedia directly if request is clear and self-contained
2. **English Prompt Quality**: 
   - Translate user intent accurately to English
   - Include technical specifications (dimensions, style, format)
   - Maintain original creative vision
   - Use professional media generation terminology

### Workflow Options:
**Option A (1 Step - Recommended for very clear requests):**
- Direct generateMedia with optimized English prompt

**Option B (2 Steps - For requests needing slight clarification):**
- Step 1: Brief clarification or style research (optional)
- Step 2: generateMedia with context-informed English prompt

### English Prompt Format:
- **Structure**: [Action] + [Subject] + [Style/Technical Specs] + mediaType: [type]
- **Example**: "Create a minimalist company logo with blue and white colors, vector style, 512x512px. mediaType: image"
- **Key Elements**: Be specific, professional, technically accurate

### Important Notes:
- contextItemIds can be empty for self-contained requests
- workflowStage should be "creation" for direct generation
- Priority should be 1 (highest) for main media generation step
`;
}

/**
 * Determines the recommended workflow stage based on the current epoch
 * @param currentEpoch Current epoch number (0-based)
 * @param totalEpochs Total number of epochs (0-based)
 * @returns The recommended workflow stage for the current epoch
 */
export function getRecommendedStageForEpoch(currentEpoch: number, totalEpochs: number): string {
  // Normalize to handle edge cases
  const normalizedCurrentEpoch = Math.max(0, currentEpoch);
  const normalizedTotalEpochs = Math.max(1, totalEpochs);

  // Calculate progress as a percentage
  const progress = normalizedCurrentEpoch / normalizedTotalEpochs;
  const span = 1 / normalizedTotalEpochs;

  // Assign stages based on progress
  if (progress < span) {
    return 'research';
  } else if (progress < span * 2) {
    return 'analysis';
  } else if (progress < span * 3) {
    return 'synthesis';
  } else {
    return 'creation';
  }
}

/**
 * Generates guidance for the current epoch stage
 * @param stage The current workflow stage
 * @returns Guidance text for the prompt
 */
export function generateStageGuidance(stage: string): string {
  switch (stage) {
    case 'research':
      return `
## CURRENT EPOCH STAGE: RESEARCH (Early Stage)
In this early stage, focus exclusively on gathering information:

- REQUIRED: Use primarily webSearch and librarySearch tools
- Use commonQnA only for basic information gathering
- DO NOT use analysis, synthesis, or creation tools yet
- Focus on broad information gathering about the topic
- Collect diverse perspectives and factual information
- Explore different aspects of the question systematically
- ALL steps in this epoch should have workflowStage="research"`;

    case 'analysis':
      return `
## CURRENT EPOCH STAGE: ANALYSIS (Middle Stage)
In this middle stage, focus on analyzing the information collected:

- REQUIRED: Use primarily commonQnA for analysis
- Build upon research collected in previous epochs
- Identify patterns, contradictions, and insights
- Evaluate the quality and reliability of information
- Compare different perspectives and approaches
- Synthesize preliminary findings
- MOST steps in this epoch should have workflowStage="analysis"
- NO creation steps allowed yet`;

    case 'synthesis':
      return `
## CURRENT EPOCH STAGE: SYNTHESIS (Late Middle Stage)
In this late middle stage, focus on organizing and planning outputs:

- REQUIRED: Use primarily commonQnA for synthesis
- Organize information into coherent frameworks
- Identify the most important findings and insights
- Plan the structure of final deliverables
- Draft outlines for documents or code
- MOST steps should have workflowStage="synthesis"
- LIMITED creation steps allowed (max 1)`;

    case 'creation':
      return `
## CURRENT EPOCH STAGE: CREATION (Final Stage)
In this final stage, focus on creating comprehensive outputs based on gathered information:

### Available Creation Tools:
- **generateDoc**: Create comprehensive documents, articles, reports
- **codeArtifacts**: Generate complete code projects and applications
- **generateMedia**: Create multimodal content including images, videos, and audio (unified multimedia generator)

### Multimodal Content Detection Guidelines:
When users request content that involves visual, video, or audio elements, use the unified **generateMedia** tool:

#### Media Type Selection (use generateMedia with appropriate mediaType parameter):
**CRITICAL: Always analyze user intent and specify the correct mediaType parameter**

**Image Content Detection (mediaType: image):**
- Keywords: "图片", "图像", "照片", "插图", "设计", "海报", "标志", "图标", "示意图", "画", "绘制", "图表"
- English: "image", "picture", "photo", "illustration", "design", "poster", "logo", "icon", "diagram", "draw", "chart", "graphic", "visual", "artwork", "banner"
- User expressions: "create a...", "design a...", "make a picture of...", "draw something...", "generate an image..."

**Video Content Detection (mediaType: video):**
- Keywords: "视频", "动画", "短片", "演示", "录像", "影片", "动态", "片段", "电影"
- English: "video", "animation", "demo", "demonstration", "movie", "clip", "footage", "commercial", "trailer", "motion", "animated", "film"
- User expressions: "create a video...", "make an animation...", "film something...", "produce a clip...", "animate..."

**Audio Content Detection (mediaType: audio):**
- Keywords: "音频", "音乐", "声音", "语音", "音效", "背景音", "播客", "配音", "歌曲", "录音"
- English: "audio", "music", "sound", "voice", "speech", "podcast", "narration", "song", "recording", "sound effect", "jingle", "soundtrack", "background music"
- User expressions: "create music...", "generate audio...", "make a sound...", "compose something...", "record a voice..."

### Selection Logic:
**STEP 1: Analyze user intent carefully for media type detection**
1. Scan user query for image-related keywords/expressions → use generateMedia with mediaType=image
2. Scan user query for video-related keywords/expressions → use generateMedia with mediaType=video  
3. Scan user query for audio-related keywords/expressions → use generateMedia with mediaType=audio
4. If ambiguous, prioritize based on context and typical user patterns (images are most common)

**STEP 2: Choose appropriate tool**
- Use generateMedia ONLY for multimedia content (images, videos, audio)
- Use codeArtifacts for code projects and interactive applications
- Use generateDoc for text documents and reports

**STEP 3: Format the query correctly**
- ALWAYS include "mediaType: [detected_type]" in generateMedia queries
- Example: "Create a company logo with modern design. mediaType: image"

### Important Rules:
- MUST reference previous research context in contextItemIds
- Each creation step should build upon information gathered in previous stages
- Use specific, descriptive queries that include style and format requirements
- ALL creation steps should have workflowStage="creation"
- Creation tools should ONLY be used in the final 1-2 steps
- MUST reference previous context items in almost all cases`;

    default:
      return `
## CURRENT EPOCH STAGE: RESEARCH (Default Stage)
Focus on gathering information:

- Use primarily webSearch and librarySearch tools
- Use commonQnA only for basic information gathering
- DO NOT use creation tools yet
- ALL steps in this epoch should have workflowStage="research"`;
  }
}

/**
 * Enhanced guidance generation that considers media intent complexity
 * @param stage The current workflow stage
 * @param userQuestion The original user question for media intent detection
 * @returns Guidance text optimized for the detected workflow type
 */
export function generateEnhancedStageGuidance(stage: string, userQuestion?: string): string {
  // If user question is provided, detect media intent complexity
  if (userQuestion) {
    const mediaComplexity = detectMediaIntentComplexity(userQuestion);

    // For simple media requests in creation stage, provide streamlined guidance
    if (mediaComplexity === 'simple' && stage === 'creation') {
      return `${generateSimpleMediaGuidance()}\n\n${generateStageGuidance(stage)}`;
    }

    // For simple media requests in early stages, still provide streamlined approach
    if (mediaComplexity === 'simple' && (stage === 'research' || stage === 'analysis')) {
      return `${generateSimpleMediaGuidance()}\n\n${generateStageGuidance(stage)}`;
    }
  }

  // Default to original stage guidance
  return generateStageGuidance(stage);
}

/**
 * Utility function to test media intent detection and workflow optimization
 * @param userQuestion The user question to analyze
 * @returns Analysis result with detected complexity and recommended workflow
 */
export function analyzeMediaWorkflowOptimization(userQuestion: string): {
  mediaComplexity: 'simple' | 'complex' | 'none';
  recommendedSteps: number;
  workflowType: 'streamlined' | 'standard';
  promptSuggestion?: string;
} {
  const complexity = detectMediaIntentComplexity(userQuestion);

  if (complexity === 'simple') {
    return {
      mediaComplexity: complexity,
      recommendedSteps: 1,
      workflowType: 'streamlined',
      promptSuggestion:
        'Direct generateMedia with optimized English prompt, no context gathering needed',
    };
  } else if (complexity === 'complex') {
    return {
      mediaComplexity: complexity,
      recommendedSteps: 3,
      workflowType: 'standard',
      promptSuggestion: 'Follow research → analysis → creation workflow with context building',
    };
  } else {
    return {
      mediaComplexity: complexity,
      recommendedSteps: 5,
      workflowType: 'standard',
    };
  }
}

/**
 * Formats the canvas content items into a detailed, structured string format
 */
export function formatCanvasContent(contentItems: CanvasContentItem[]): string {
  if (!contentItems?.length) {
    return '';
  }

  // Add an index to each item and format with detailed information
  return contentItems
    .map((item, index) => {
      const itemId = item?.id || 'unknown-id';
      const itemType = item?.type || 'unknown-type';
      const header = `## Canvas Item ${index + 1} (ID: ${itemId}, Type: ${itemType})`;

      if (itemType === 'skillResponse') {
        return `${header}\n**Question:** ${item?.title || 'No title'}\n**Answer:**\n${item?.content || 'No content'}\n**Context ID:** ${itemId}`;
      }

      if (itemType === 'document') {
        if (item?.title && item?.content) {
          return `${header}\n**Document Title:** ${item.title}\n**Document Content:**\n${item.content}\n**Context ID:** ${itemId}`;
        }
        if (item?.title && item?.contentPreview) {
          return `${header}\n**Document Title:** ${item.title}\n**Document Preview:**\n${item.contentPreview}\n**Context ID:** ${itemId}`;
        }
      }

      if (itemType === 'codeArtifact') {
        return `${header}\n**Code Snippet:** ${item?.title || 'Untitled Code'}\n\`\`\`\n${item?.content || item?.contentPreview || 'No code available'}\n\`\`\`\n**Context ID:** ${itemId}`;
      }

      // Generic case for other item types
      if (item?.title && (item?.content || item?.contentPreview)) {
        return `${header}\n**Title:** ${item.title}\n**Content:**\n${item?.content || item?.contentPreview || 'No content available'}\n**Context ID:** ${itemId}`;
      }

      return null;
    })
    .filter(Boolean)
    .join('\n\n---\n\n');
}

/**
 * Formats the session and steps into a markdown TODO-list.
 */
export function formatTodoMd(session: PilotSession, steps: PilotStep[]): string {
  const completedSteps: PilotStep[] = steps.filter((step) => step.status === 'finish');
  const pendingSteps: PilotStep[] = steps.filter((step) => step.status !== 'finish');

  // Calculate the current epoch based on the session's metadata or default to 1
  const currentEpoch = session?.currentEpoch ?? 0;
  const totalEpochs = session?.maxEpoch ?? 3;

  let markdown = `# Todo: ${session.title ?? 'Research Plan'}\n\n`;

  // Add original request
  markdown += `## Original Request\n${session.input?.query ?? ''}\n\n`;

  // Add status
  markdown += `## Status\n${session.status ?? 'pending'}\n\n`;

  // Add current epoch
  markdown += `## Current Epoch: ${currentEpoch + 1}/${totalEpochs + 1}\n\n`;

  // Tasks section
  markdown += '## Tasks\n\n';

  // Completed tasks
  markdown += '### Completed\n';
  if (completedSteps?.length > 0) {
    for (const step of completedSteps) {
      markdown += `- [x] ${step.stepId}: ${step.name}\n`;
    }
  }
  markdown += '\n';

  // Pending tasks
  markdown += '### Pending\n';
  if (pendingSteps?.length > 0) {
    for (const step of pendingSteps) {
      const rawOutput: PilotStepRawOutput = JSON.parse(step.rawOutput ?? '{}');
      const { skillName, priority, query, workflowStage } = rawOutput;

      // Format: - [ ] task-id: task name (Priority: X)
      markdown += `- [ ] ${step.name}: ${query} (Priority: ${priority ?? 3})\n`;

      // Add tool suggestion if available
      if (skillName) {
        markdown += `  - Suggested Tool: ${skillName}\n`;
      }

      // Add workflow stage if available
      if (workflowStage) {
        markdown += `  - Stage: ${workflowStage}\n`;
      }
    }
  }

  return markdown;
}

/**
 * Formats the canvas content items into a mermaid flowchart.
 */
export function formatCanvasIntoMermaidFlowchart(contentItems: CanvasContentItem[]): string {
  if (!contentItems?.length) {
    return '```mermaid\ngraph TD\n    EmptyCanvas[Canvas is empty]\n```';
  }

  // Map of IDs to safe IDs for Mermaid (removing special characters)
  const idMap = new Map<string, string>();

  // Create safe IDs for Mermaid diagram
  contentItems.forEach((item, index) => {
    const itemId = item?.id || `unknown-${index}`;
    // Create a safe ID that works in Mermaid (alphanumeric with underscores)
    const safeId = `node_${index}_${itemId.replace(/[^a-zA-Z0-9]/g, '_')}`;
    idMap.set(itemId, safeId);
  });

  // Start building the Mermaid diagram
  let mermaidCode = '```mermaid\ngraph TD\n';

  // Add nodes with proper styling based on type
  for (const item of contentItems) {
    const itemId = item?.id || 'unknown';
    const safeId = idMap.get(itemId) || `node_${itemId.replace(/[^a-zA-Z0-9]/g, '_')}`;
    const title = item?.title?.replace(/"/g, '\\"') || 'Untitled';
    const itemType = item?.type || 'unknown-type';

    // Define node style based on type
    let nodeStyle = '';
    switch (itemType) {
      case 'document':
        nodeStyle = 'class="document" fill:#f9f9f9,stroke:#666';
        break;
      case 'skillResponse':
        nodeStyle = 'class="skill" fill:#e6f7ff,stroke:#1890ff';
        break;
      case 'codeArtifact':
        nodeStyle = 'class="code" fill:#f6ffed,stroke:#52c41a';
        break;
      default:
        nodeStyle = 'class="default" fill:#fff,stroke:#d9d9d9';
    }

    // Add node with label and style
    mermaidCode += `    ${safeId}["${title}"] style ${safeId} ${nodeStyle}\n`;
  }

  // Add connections based on inputIds
  for (const item of contentItems) {
    const itemId = item?.id || 'unknown';
    const safeId = idMap.get(itemId) || `node_${itemId.replace(/[^a-zA-Z0-9]/g, '_')}`;

    // Check if item has input IDs (dependencies)
    if (item?.inputIds?.length) {
      for (const inputId of item.inputIds) {
        const safeInputId = idMap.get(inputId);
        // Only add connection if input ID exists in our map
        if (safeInputId) {
          mermaidCode += `    ${safeInputId} --> ${safeId}\n`;
        }
      }
    }
  }

  // Add legend
  mermaidCode += '    subgraph Legend\n';
  mermaidCode +=
    '        Document["Document"] style Document class="document" fill:#f9f9f9,stroke:#666\n';
  mermaidCode +=
    '        Skill["Skill Response"] style Skill class="skill" fill:#e6f7ff,stroke:#1890ff\n';
  mermaidCode +=
    '        Code["Code Artifact"] style Code class="code" fill:#f6ffed,stroke:#52c41a\n';
  mermaidCode += '    end\n';

  // End the Mermaid diagram
  mermaidCode += '```';

  return mermaidCode;
}

/**
 * Generates a detailed schema guide with example for LLM
 */
export function generateSchemaInstructions(): string {
  // Convert Zod schema to JSON Schema for better documentation
  const jsonSchema = zodToJsonSchema(pilotStepSchema, { target: 'openApi3' });

  // Generate examples that enforce proper tool sequencing
  const researchExample = {
    name: 'Find recent research on quantum computing',
    skillName: 'webSearch',
    query: 'latest advancements in quantum computing 2023',
    contextItemIds: ['quantum-intro-123'],
    workflowStage: 'research',
    priority: 1,
  };

  const analysisExample = {
    name: 'Analyze quantum computing applications',
    skillName: 'commonQnA',
    query: 'Analyze the most promising applications of recent quantum computing advancements',
    contextItemIds: ['quantum-research-results-456', 'quantum-intro-123'],
    workflowStage: 'analysis',
    priority: 3,
  };

  const creationExample = {
    name: 'Create quantum computing visualization',
    skillName: 'codeArtifacts',
    query:
      'Create a single-page HTML visualization of quantum computing principles and applications',
    contextItemIds: ['quantum-analysis-789', 'quantum-research-results-456'],
    workflowStage: 'creation',
    priority: 5,
  };

  // Add multimodal examples with diverse intent expressions
  const multimodalExamples = [
    // Image generation examples - various ways users express image needs
    {
      name: 'Generate product illustration',
      skillName: 'generateMedia',
      query:
        'Create a modern, minimalist illustration of a smart home device with clean lines and tech-focused design. mediaType: image',
      contextItemIds: ['research-smart-home-123', 'design-trends-456'],
      workflowStage: 'creation',
      priority: 1,
    },
    {
      name: 'Design company logo',
      skillName: 'generateMedia',
      query:
        'Design a professional logo for our AI startup with tech elements and modern aesthetics. mediaType: image',
      contextItemIds: ['brand-guidelines-234', 'competitor-analysis-567'],
      workflowStage: 'creation',
      priority: 1,
    },
    {
      name: 'Create marketing poster',
      skillName: 'generateMedia',
      query:
        'Make a vibrant promotional poster for our product launch event with bold colors. mediaType: image',
      contextItemIds: ['event-details-345', 'brand-colors-678'],
      workflowStage: 'creation',
      priority: 1,
    },

    // Video generation examples - various ways users express video needs
    {
      name: 'Create demo video',
      skillName: 'generateMedia',
      query:
        'Generate a 30-second product demonstration video showing the key features and benefits. mediaType: video',
      contextItemIds: ['product-features-789', 'user-scenarios-101'],
      workflowStage: 'creation',
      priority: 1,
    },
    {
      name: 'Make promotional animation',
      skillName: 'generateMedia',
      query:
        'Produce an animated commercial for our new app with smooth transitions and engaging visuals. mediaType: video',
      contextItemIds: ['app-features-456', 'target-audience-789'],
      workflowStage: 'creation',
      priority: 1,
    },
    {
      name: 'Film tutorial clip',
      skillName: 'generateMedia',
      query:
        'Create a short tutorial video showing how to use our software interface step by step. mediaType: video',
      contextItemIds: ['software-guide-123', 'user-feedback-456'],
      workflowStage: 'creation',
      priority: 1,
    },

    // Audio generation examples - various ways users express audio needs
    {
      name: 'Generate background music',
      skillName: 'generateMedia',
      query:
        'Create upbeat, modern electronic background music for a tech presentation. mediaType: audio',
      contextItemIds: ['presentation-content-112', 'music-references-131'],
      workflowStage: 'creation',
      priority: 2,
    },
    {
      name: 'Produce podcast intro',
      skillName: 'generateMedia',
      query:
        'Compose a professional podcast intro jingle with energetic rhythm and tech vibes. mediaType: audio',
      contextItemIds: ['podcast-theme-234', 'audio-examples-567'],
      workflowStage: 'creation',
      priority: 2,
    },
    {
      name: 'Create sound effects',
      skillName: 'generateMedia',
      query:
        'Generate UI sound effects for button clicks and notifications in our mobile app. mediaType: audio',
      contextItemIds: ['app-design-345', 'sound-references-678'],
      workflowStage: 'creation',
      priority: 2,
    },
  ];

  // Add streamlined examples for simple media requests
  const streamlinedMediaExamples = [
    // Simple direct generation examples
    {
      name: 'Create company logo',
      skillName: 'generateMedia',
      query:
        'Create a minimalist company logo with blue and white colors, vector style, 512x512px, professional appearance. mediaType: image',
      contextItemIds: [],
      workflowStage: 'creation',
      priority: 1,
    },
    {
      name: 'Generate cat illustration',
      skillName: 'generateMedia',
      query:
        'Draw a cute cartoon cat with orange fur, sitting position, simple background, children-book style. mediaType: image',
      contextItemIds: [],
      workflowStage: 'creation',
      priority: 1,
    },
    {
      name: 'Design app icon',
      skillName: 'generateMedia',
      query:
        'Design a modern mobile app icon for productivity app, rounded square, gradient background, clean typography. mediaType: image',
      contextItemIds: [],
      workflowStage: 'creation',
      priority: 1,
    },
    {
      name: 'Create background music',
      skillName: 'generateMedia',
      query:
        'Compose calm ambient background music, 3 minutes duration, suitable for meditation, soft piano and nature sounds. mediaType: audio',
      contextItemIds: [],
      workflowStage: 'creation',
      priority: 1,
    },
  ];

  return `Please generate a structured JSON array of research steps with the following schema:

Each step should have:
1. "name": A clear, concise title for the step
2. "skillName": The specific skill to invoke (one of: "commonQnA", "webSearch", "librarySearch", "generateDoc", "codeArtifacts", "generateMedia")
3. "query": The specific question or prompt to send to the skill
4. "contextItemIds": Array of IDs for relevant canvas items that provide context for this step
5. "workflowStage": The stage of the workflow this step belongs to (one of: "research", "analysis", "synthesis", "creation")

Example steps showing proper tool sequencing:

1. Research stage (early) - use search tools:
\`\`\`json
${JSON.stringify(researchExample, null, 2)}
\`\`\`

2. Analysis stage (middle) - use commonQnA for analysis:
\`\`\`json
${JSON.stringify(analysisExample, null, 2)}
\`\`\`

3. Creation stage (final) - ONLY in the final 1-2 steps and MUST reference previous context:
\`\`\`json
${JSON.stringify(creationExample, null, 2)}
\`\`\`

### Multimodal Creation Examples:

${multimodalExamples
  .map(
    (example) => `
**${example.skillName} Example:**
\`\`\`json
${JSON.stringify(example, null, 2)}
\`\`\`
`,
  )
  .join('\n')}

### Streamlined Media Generation Examples (For Simple, Self-Contained Requests):

${streamlinedMediaExamples
  .map(
    (example) => `
**Direct ${example.skillName} Example:**
\`\`\`json
${JSON.stringify(example, null, 2)}
\`\`\`
`,
  )
  .join('\n')}

### Tool Selection Guidelines:
- Use **generateMedia** for: all multimedia content including images, videos, and audio
  - **CRITICAL**: Always specify mediaType parameter (image, video, or audio) in the query based on user intent
  - **Media Type Detection Rules**:
    * **image**: photos, pictures, illustrations, designs, posters, logos, diagrams, graphics
    * **video**: videos, animations, demos, clips, movies, commercials, motion content
    * **audio**: music, songs, sounds, voices, podcasts, narration, sound effects
  - **Format**: "User's content request. mediaType: detected_type"
  - **Examples**:
    * "Create a logo for my company. mediaType: image"
    * "Make a product demo video. mediaType: video" 
    * "Generate background music. mediaType: audio"
- Use **generateDoc** for: text documents, articles, reports
- Use **codeArtifacts** for: code projects, applications, interactive tools

### English Prompt Quality Guidelines:
- **Technical Accuracy**: Use precise media generation terminology
- **Specificity**: Include dimensions, style, format, duration, colors
- **Intent Preservation**: Maintain the original user's creative vision
- **Professional Language**: Use industry-standard terminology

### Workflow Optimization:
- **Simple Media Requests**: Can use 1-2 steps with direct generateMedia
- **Complex Media Requests**: Follow standard research → analysis → creation workflow
- **Context Independence**: Simple requests can have empty contextItemIds
- **Priority Assignment**: Use priority 1 for main media generation tasks

JSON Schema Definition:
\`\`\`json
${JSON.stringify(jsonSchema, null, 2)}
\`\`\`

IMPORTANT:
- Each step should be focused on a specific research sub-task
- Make steps logical and progressive, building on previous steps when appropriate
- Ensure each step has a clear purpose that contributes to answering the main research question
- Creation tasks (generateDoc, codeArtifacts, generateMedia) MUST ONLY be used in the final 1-2 steps
- For simple media requests, direct generation without context is acceptable
- For complex media requests, creation tasks MUST reference previous context items
- Ensure your response is a valid JSON array of steps that follow the schema exactly
`;
}

/**
 * Builds few-shot examples for research step decomposition
 */
export function buildResearchStepExamples(): string {
  return buildFormattedExamples();
}

/**
 * Generates the main planning prompt with canvas content
 */
export function generatePlanningPrompt(
  userQuestion: string,
  session: PilotSession,
  steps: PilotStep[],
  contentItems: CanvasContentItem[],
  maxStepsPerEpoch: number,
  locale?: string,
): string {
  const combinedContent = formatCanvasContent(contentItems);
  const todoMd = formatTodoMd(session, steps);
  const canvasVisual = formatCanvasIntoMermaidFlowchart(contentItems);

  // Calculate the current epoch based on the session's metadata or default to 0
  const currentEpoch = session?.currentEpoch ?? 0;
  const totalEpochs = session?.maxEpoch ?? 3;

  // Determine recommended stage for current epoch
  const recommendedStage = getRecommendedStageForEpoch(currentEpoch, totalEpochs);

  // Generate stage-specific guidance
  const stageGuidance = generateEnhancedStageGuidance(recommendedStage, userQuestion);

  // Generate locale-specific instructions
  const localeInstructions = locale
    ? `\n## Output Language Instructions\nPlease generate all step names, queries, and any text content in ${locale}. The research plan should be tailored for ${locale} language output.\n`
    : '';

  return `You are an expert research assistant capable of breaking down complex questions into clear, actionable research steps.

## Your Task
Analyze the user's question and available canvas content, then generate a structured research plan with specific steps to thoroughly investigate the topic.
${localeInstructions}
${stageGuidance}

## Tool Usage Guidelines

Follow these important guidelines about tool sequencing:

1. **Research and Context Gathering Tools (Early Stages - MUST USE FIRST)**
   - **webSearch**: Use for gathering up-to-date information from the internet
   - **librarySearch**: Use for searching through structured knowledge bases
   - **commonQnA**: Use for basic information gathering and general knowledge

2. **Analysis and Intermediate Output Tools (Mid Stages - ONLY AFTER RESEARCH)**
   - **commonQnA**: Use for analyzing gathered information and providing structured insights
   - Remember that all tools can produce intermediate outputs as markdown text or code blocks

3. **Final Output Generation Tools (Final Stages - ONLY AT THE END)**
   - **generateDoc**: Use for creating comprehensive documents ONLY after sufficient research, MUST be used only in the final 1-2 steps, and MUST reference previous context
   - **codeArtifacts**: Use for generating complete code artifacts ONLY after proper context is gathered, MUST be used only in the final 1-2 steps, and MUST reference previous context

## CRITICAL SEQUENCING RULES - STRICTLY FOLLOW THESE
- First 60% of steps MUST be research tasks (webSearch, librarySearch, commonQnA for gathering information)
- The first 2-3 steps MUST use webSearch or librarySearch to gather basic information
- Next 20% should be analysis tasks (commonQnA for analyzing gathered information)
- Last 20% can be creation tasks (generateDoc, codeArtifacts) and ONLY after sufficient research and analysis
- NEVER use generateDoc or codeArtifacts in the first 60% of steps
- MUST ONLY use generateDoc and codeArtifacts in the final 1-2 steps
- generateDoc and codeArtifacts MUST almost always reference previous context items, only in extremely rare cases can they generate without context dependency
- Tasks must follow the strict sequence: Research → Analysis → Creation

## Step Generation Guidelines
1. Break down the research into logical, sequential steps
2. Select the most appropriate skill for each research step
3. Craft specific and focused queries for each skill
4. Reference relevant context items from the canvas when appropriate
   - Use the exact context IDs (e.g., "quantum-intro-123") from the Canvas Content section
   - Include multiple context IDs when a step builds on multiple sources
5. Assign the appropriate workflowStage value to each step (research, analysis, synthesis, creation)
6. Generate exactly ${maxStepsPerEpoch} research steps to efficiently explore the topic
7. REQUIRED: First step MUST be webSearch or librarySearch to gather basic information
8. Creation tools (generateDoc, codeArtifacts) MUST ONLY be used in the final 1-2 steps and MUST reference previous context items in almost all cases

## Schema Instructions:

${generateSchemaInstructions()}

## Examples with expected outputs:

${buildResearchStepExamples()}

## Current Todo List:
${todoMd}

## Canvas Content:
${combinedContent}

## Canvas Structure:
${canvasVisual}

## User Question: 

"${userQuestion}"
`;
}

/**
 * Generates the bootstrap prompt when no canvas content exists
 */
export function generateBootstrapPrompt(
  userQuestion: string,
  session: PilotSession,
  steps: PilotStep[],
  contentItems: CanvasContentItem[],
  maxStepsPerEpoch: number,
  locale?: string,
): string {
  const combinedContent = formatCanvasContent(contentItems);
  const todoMd = formatTodoMd(session, steps);
  const canvasVisual = formatCanvasIntoMermaidFlowchart(contentItems);

  // Calculate the current epoch based on the session's metadata or default to 0
  const currentEpoch = session?.currentEpoch ?? 0;
  const totalEpochs = session?.maxEpoch ?? 3;

  // Determine recommended stage for current epoch
  const recommendedStage = getRecommendedStageForEpoch(currentEpoch, totalEpochs);

  // Generate stage-specific guidance
  const stageGuidance = generateEnhancedStageGuidance(recommendedStage, userQuestion);

  // Generate locale-specific instructions
  const localeInstructions = locale
    ? `\n## Output Language Instructions\nPlease generate all step names, queries, and any text content in ${locale}. The research plan should be tailored for ${locale} language output.\n`
    : '';

  return `You are an expert research assistant capable of breaking down complex questions into clear, actionable research steps.

## Your Task
Analyze the user's question and generate a structured research plan with specific steps to thoroughly investigate the topic. Since no existing content or context is available, create a plan that starts from scratch.
${localeInstructions}
${stageGuidance}

## Tool Usage Guidelines

Follow these important guidelines about tool sequencing:

1. **Research and Context Gathering Tools (Early Stages - MUST USE FIRST)**
   - **webSearch**: Use for gathering up-to-date information from the internet
   - **librarySearch**: Use for searching through structured knowledge bases
   - **commonQnA**: Use for basic information gathering and general knowledge

2. **Analysis and Intermediate Output Tools (Mid Stages - ONLY AFTER RESEARCH)**
   - **commonQnA**: Use for analyzing gathered information and providing structured insights
   - Remember that all tools can produce intermediate outputs as markdown text or code blocks

3. **Final Output Generation Tools (Final Stages - ONLY AT THE END)**
   - **generateDoc**: Use for creating comprehensive documents ONLY after sufficient research, MUST be used only in the final 1-2 steps, and MUST reference previous context
   - **codeArtifacts**: Use for generating complete code artifacts ONLY after proper context is gathered, MUST be used only in the final 1-2 steps, and MUST reference previous context

## CRITICAL SEQUENCING RULES - STRICTLY FOLLOW THESE
- First 60% of steps MUST be research tasks (webSearch, librarySearch, commonQnA for gathering information)
- The first 2-3 steps MUST use webSearch or librarySearch to gather basic information
- Next 20% should be analysis tasks (commonQnA for analyzing gathered information)
- Last 20% can be creation tasks (generateDoc, codeArtifacts) and ONLY after sufficient research and analysis
- NEVER use generateDoc or codeArtifacts in the first 60% of steps
- MUST ONLY use generateDoc and codeArtifacts in the final 1-2 steps
- generateDoc and codeArtifacts MUST almost always reference previous context items, only in extremely rare cases can they generate without context dependency
- Tasks must follow the strict sequence: Research → Analysis → Creation

## Step Generation Guidelines
1. Break down the research into logical, sequential steps
2. Select the most appropriate skill for each research step
3. Craft specific and focused queries for each skill
4. Use empty arrays for contextItemIds since no context is available yet
5. Assign the appropriate workflowStage value to each step (research, analysis, synthesis, creation)
6. Generate exactly ${maxStepsPerEpoch} research steps to efficiently explore the topic
7. REQUIRED: First step MUST be webSearch or librarySearch to gather basic information
8. Creation tools (generateDoc, codeArtifacts) MUST ONLY be used in the final 1-2 steps and MUST reference previous context items in almost all cases

${generateSchemaInstructions()}

Here are examples with expected outputs:
${buildResearchStepExamples()}

Create a research plan that:
1. Begins with broad information gathering (research stage) using webSearch or librarySearch
2. Progresses to analysis of gathered information (analysis stage) using commonQnA
3. Concludes with steps to synthesize or apply the information (creation stage) for final steps only

User Question: "${userQuestion}"

Current Todo List:
${todoMd}

Canvas Content:
${combinedContent}

Canvas Structure:
${canvasVisual}`;
}

/**
 * Generates the fallback prompt for manual JSON parsing
 */
export function generateFallbackPrompt(
  userQuestion: string,
  session: PilotSession,
  steps: PilotStep[],
  contentItems: CanvasContentItem[],
  maxStepsPerEpoch: number,
  locale?: string,
): string {
  const combinedContent = formatCanvasContent(contentItems);
  const todoMd = formatTodoMd(session, steps);
  const canvasVisual = formatCanvasIntoMermaidFlowchart(contentItems);
  const schemaInstructions = generateSchemaInstructions();

  // Calculate the current epoch based on the session's metadata or default to 0
  const currentEpoch = session?.currentEpoch ?? 0;
  const totalEpochs = session?.maxEpoch ?? 3;

  // Determine recommended stage for current epoch
  const recommendedStage = getRecommendedStageForEpoch(currentEpoch, totalEpochs);

  // Generate stage-specific guidance
  const stageGuidance = generateEnhancedStageGuidance(recommendedStage, userQuestion);

  // Generate locale-specific instructions
  const localeInstructions = locale
    ? `\n## Output Language Instructions\nPlease generate all step names, queries, and any text content in ${locale}. The research plan should be tailored for ${locale} language output.\n`
    : '';

  return `You are an expert research assistant capable of breaking down complex questions into clear, actionable research steps.

## Your Task
Analyze the user's question and generate a structured research plan to thoroughly investigate the topic. Since no existing content or context is available, create a plan that starts from scratch.
${localeInstructions}
${stageGuidance}

## Tool Usage Guidelines

Follow these important guidelines about tool sequencing:

1. **Research and Context Gathering Tools (Early Stages - MUST USE FIRST)**
   - **webSearch**: Use for gathering up-to-date information from the internet
   - **librarySearch**: Use for searching through structured knowledge bases
   - **commonQnA**: Use for basic information gathering and general knowledge

2. **Analysis and Intermediate Output Tools (Mid Stages - ONLY AFTER RESEARCH)**
   - **commonQnA**: Use for analyzing gathered information and providing structured insights
   - Remember that all tools can produce intermediate outputs as markdown text or code blocks

3. **Final Output Generation Tools (Final Stages - ONLY AT THE END)**
   - **generateDoc**: Use for creating comprehensive documents ONLY after sufficient research, MUST be used only in the final 1-2 steps, and MUST reference previous context
   - **codeArtifacts**: Use for generating complete code artifacts ONLY after proper context is gathered, MUST be used only in the final 1-2 steps, and MUST reference previous context

## CRITICAL SEQUENCING RULES - STRICTLY FOLLOW THESE
- First 60% of steps MUST be research tasks (webSearch, librarySearch, commonQnA for gathering information)
- The first 2-3 steps MUST use webSearch or librarySearch to gather basic information
- Next 20% should be analysis tasks (commonQnA for analyzing gathered information)
- Last 20% can be creation tasks (generateDoc, codeArtifacts) and ONLY after sufficient research and analysis
- NEVER use generateDoc or codeArtifacts in the first 60% of steps
- MUST ONLY use generateDoc and codeArtifacts in the final 1-2 steps
- generateDoc and codeArtifacts MUST almost always reference previous context items, only in extremely rare cases can they generate without context dependency
- Tasks must follow the strict sequence: Research → Analysis → Creation

## Guidelines
1. Break down the research into logical, sequential steps
2. Select the most appropriate skill for each research step
3. Craft specific and focused queries for each skill
4. Use empty arrays for contextItemIds since no context is available yet
5. Assign the appropriate workflowStage value to each step (research, analysis, synthesis, creation)
6. Generate exactly ${maxStepsPerEpoch} research steps to efficiently explore the topic
7. REQUIRED: First step MUST be webSearch or librarySearch to gather basic information
8. Creation tools (generateDoc, codeArtifacts) MUST ONLY be used in the final 1-2 steps and MUST reference previous context items in almost all cases

${schemaInstructions}

Here are examples with expected outputs:
${buildResearchStepExamples()}

User Question: "${userQuestion}"

## Current Todo List:
${todoMd}

Canvas Content:
${combinedContent}

Canvas Structure:
${canvasVisual}

Respond ONLY with a valid JSON array wrapped in \`\`\`json and \`\`\` tags.`;
}
