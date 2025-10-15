/**
 * Template Scraper Service
 * 爬取和解析工作流模板
 */

import {
  WorkflowTemplate,
  TemplateStep,
  TemplateVariable,
  TemplateProvider,
} from '../types/template';

export class TemplateScraper {
  private baseUrl = 'https://genfuseai.com';

  /**
   * 爬取所有模板
   */
  async scrapeAllTemplates(): Promise<WorkflowTemplate[]> {
    try {
      console.log('开始爬取模板库...');

      // 获取模板列表页面
      const response = await fetch(`${this.baseUrl}/template`);
      if (!response.ok) {
        throw new Error(`Failed to fetch templates: ${response.status}`);
      }

      const html = await response.text();
      const templateUrls = this.extractTemplateUrls(html);

      console.log(`发现 ${templateUrls.length} 个模板`);

      // 批量爬取每个模板的详细信息
      const templates: WorkflowTemplate[] = [];
      for (let i = 0; i < templateUrls.length; i++) {
        const url = templateUrls[i];
        console.log(`爬取模板 ${i + 1}/${templateUrls.length}: ${url}`);

        try {
          const template = await this.scrapeTemplateDetail(url);
          if (template) {
            templates.push(template);
          }
        } catch (error) {
          console.error(`爬取模板失败 ${url}:`, error);
        }

        // 添加延迟避免过于频繁的请求
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      console.log(`成功爬取 ${templates.length} 个模板`);
      return templates;
    } catch (error) {
      console.error('爬取模板库失败:', error);
      throw error;
    }
  }

  /**
   * 从HTML中提取模板URL列表
   */
  private extractTemplateUrls(html: string): string[] {
    const urls: string[] = [];
    const baseUrl = this.baseUrl;

    // 多种匹配模式，适应不同的HTML结构
    const patterns = [
      // 标准href链接
      /href=["']([^"']*\/template\/[^"']*?)["']/gi,
      // 相对路径链接
      /href=["'](\/template\/[^"']*?)["']/gi,
      // Next.js Link组件
      /"href":"(\/template\/[^"]*?)"/gi,
      // 可能的JSON数据
      /"url":"([^"]*\/template\/[^"]*?)"/gi,
    ];

    for (const pattern of patterns) {
      let match: RegExpExecArray | null;
      // biome-ignore lint/suspicious/noAssignInExpressions: RegExp.exec() requires assignment in while loop
      while ((match = pattern.exec(html)) !== null) {
        const url = match[1];
        const fullUrl = url.startsWith('http') ? url : `${baseUrl}${url}`;

        // 验证URL格式并去重
        if (this.isValidTemplateUrl(fullUrl) && !urls.includes(fullUrl)) {
          urls.push(fullUrl);
        }
      }
      // 重置正则表达式的lastIndex
      pattern.lastIndex = 0;
    }

    // 如果没有找到URL，尝试其他方法
    if (urls.length === 0) {
      console.warn('未找到模板URL，尝试备选方法...');
      urls.push(...this.extractUrlsFallback(html));
    }

    console.log(`提取到 ${urls.length} 个模板URL`);
    return urls;
  }

  /**
   * 备选URL提取方法
   */
  private extractUrlsFallback(html: string): string[] {
    const urls: string[] = [];

    // 查找包含"template"的所有路径
    const templatePaths = html.match(/\/template\/[\w\-]+/gi) || [];

    for (const path of templatePaths) {
      const fullUrl = `${this.baseUrl}${path}`;
      if (this.isValidTemplateUrl(fullUrl) && !urls.includes(fullUrl)) {
        urls.push(fullUrl);
      }
    }

    return urls;
  }

  /**
   * 验证模板URL
   */
  private isValidTemplateUrl(url: string): boolean {
    try {
      const urlObj = new URL(url);
      const path = urlObj.pathname;

      // 确保是有效的模板路径
      return (
        path.includes('/template/') &&
        path !== '/template' &&
        path !== '/template/' &&
        path.split('/').length >= 3 && // 至少是 /template/something
        !path.includes('..')
      ); // 防止路径遍历
    } catch {
      return false;
    }
  }

  /**
   * 爬取单个模板的详细信息
   */
  async scrapeTemplateDetail(url: string): Promise<WorkflowTemplate | null> {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch template: ${response.status}`);
      }

      const html = await response.text();
      return this.parseTemplateFromHtml(html, url);
    } catch (error) {
      console.error(`爬取模板详情失败 ${url}:`, error);
      return null;
    }
  }

  /**
   * 从HTML中解析模板信息
   */
  private parseTemplateFromHtml(html: string, sourceUrl: string): WorkflowTemplate | null {
    try {
      console.log(`解析模板: ${sourceUrl}`);

      // 提取标题 - 尝试多种方法
      const title = this.extractTitle(html, sourceUrl);

      // 提取描述 - 增强提取逻辑
      const description = this.extractDescription(html);

      // 提取分类
      const categories = this.extractCategories(html);

      // 提取步骤
      const steps = this.extractSteps(html);

      // 提取变量
      const variables = this.extractVariables(html, title, description);

      // 提取服务提供商
      const providers = this.extractProviders(html);

      // 生成ID
      const id = this.generateTemplateId(title, sourceUrl);

      // 生成触发关键词
      const triggerKeywords = this.generateTriggerKeywords(title, description, categories);

      console.log(`模板解析成功: ${title}`);
      console.log(
        `  步骤: ${steps.length}, 变量: ${variables.length}, 服务商: ${providers.length}`,
      );

      const template: WorkflowTemplate = {
        id,
        title,
        description,
        categories,
        steps,
        variables,
        providers,
        metadata: {
          estimatedDuration: this.estimateDuration(steps.length),
          complexity: this.estimateComplexity(steps.length, variables.length),
          popularity: 0,
          tags: this.extractTags(title, description),
          sourceUrl,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        triggerKeywords,
      };

      return template;
    } catch (error) {
      console.error('解析模板HTML失败:', error);
      return null;
    }
  }

  /**
   * 增强的标题提取
   */
  private extractTitle(html: string, sourceUrl: string): string {
    // 方法1: 从title标签提取
    let title = this.extractTextBetween(html, '<title>', '</title>');
    if (title) {
      title = title.replace(/\s*\|\s*.*$/, '').trim(); // 移除网站名称后缀
      if (title.length > 5) return title;
    }

    // 方法2: 从h1标签提取
    title = this.extractTextFromSelector(html, 'h1');
    if (title && title.length > 5) return title;

    // 方法3: 从meta property="og:title"提取
    title = this.extractMetaContent(html, 'og:title');
    if (title && title.length > 5) return title;

    // 方法4: 从URL路径推断
    try {
      const urlPath = new URL(sourceUrl).pathname;
      const pathSegments = urlPath.split('/').filter((segment) => segment);
      if (pathSegments.length >= 2) {
        title = pathSegments[pathSegments.length - 1]
          .replace(/-/g, ' ')
          .replace(/\b\w/g, (l) => l.toUpperCase());
        if (title.length > 5) return title;
      }
    } catch {}

    return 'Unknown Template';
  }

  /**
   * 增强的描述提取
   */
  private extractDescription(html: string): string {
    // 方法1: meta description
    let description = this.extractMetaContent(html, 'description');
    if (description && description.length > 20) return description;

    // 方法2: og:description
    description = this.extractMetaContent(html, 'og:description');
    if (description && description.length > 20) return description;

    // 方法3: 第一个段落
    description = this.extractTextFromSelector(html, 'p');
    if (description && description.length > 20) return description;

    // 方法4: 查找包含workflow关键词的文本
    const workflowMatch = html.match(
      />([^<]{20,200}(?:workflow|automation|process)[^<]{20,200})</i,
    );
    if (workflowMatch?.[1]) {
      return workflowMatch[1].trim();
    }

    return 'Automated workflow template for streamlined processes.';
  }

  /**
   * 提取文本内容
   */
  private extractTextBetween(html: string, startTag: string, endTag: string): string | null {
    const startIndex = html.indexOf(startTag);
    if (startIndex === -1) return null;

    const contentStart = startIndex + startTag.length;
    const endIndex = html.indexOf(endTag, contentStart);
    if (endIndex === -1) return null;

    return html.substring(contentStart, endIndex).trim();
  }

  /**
   * 提取Meta标签内容
   */
  private extractMetaContent(html: string, name: string): string | null {
    const regex = new RegExp(`<meta[^>]*name=["']${name}["'][^>]*content=["']([^"']*?)["']`, 'i');
    const match = html.match(regex);
    return match ? match[1] : null;
  }

  /**
   * 从选择器提取文本
   */
  private extractTextFromSelector(html: string, tag: string, index = 0): string | null {
    const regex = new RegExp(`<${tag}[^>]*>(.*?)<\\/${tag}>`, 'gi');
    const matches = [...html.matchAll(regex)];

    if (matches.length > index) {
      return matches[index][1].replace(/<[^>]*>/g, '').trim();
    }

    return null;
  }

  /**
   * 提取分类信息
   */
  private extractCategories(html: string): string[] {
    const categories: string[] = [];

    // 尝试从不同位置提取分类
    const categoryTexts = [
      'Research',
      'Marketing',
      'Sales',
      'Customer Support',
      'HR',
      'Education',
      'Finance',
      'Operations',
      'Development',
      'Design',
      'Content',
      'Analytics',
    ];

    for (const category of categoryTexts) {
      if (html.toLowerCase().includes(category.toLowerCase())) {
        categories.push(category);
      }
    }

    return categories.length > 0 ? categories : ['General'];
  }

  /**
   * 提取工作流步骤
   */
  private extractSteps(html: string): TemplateStep[] {
    const steps: TemplateStep[] = [];

    // 尝试从"How It Works"部分提取步骤
    const stepsSection =
      this.extractTextBetween(html, 'How It Works', '</div>') ||
      this.extractTextBetween(html, 'how it works', '</div>');

    if (stepsSection) {
      const stepMatches = stepsSection.match(/(\d+)[.\s]*([^.!?]*[.!?])/g);

      if (stepMatches) {
        stepMatches.forEach((stepText, _index) => {
          const cleanText = stepText.replace(/<[^>]*>/g, '').trim();
          const numberMatch = cleanText.match(/^(\d+)[.\s]*(.+)/);

          if (numberMatch) {
            steps.push({
              order: Number.parseInt(numberMatch[1]),
              title: `Step ${numberMatch[1]}`,
              description: numberMatch[2].trim(),
              estimatedTime: '2-3 min',
            });
          }
        });
      }
    }

    // 如果没有找到步骤，创建默认步骤
    if (steps.length === 0) {
      steps.push(
        {
          order: 1,
          title: 'Setup',
          description: 'Configure the workflow parameters',
          estimatedTime: '1-2 min',
        },
        {
          order: 2,
          title: 'Execute',
          description: 'Run the workflow automation',
          estimatedTime: '2-5 min',
        },
        {
          order: 3,
          title: 'Review',
          description: 'Check results and take action',
          estimatedTime: '1-2 min',
        },
      );
    }

    return steps;
  }

  /**
   * 提取变量配置
   */
  private extractVariables(html: string, title: string, description: string): TemplateVariable[] {
    const variables: TemplateVariable[] = [];
    const content = `${title} ${description} ${html}`.toLowerCase();

    // Email相关变量
    if (content.includes('email') || content.includes('gmail') || content.includes('mail')) {
      variables.push({
        name: 'recipientEmail',
        type: 'email',
        description: 'Email address to receive notifications',
        required: true,
        placeholder: 'your-email@example.com',
      });
    }

    // 调度相关变量
    if (content.includes('daily') || content.includes('schedule') || content.includes('time')) {
      variables.push({
        name: 'scheduleTime',
        type: 'time',
        description: 'Time to run the workflow daily',
        required: false,
        defaultValue: '09:00',
      });
    }

    // 搜索相关变量
    if (content.includes('search') || content.includes('query') || content.includes('keyword')) {
      variables.push({
        name: 'searchTerm',
        type: 'text',
        description: 'Search query or keywords',
        required: true,
        placeholder: 'Enter search terms',
      });
    }

    // 网站/URL相关变量
    if (content.includes('website') || content.includes('url') || content.includes('scrape')) {
      variables.push({
        name: 'websiteUrl',
        type: 'url',
        description: 'Website URL to process',
        required: true,
        placeholder: 'https://example.com',
      });
    }

    // 文档相关变量
    if (content.includes('document') || content.includes('file') || content.includes('pdf')) {
      variables.push({
        name: 'documentPath',
        type: 'text',
        description: 'Path to the document file',
        required: true,
        placeholder: '/path/to/document.pdf',
      });
    }

    // 公司/组织相关变量
    if (content.includes('company') || content.includes('organization')) {
      variables.push({
        name: 'companyName',
        type: 'text',
        description: 'Company or organization name',
        required: true,
        placeholder: 'Enter company name',
      });
    }

    // API相关变量
    if (content.includes('api') || content.includes('key') || content.includes('token')) {
      variables.push({
        name: 'apiKey',
        type: 'text',
        description: 'API key for service integration',
        required: true,
        placeholder: 'Enter API key',
      });
    }

    // 类别/分类相关变量
    if (content.includes('category') || content.includes('categories') || content.includes('tag')) {
      variables.push({
        name: 'categories',
        type: 'text',
        description: 'Content categories or tags',
        required: false,
        placeholder: 'tag1, tag2, tag3',
      });
    }

    return variables;
  }

  /**
   * 提取服务提供商
   */
  private extractProviders(html: string): TemplateProvider[] {
    const providers: TemplateProvider[] = [];
    const htmlLower = html.toLowerCase();

    const knownProviders = [
      { name: 'Google Sheets', keywords: ['google sheets', 'sheets'] },
      { name: 'Gmail', keywords: ['gmail', 'email'] },
      { name: 'Slack', keywords: ['slack'] },
      { name: 'Notion', keywords: ['notion'] },
      { name: 'Airtable', keywords: ['airtable'] },
      { name: 'Perplexity AI', keywords: ['perplexity'] },
      { name: 'OpenAI', keywords: ['openai', 'gpt'] },
      { name: 'LinkedIn', keywords: ['linkedin'] },
      { name: 'Twitter', keywords: ['twitter', 'x.com'] },
      { name: 'HubSpot', keywords: ['hubspot'] },
      { name: 'Salesforce', keywords: ['salesforce'] },
    ];

    for (const provider of knownProviders) {
      for (const keyword of provider.keywords) {
        if (htmlLower.includes(keyword)) {
          providers.push({
            name: provider.name,
            description: `Integration with ${provider.name}`,
          });
          break;
        }
      }
    }

    return providers;
  }

  /**
   * 生成模板ID
   */
  private generateTemplateId(title: string, url: string): string {
    const titleSlug = title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .substring(0, 50);

    const urlHash = url.split('/').pop() || 'unknown';
    return `${titleSlug}-${urlHash}`;
  }

  /**
   * 生成触发关键词
   */
  private generateTriggerKeywords(
    title: string,
    description: string,
    categories: string[],
  ): string[] {
    const keywords: string[] = [];

    // 添加标题关键词
    keywords.push(title.toLowerCase());

    // 从标题提取关键词
    const titleWords = title
      .toLowerCase()
      .split(/[\s\-_]+/)
      .filter((word) => word.length > 2);
    keywords.push(...titleWords);

    // 添加分类关键词
    keywords.push(...categories.map((cat) => cat.toLowerCase()));

    // 从描述提取关键词
    const descWords = description.toLowerCase().match(/\b\w{3,}\b/g) || [];
    keywords.push(...descWords.slice(0, 10));

    // 去重并返回
    return [...new Set(keywords)];
  }

  /**
   * 估算持续时间
   */
  private estimateDuration(stepCount: number): string {
    if (stepCount <= 2) return '5-10 min';
    if (stepCount <= 4) return '10-20 min';
    if (stepCount <= 6) return '20-30 min';
    return '30+ min';
  }

  /**
   * 估算复杂度
   */
  private estimateComplexity(
    stepCount: number,
    variableCount: number,
  ): 'beginner' | 'intermediate' | 'advanced' {
    const total = stepCount + variableCount;
    if (total <= 4) return 'beginner';
    if (total <= 8) return 'intermediate';
    return 'advanced';
  }

  /**
   * 提取标签
   */
  private extractTags(title: string, description: string): string[] {
    const text = `${title} ${description}`.toLowerCase();
    const tags: string[] = [];

    const tagMap = {
      automation: ['automat', 'schedul', 'trigger'],
      ai: ['ai', 'artificial intelligence', 'machine learning', 'gpt'],
      email: ['email', 'gmail', 'mail'],
      social: ['social', 'twitter', 'linkedin', 'facebook'],
      research: ['research', 'analysis', 'data'],
      marketing: ['marketing', 'campaign', 'lead'],
      sales: ['sales', 'crm', 'customer'],
      productivity: ['productiv', 'workflow', 'task'],
    };

    for (const [tag, keywords] of Object.entries(tagMap)) {
      if (keywords.some((keyword) => text.includes(keyword))) {
        tags.push(tag);
      }
    }

    return tags;
  }
}

export const templateScraper = new TemplateScraper();
