import { StepNodeStatus, CopilotWorkflowStep } from '@refly/common-types';

// Daily AI News Digest Workflow Steps for Copilot Panel
export const DAILY_AI_NEWS_WORKFLOW_STEPS: CopilotWorkflowStep[] = [
  {
    id: 'step-1-schedule',
    order: 1,
    title: 'Schedule Daily Trigger',
    description: 'Schedule the workflow to run daily at configured time.',
    status: StepNodeStatus.PENDING,
    nodeId: 'schedule-step',
    prompt:
      'You are an AI scheduling system assistant using the @kimi model. Set up a robust daily trigger for the Daily AI News Digest workflow.\n\nRequirements:\n1. Configure daily execution at 9:00 AM EST with timezone conversion for global users\n2. Implement retry mechanism for failed executions (up to 3 attempts with exponential backoff)\n3. Create recovery system for missed runs due to system downtime\n4. Log all scheduling events with precise timestamps\n5. Validate system health and dependencies before each execution\n6. Ensure reliable delivery and error handling\n\nOutput: Return a comprehensive JSON configuration including scheduling parameters, retry policies, monitoring setup, and health check procedures. Focus on reliability and accuracy.',
    estimatedTime: '2 min',
    dependencies: [],
  },
  {
    id: 'step-2-fetch',
    order: 2,
    title: 'Fetch AI News Headlines',
    description: 'Use Perplexity AI to search for AI news headlines from the last 24 hours.',
    status: StepNodeStatus.PENDING,
    nodeId: 'perplexity-fetch-step',
    prompt:
      'You are an AI news researcher using the @kimi model with Perplexity AI integration. Fetch and curate the latest AI/ML news from the past 24 hours.\n\nSearch Strategy:\n1. Query Categories: "AI research breakthroughs", "Large Language Models", "AI company news", "AI regulation & policy", "Machine Learning tools", "AI safety & ethics"\n2. Time Range: Strictly last 24 hours only\n3. Source Quality: Prioritize reputable tech publications (TechCrunch, Ars Technica, MIT Tech Review, VentureBeat, The Verge, etc.)\n4. Geographic Coverage: Include global perspectives, not just US-centric news\n\nOutput Requirements:\n- JSON array with structured fields: {title, summary, sourceUrl, publishedAt, category, credibilityScore, readTime, tags}\n- Target: 12-20 high-quality articles\n- Include credibility scoring (1-10) based on source reputation and content quality\n- Filter out duplicate stories, promotional content, and opinion pieces\n- Ensure all URLs are accessible and articles are in English\n- Add relevant tags for categorization\n\nContext Integration: Use previous step results for scheduling context and user preferences from @perplexity_search_topic variable.',
    estimatedTime: '3 min',
    dependencies: ['step-1-schedule'],
  },
  {
    id: 'step-3-extract',
    order: 3,
    title: 'Extract News Content',
    description: 'Extract detailed content from news articles with citations.',
    status: StepNodeStatus.PENDING,
    nodeId: 'content-extractor-step',
    prompt:
      "You are an AI content extraction specialist using the @kimi model. Process the news articles from the previous Perplexity fetch step with enhanced extraction capabilities.\n\nExtraction Process:\n1. Extract full article content using read-only web browsing tools\n2. Clean and structure content into markdown format with proper headings\n3. Preserve all original citations, source links, and author attributions\n4. Include comprehensive metadata: author, publication date, estimated read time, source credibility\n5. Extract key quotes, important statistics, and notable insights\n6. Identify and tag main topics/themes for each article using AI categorization\n7. Handle paywalled content gracefully (extract available preview text and note limitations)\n8. Maintain content integrity - no summarization at this stage, preserve original context\n\nOutput Format:\n- Structured JSON with fields: {originalUrl, extractedContent, metadata, keyQuotes, topics, extractionStatus, sourceCredibility}\n- Flag any extraction failures and provide detailed fallback summaries\n- Include content quality assessment and readability scores\n\nContext Integration: Use article URLs and metadata from the previous step's Perplexity results. Ensure extracted content maintains journalistic accuracy and original context.",
    estimatedTime: '3 min',
    dependencies: ['step-2-fetch'],
  },
  {
    id: 'step-4-filter',
    order: 4,
    title: 'Filter & Prioritize',
    description: 'Apply quality filters and rank news by relevance and importance.',
    status: StepNodeStatus.PENDING,
    nodeId: 'news-quality-filter',
    prompt:
      'You are an AI content quality analyst using the @kimi model. Apply sophisticated filtering and prioritization to the extracted articles from the previous step.\n\n**Advanced Quality Filters:**\n1. Credibility Assessment: Score sources based on reputation, fact-checking history, editorial standards, and domain authority\n2. Content Freshness: Prioritize articles published within last 18 hours, with time decay scoring\n3. Relevance Scoring: Rate articles (1-10) on AI/ML significance, industry impact, and innovation level\n4. Duplicate Detection: Use semantic analysis to identify and merge similar stories from different sources\n5. Completeness Check: Filter out articles with insufficient extracted content or missing key information\n6. Bias Detection: Identify and flag potential editorial bias or one-sided reporting\n\n**Intelligent Ranking Criteria:**\n1. Breaking news and major announcements (score: 9-10) - immediate industry impact\n2. Technical breakthroughs and research findings (score: 7-9) - scientific advancement\n3. Industry analysis and market trends (score: 5-7) - strategic insights\n4. Company updates and product launches (score: 3-6) - business relevance\n5. Opinion pieces and commentary (score: 1-4) - thought leadership\n\n**Output Requirements:**\n- Return top 12-15 articles in structured JSON format\n- Include fields: {rankedScore, qualityMetrics, duplicateGroup, recommendedAction, biasAssessment, impactLevel}\n- Provide detailed explanation for filtering decisions and quality distribution statistics\n- Include diversity metrics to ensure balanced coverage across AI domains\n\nContext Integration: Use extracted content and metadata from previous step to make informed ranking decisions.',
    estimatedTime: '2 min',
    dependencies: ['step-3-extract'],
  },
  {
    id: 'step-5-format',
    order: 5,
    title: 'Format News Digest',
    description: 'Transform filtered content into professional email format.',
    status: StepNodeStatus.PENDING,
    nodeId: 'llm-format-step',
    prompt:
      'You are an AI newsletter editor using the @kimi model. Transform the filtered and prioritized articles into a professional daily digest email with enhanced structure and readability.\n\n**ENHANCED EMAIL STRUCTURE:**\n\n📰 **AI Daily Digest - [Current Date]** | ⏱️ [Estimated Read Time]\n*Your curated source for AI industry insights*\n\n🔥 **TOP HEADLINES** (3-4 most impactful stories)\n- Craft compelling headlines with 1-2 sentence executive summaries\n- Include impact indicators (🚀 Breaking, ⭐ Critical, 📈 Trending, 🎯 Strategic)\n- Add context about why each story matters to the AI community\n\n🧠 **TECHNICAL BREAKTHROUGHS** (2-3 research/development stories)\n- Focus on technical details, methodology, and practical implications\n- Include links to research papers, GitHub repos, or technical resources\n- Explain significance for practitioners and researchers\n\n💼 **INDUSTRY UPDATES** (3-4 business/company developments)\n- Cover mergers, funding rounds, product launches, strategic partnerships\n- Include market impact analysis and competitive landscape insights\n- Highlight implications for industry direction\n\n🔍 **WHAT TO WATCH** (Forward-looking intelligence)\n- Upcoming conferences, product launches, policy decisions\n- Emerging trend analysis and market predictions\n- Key metrics and indicators to monitor\n\n⚡ **QUICK BYTES** (5-7 additional noteworthy items)\n- Concise mentions with direct links and one-line insights\n- Include diverse perspectives and global developments\n\n**ENHANCED FORMATTING:**\n- Use markdown with consistent hierarchy and spacing\n- Include emoji indicators and visual separators\n- Each main section: 150-250 words with bullet points\n- Add source attribution with publication times and credibility scores\n- Include click-through links and social sharing options\n- End with personalized next digest preview and feedback invitation\n\nContext Integration: Use ranked articles from previous filtering step, maintaining quality scores and diversity metrics.',
    estimatedTime: '2 min',
    dependencies: ['step-4-filter'],
  },
  {
    id: 'step-6-compose',
    order: 6,
    title: 'Compose Gmail Draft',
    description: 'Create HTML email draft with proper formatting and structure.',
    status: StepNodeStatus.PENDING,
    nodeId: 'gmail-draft-step',
    prompt:
      'You are an AI email composer using the @kimi model, specializing in Gmail integration and email deliverability. Create a comprehensive Gmail draft with enhanced features.\n\n**ADVANCED EMAIL HEADERS:**\n- Subject: "🤖 AI Daily Digest - [Date] | [# articles] stories, [estimated read time]"\n- From: AI Newsletter Service <noreply@your-domain.com>\n- Reply-To: @recipient_email for personalization\n- Priority: Normal with engagement tracking\n- List-Unsubscribe: Include RFC-compliant unsubscribe headers\n\n**ENHANCED HTML CONVERSION:**\n1. Convert markdown digest to semantic HTML5 with proper structure\n2. Apply responsive email styling with CSS inline styles and media queries\n3. Ensure cross-client compatibility (Gmail, Outlook, Apple Mail, mobile clients)\n4. Use web-safe fonts with fallbacks (Arial, Helvetica, system fonts)\n5. Implement consistent spacing, typography hierarchy, and visual branding\n6. Add dark mode support with CSS variables\n\n**PROFESSIONAL LAYOUT ELEMENTS:**\n- Header: Brand-consistent header with logo, date, and digest number\n- Pre-header: Engaging preview text for email clients\n- Intro: Personalized welcome with value proposition\n- Main content: Structured digest with proper sectioning and navigation\n- Footer: Comprehensive footer with unsubscribe, preferences, social links\n- Sidebar: Quick navigation and key metrics summary\n\n**ADVANCED TECHNICAL FEATURES:**\n- Gmail API v1 compatibility with proper authentication\n- Include comprehensive alt text for accessibility\n- Implement link tracking with UTM parameters\n- Add structured data markup for rich snippets\n- Include engagement tracking pixels and open rate monitoring\n- Ensure GDPR compliance and deliverability best practices\n- Implement A/B testing capabilities for subject lines\n\n**OUTPUT SPECIFICATIONS:**\n- Return complete Gmail API payload with multipart MIME structure\n- Include HTML body with embedded CSS\n- Provide plain text alternative with proper formatting\n- Add comprehensive metadata for analytics and tracking\n- Include attachment handling for supplementary content\n\nContext Integration: Use formatted digest from previous step and @recipient_email variable for personalization.',
    estimatedTime: '2 min',
    dependencies: ['step-5-format'],
  },
  {
    id: 'step-7-approve',
    order: 7,
    title: 'Review & Approve',
    description: 'Manual review checkpoint before sending the digest.',
    status: StepNodeStatus.PENDING,
    nodeId: 'approval-step',
    prompt:
      'You are an AI review coordinator using the @kimi model. Present the Gmail draft for human approval with a comprehensive quality assurance and review process.\n\n**COMPREHENSIVE DRAFT ANALYSIS:**\n1. Generate executive summary highlighting key themes and breakthrough stories\n2. List covered topics with importance scores and impact assessments\n3. Identify potential issues: factual concerns, bias, incomplete information\n4. Provide detailed statistics: word count, article count, estimated read time, engagement predictions\n5. Compare against previous digests for consistency and quality improvements\n\n**ADVANCED QUALITY ASSURANCE:**\n1. Fact-checking alerts: Flag claims requiring verification with source confidence scores\n2. Bias detection: Use AI analysis to identify editorial bias, missing perspectives\n3. Link validation: Verify URL accessibility, check for broken links, assess destination quality\n4. Content diversity: Ensure balanced coverage across AI domains (research, business, policy, ethics)\n5. Legal compliance: Screen for copyright issues, sensitive content, privacy concerns\n6. Accessibility check: Verify email accessibility standards and readability scores\n7. Deliverability assessment: Check spam score, authentication setup, sender reputation\n\n**ENHANCED APPROVAL INTERFACE:**\n- Display interactive digest preview with mobile/desktop views\n- Show comparative analysis with previous digests and performance metrics\n- Provide detailed approval options: Approve, Request Specific Changes, Reject with Reasons\n- Include structured feedback form for content, formatting, and strategic improvements\n- Display scheduled send time, recipient count, and delivery timeline\n- Show predicted engagement metrics and optimization suggestions\n\n**COMPREHENSIVE DECISION TRACKING:**\n- Record approval decision with detailed timestamp and reviewer identification\n- Log specific modifications requested with reasoning\n- Track approval workflow timing and bottlenecks\n- Generate comprehensive audit trail for compliance and process improvement\n- Store feedback patterns for ML-driven optimization\n\n**INTERACTIVE OUTPUT:**\n- Present clear approval request with all necessary information\n- Wait for explicit human approval with detailed rationale\n- Return structured approval status with any modification instructions\n- Include suggested improvements for future iterations\n\nContext Integration: Use complete Gmail draft from previous step, incorporating all formatting and personalization elements.',
    estimatedTime: '1 min',
    dependencies: ['step-6-compose'],
  },
  {
    id: 'step-8-deliver',
    order: 8,
    title: 'Gmail Delivery',
    description: 'Send the approved digest and provide delivery confirmation.',
    status: StepNodeStatus.PENDING,
    nodeId: 'send-email-step',
    prompt:
      'You are an AI delivery manager using the @kimi model. Execute the final Gmail delivery with comprehensive tracking, analytics, and optimization capabilities.\n\n**ADVANCED DELIVERY EXECUTION:**\n1. Send approved digest via Gmail API with enhanced authentication and security\n2. Implement intelligent delivery retry mechanism with exponential backoff (3 attempts max)\n3. Handle rate limiting, API throttling, and quota management gracefully\n4. Process bounced emails with detailed categorization and recipient status updates\n5. Record comprehensive delivery timestamps and performance metrics for each recipient\n6. Implement delivery scheduling optimization based on recipient timezone and engagement patterns\n\n**COMPREHENSIVE DELIVERY MONITORING:**\n1. Track real-time email open rates, click-through rates, and engagement duration\n2. Monitor spam folder placement, deliverability scores, and sender reputation metrics\n3. Log delivery failures with detailed error codes, reasons, and remediation suggestions\n4. Record granular recipient engagement metrics and behavioral patterns\n5. Update subscription status for unsubscribes with feedback categorization\n6. Monitor inbox placement rates across different email providers\n7. Track mobile vs. desktop engagement patterns\n\n**ADVANCED ANALYTICS & INSIGHTS:**\n- Comprehensive recipient analysis: successful deliveries, engagement segments, preferences\n- Bounce rate analysis with categorization (hard bounce, soft bounce, temporary failures)\n- Spam complaint rates and sender reputation impact assessment\n- Engagement metrics: open rate trends, click patterns, time-to-engagement\n- Content performance: most clicked links, popular sections, engagement heatmaps\n- Comparative performance analysis vs. previous digests and industry benchmarks\n- Predictive analytics for future engagement optimization\n\n**ENHANCED CONFIRMATION & REPORTING:**\n1. Generate comprehensive delivery confirmation with actionable insights\n2. Create interactive performance dashboard with trending metrics\n3. Send detailed success notification to workflow administrator with recommendations\n4. Archive sent digest with metadata for future reference and A/B testing\n5. Schedule optimized next digest preparation based on performance data\n6. Generate subscriber growth and retention analytics\n\n**INTELLIGENT CLEANUP & OPTIMIZATION:**\n- Clean up temporary files and optimize storage usage\n- Update recipient preferences and segments based on engagement patterns\n- Flag system issues with priority levels and suggested investigations\n- Generate AI-powered recommendations for content, timing, and format improvements\n- Update ML models with engagement data for future optimization\n- Perform automated list hygiene and deliverability maintenance\n\n**COMPREHENSIVE OUTPUT:**\n- Return detailed delivery report with analytics, insights, and actionable recommendations\n- Include performance trends and optimization opportunities\n- Provide next digest preparation timeline and suggested improvements\n\nContext Integration: Use approval results from previous step and recipient email from @recipient_email variable.',
    estimatedTime: '1 min',
    dependencies: ['step-7-approve'],
  },
];

// Enhanced workflow configuration
export const DAILY_AI_NEWS_CONFIG = {
  title: 'Daily AI News Digest with Perplexity and Gmail',
  description:
    'This enhanced workflow provides an 8-step quality-assured process for daily AI news delivery. It includes news fetching via Perplexity, content extraction, quality filtering, professional formatting, manual approval, and Gmail delivery with confirmation.',
  triggerKeywords: [
    'Daily AI News Digest with Perplexity and Gmail',
    'daily ai news',
    'ai news digest',
    'perplexity gmail news',
    'automated ai newsletter',
    '8-step news workflow',
  ],
  variables: [
    {
      name: 'websiteUrl',
      type: 'text' as const,
      description: 'Perplexity AI API endpoint (required)',
      required: true,
      placeholder: 'https://api.perplexity.ai',
    },
    {
      name: 'recipientEmail',
      type: 'email' as const,
      description: 'Gmail address to receive the digest',
      required: false,
      placeholder: 'someone@gmail.com',
    },
    {
      name: 'newsCategories',
      type: 'text' as const,
      description: 'AI news categories to focus on',
      required: false,
      placeholder: 'AI research, machine learning, LLM, robotics',
    },
    {
      name: 'scheduleTime',
      type: 'time' as const,
      description: 'Daily execution time (24-hour format)',
      required: false,
      placeholder: '09:00',
    },
  ],
};

// Function to check if user input should trigger this workflow
export const shouldTriggerDailyNewsWorkflow = (userInput: string): boolean => {
  const input = userInput.toLowerCase().trim();

  // 要求更精确的匹配 - 输入必须至少包含8个字符才考虑触发
  if (input.length < 8) {
    return false;
  }

  // 检查是否匹配关键词
  const matches = DAILY_AI_NEWS_CONFIG.triggerKeywords.some((keyword) =>
    input.includes(keyword.toLowerCase()),
  );

  // 额外检查：确保输入看起来像是一个完整的请求而不是部分输入
  // 如果输入很长（超过30字符）或者包含特定的完整性指标，认为是完整请求
  const seemsComplete =
    input.length > 30 ||
    input.includes('digest') ||
    input.includes('workflow') ||
    input.includes('gmail') ||
    input.endsWith('.') ||
    input.endsWith('!') ||
    input.endsWith('?');

  return matches && seemsComplete;
};

// Combined workflow object for CopilotPanel
export const DAILY_NEWS_WORKFLOW = {
  id: 'daily-ai-news-digest',
  title: 'Daily AI News Digest',
  description: 'Complete 8-step workflow for daily AI news digest delivery',
  steps: DAILY_AI_NEWS_WORKFLOW_STEPS,
  config: DAILY_AI_NEWS_CONFIG,
};
