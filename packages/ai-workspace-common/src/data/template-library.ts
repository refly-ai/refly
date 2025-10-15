/**
 * 静态模板库
 * 基于GenFuse AI的模板，手动创建高质量模板数据
 */

import { WorkflowTemplate, TemplateLibrary } from '../types/template';

export const TEMPLATE_LIBRARY_DATA: WorkflowTemplate[] = [
  // Daily AI News Digest Template (参考模板)
  {
    id: 'daily-ai-news-digest-perplexity-gmail',
    title: 'Daily AI News Digest with Perplexity and Gmail',
    description:
      'This workflow automatically retrieves a daily summary of the latest AI news. It uses Perplexity AI to find relevant headlines and an LLM to reformat them into a clean, readable email. The formatted news digest is then sent to your inbox every morning.',
    categories: ['Research', 'Marketing', 'Automation'],
    steps: [
      {
        order: 1,
        title: 'Schedule Daily Trigger',
        description: 'Schedule the workflow to run daily at 9 AM',
        estimatedTime: '2 min',
        dependencies: [],
      },
      {
        order: 2,
        title: 'Fetch AI News Headlines',
        description: 'Use Perplexity AI to search for AI news headlines from the last 24 hours',
        estimatedTime: '3 min',
        dependencies: ['schedule-daily-trigger'],
      },
      {
        order: 3,
        title: 'Reformat News Content',
        description: 'Use an LLM to reformat the raw news data into a clean, readable email update',
        estimatedTime: '2 min',
        dependencies: ['fetch-ai-news-headlines'],
      },
      {
        order: 4,
        title: 'Send Gmail Digest',
        description: 'Send the formatted AI news digest to your inbox via Gmail',
        estimatedTime: '1 min',
        dependencies: ['reformat-news-content'],
      },
    ],
    variables: [
      {
        name: 'websiteUrl',
        type: 'url',
        description: 'Perplexity AI API endpoint (required)',
        required: true,
        placeholder: 'https://api.perplexity.ai',
        defaultValue: 'https://api.perplexity.ai',
      },
      {
        name: 'recipientEmail',
        type: 'email',
        description: 'Gmail address to receive the digest',
        required: true,
        placeholder: 'someone@gmail.com',
      },
      {
        name: 'newsCategories',
        type: 'text',
        description: 'AI news categories to focus on',
        required: false,
        placeholder: 'AI research, machine learning, LLM, robotics',
        defaultValue: 'AI research, machine learning, LLM, robotics, AI safety',
      },
      {
        name: 'scheduleTime',
        type: 'time',
        description: 'Daily execution time (24-hour format)',
        required: false,
        placeholder: '09:00',
        defaultValue: '09:00',
      },
    ],
    providers: [
      { name: 'Perplexity AI', description: 'AI-powered search engine' },
      { name: 'Gmail', description: 'Email service' },
      { name: 'OpenAI', description: 'AI language model' },
    ],
    metadata: {
      estimatedDuration: '10-15 min',
      complexity: 'intermediate',
      popularity: 95,
      tags: ['ai', 'news', 'automation', 'email', 'daily'],
      sourceUrl: 'https://genfuseai.com/template/daily-ai-news-digest-perplexity-gmail',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    triggerKeywords: [
      'daily ai news digest with perplexity and gmail',
      'daily ai news',
      'ai news digest',
      'perplexity gmail news',
      'automated ai newsletter',
      'daily news automation',
      'ai news email',
      'perplexity news',
      'gmail automation',
    ],
  },

  // AI Sales Lead Enrichment Template
  {
    id: 'ai-sales-lead-enrichment-company-name',
    title: 'AI Sales Lead Enrichment from Company Name',
    description:
      "This workflow automates sales lead enrichment. It starts with a company name, searches Google to find the company's primary website and LinkedIn profile, and then scrapes the website content to extract key business information.",
    categories: ['Sales', 'Marketing', 'Research'],
    steps: [
      {
        order: 1,
        title: 'Company Search',
        description: 'Search Google for company information and website',
        estimatedTime: '2-3 min',
        dependencies: [],
      },
      {
        order: 2,
        title: 'Website Scraping',
        description: 'Extract key information from company website',
        estimatedTime: '3-5 min',
        dependencies: ['company-search'],
      },
      {
        order: 3,
        title: 'LinkedIn Enrichment',
        description: 'Find and extract LinkedIn company profile data',
        estimatedTime: '2-3 min',
        dependencies: ['company-search'],
      },
      {
        order: 4,
        title: 'Data Compilation',
        description: 'Compile enriched data into structured format',
        estimatedTime: '1-2 min',
        dependencies: ['website-scraping', 'linkedin-enrichment'],
      },
    ],
    variables: [
      {
        name: 'companyName',
        type: 'text',
        description: 'Company name to research',
        required: true,
        placeholder: 'Enter company name',
      },
      {
        name: 'outputFormat',
        type: 'option',
        description: 'Output format for enriched data',
        required: false,
        defaultValue: 'JSON',
        options: ['JSON', 'CSV', 'Google Sheets'],
      },
    ],
    providers: [
      { name: 'Google Search', description: 'Search engine' },
      { name: 'LinkedIn', description: 'Professional network' },
      { name: 'Web Scraper', description: 'Content extraction tool' },
    ],
    metadata: {
      estimatedDuration: '8-13 min',
      complexity: 'advanced',
      popularity: 88,
      tags: ['sales', 'lead-generation', 'research', 'automation', 'data-enrichment'],
      sourceUrl: 'https://genfuseai.com/template/ai-sales-lead-enrichment-company-name',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    triggerKeywords: [
      'ai sales lead enrichment',
      'company research',
      'lead enrichment',
      'sales automation',
      'company information',
      'lead generation',
      'business intelligence',
      'company data',
    ],
  },

  // Document Summarization Template
  {
    id: 'ai-document-summarization-extraction',
    title: 'AI Document Summarization and Key Information Extraction',
    description:
      'Upload documents (PDF, Word, etc.) and get AI-generated summaries with key information extraction. Perfect for research, legal documents, reports, and academic papers.',
    categories: ['Document Processing', 'Research', 'Education'],
    steps: [
      {
        order: 1,
        title: 'Document Upload',
        description: 'Upload or specify document file for processing',
        estimatedTime: '1-2 min',
        dependencies: [],
      },
      {
        order: 2,
        title: 'Content Extraction',
        description: 'Extract text content from document',
        estimatedTime: '2-5 min',
        dependencies: ['document-upload'],
      },
      {
        order: 3,
        title: 'AI Summarization',
        description: 'Generate comprehensive summary using AI',
        estimatedTime: '3-7 min',
        dependencies: ['content-extraction'],
      },
      {
        order: 4,
        title: 'Key Information Extraction',
        description: 'Extract key facts, dates, and important details',
        estimatedTime: '2-4 min',
        dependencies: ['content-extraction'],
      },
    ],
    variables: [
      {
        name: 'documentPath',
        type: 'text',
        description: 'Path to document file or upload area',
        required: true,
        placeholder: '/path/to/document.pdf',
      },
      {
        name: 'summaryLength',
        type: 'option',
        description: 'Desired summary length',
        required: false,
        defaultValue: 'Medium',
        options: ['Short', 'Medium', 'Detailed'],
      },
      {
        name: 'extractionFocus',
        type: 'text',
        description: 'Specific information to focus on (optional)',
        required: false,
        placeholder: 'dates, names, financial data',
      },
    ],
    providers: [
      { name: 'OpenAI', description: 'AI text processing' },
      { name: 'Document Parser', description: 'File processing' },
    ],
    metadata: {
      estimatedDuration: '8-18 min',
      complexity: 'intermediate',
      popularity: 92,
      tags: ['document-processing', 'summarization', 'ai', 'research', 'extraction'],
      sourceUrl: 'https://genfuseai.com/template/ai-document-summarization-extraction',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    triggerKeywords: [
      'document summarization',
      'ai document summary',
      'pdf summary',
      'text extraction',
      'document analysis',
      'content summarization',
      'document processing',
      'information extraction',
    ],
  },

  // Social Media Content Creation Template
  {
    id: 'ai-social-media-content-scheduler',
    title: 'AI Social Media Content Creation and Scheduling',
    description:
      'Generate engaging social media posts using AI, customize for different platforms (Twitter, LinkedIn, Facebook), and schedule them automatically. Perfect for maintaining consistent social media presence.',
    categories: ['Marketing', 'Social Media', 'Content Creation'],
    steps: [
      {
        order: 1,
        title: 'Content Brief Input',
        description: 'Provide topic, keywords, and content guidelines',
        estimatedTime: '2-3 min',
        dependencies: [],
      },
      {
        order: 2,
        title: 'AI Content Generation',
        description: 'Generate platform-specific social media posts',
        estimatedTime: '3-5 min',
        dependencies: ['content-brief-input'],
      },
      {
        order: 3,
        title: 'Content Review & Edit',
        description: 'Review and edit generated content',
        estimatedTime: '5-10 min',
        dependencies: ['ai-content-generation'],
      },
      {
        order: 4,
        title: 'Schedule Publishing',
        description: 'Schedule posts across multiple platforms',
        estimatedTime: '2-3 min',
        dependencies: ['content-review-edit'],
      },
    ],
    variables: [
      {
        name: 'contentTopic',
        type: 'text',
        description: 'Main topic or theme for content',
        required: true,
        placeholder: 'AI innovation, productivity tips, etc.',
      },
      {
        name: 'platforms',
        type: 'option',
        description: 'Social media platforms to post on',
        required: true,
        options: ['Twitter', 'LinkedIn', 'Facebook', 'Instagram'],
      },
      {
        name: 'postingSchedule',
        type: 'text',
        description: 'When to publish the posts',
        required: false,
        placeholder: 'Daily at 9 AM, Weekly on Monday',
        defaultValue: 'Daily at 9 AM',
      },
    ],
    providers: [
      { name: 'OpenAI', description: 'Content generation' },
      { name: 'Twitter', description: 'Social media platform' },
      { name: 'LinkedIn', description: 'Professional network' },
      { name: 'Facebook', description: 'Social media platform' },
    ],
    metadata: {
      estimatedDuration: '12-21 min',
      complexity: 'intermediate',
      popularity: 89,
      tags: ['social-media', 'content-creation', 'marketing', 'automation', 'scheduling'],
      sourceUrl: 'https://genfuseai.com/template/ai-social-media-content-scheduler',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    triggerKeywords: [
      'social media automation',
      'content creation',
      'social media scheduling',
      'ai content generation',
      'twitter automation',
      'linkedin posting',
      'social media marketing',
      'content scheduler',
    ],
  },

  // Customer Support Ticket Analysis Template
  {
    id: 'ai-customer-support-ticket-analysis',
    title: 'AI Customer Support Ticket Analysis and Auto-Response',
    description:
      'Automatically analyze incoming customer support tickets, categorize them by urgency and type, generate appropriate responses, and route to the right team members.',
    categories: ['Customer Support', 'Automation', 'Communication'],
    steps: [
      {
        order: 1,
        title: 'Ticket Intake',
        description: 'Receive and parse new support tickets',
        estimatedTime: '1-2 min',
        dependencies: [],
      },
      {
        order: 2,
        title: 'AI Analysis',
        description: 'Analyze ticket content for category and urgency',
        estimatedTime: '2-3 min',
        dependencies: ['ticket-intake'],
      },
      {
        order: 3,
        title: 'Response Generation',
        description: 'Generate appropriate response based on ticket type',
        estimatedTime: '2-4 min',
        dependencies: ['ai-analysis'],
      },
      {
        order: 4,
        title: 'Route and Notify',
        description: 'Route to appropriate team and send notifications',
        estimatedTime: '1-2 min',
        dependencies: ['ai-analysis'],
      },
    ],
    variables: [
      {
        name: 'supportEmail',
        type: 'email',
        description: 'Support team email for notifications',
        required: true,
        placeholder: 'support@company.com',
      },
      {
        name: 'urgencyThreshold',
        type: 'option',
        description: 'Threshold for high-priority tickets',
        required: false,
        defaultValue: 'High',
        options: ['Low', 'Medium', 'High'],
      },
      {
        name: 'autoResponseEnabled',
        type: 'boolean',
        description: 'Enable automatic responses to customers',
        required: false,
        defaultValue: true,
      },
    ],
    providers: [
      { name: 'OpenAI', description: 'AI analysis and response generation' },
      { name: 'Gmail', description: 'Email processing' },
      { name: 'Slack', description: 'Team notifications' },
    ],
    metadata: {
      estimatedDuration: '6-11 min',
      complexity: 'advanced',
      popularity: 86,
      tags: ['customer-support', 'automation', 'ai-analysis', 'communication', 'ticketing'],
      sourceUrl: 'https://genfuseai.com/template/ai-customer-support-ticket-analysis',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    triggerKeywords: [
      'customer support automation',
      'ticket analysis',
      'support ticket ai',
      'customer service automation',
      'helpdesk automation',
      'support workflow',
      'ticket routing',
      'customer support ai',
    ],
  },
];

// 创建完整的模板库
export const createTemplateLibrary = (): TemplateLibrary => {
  const categories = new Set<string>();

  // 提取所有分类
  for (const template of TEMPLATE_LIBRARY_DATA) {
    for (const category of template.categories) {
      categories.add(category);
    }
  }

  return {
    version: '1.0.0',
    lastUpdated: new Date().toISOString(),
    totalTemplates: TEMPLATE_LIBRARY_DATA.length,
    templates: TEMPLATE_LIBRARY_DATA,
    categories: Array.from(categories).sort(),
  };
};
