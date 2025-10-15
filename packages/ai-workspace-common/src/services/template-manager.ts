/**
 * Template Manager Service
 * 模板存储和管理系统
 */

import {
  WorkflowTemplate,
  TemplateLibrary,
  TemplateSearchOptions,
  TemplateSearchResult,
  TemplateTriggerResult,
} from '../types/template';
import { templateScraper } from './template-scraper';
import { createTemplateLibrary, TEMPLATE_LIBRARY_DATA } from '../data/template-library';

export class TemplateManager {
  private storageKey = 'refly-template-library';
  private library: TemplateLibrary | null = null;
  private lastUpdateCheck = 0;
  private updateInterval = 24 * 60 * 60 * 1000; // 24小时
  private useStaticData = true; // 默认使用静态数据，提供更好的稳定性

  constructor() {
    this.initializeLibrary();
  }

  /**
   * 初始化模板库
   */
  private async initializeLibrary(): Promise<void> {
    // 首先加载静态模板数据
    this.library = createTemplateLibrary();
    console.log(`初始化模板库: ${this.library.totalTemplates} 个静态模板`);

    // 尝试从本地存储加载额外的模板
    this.loadStoredTemplates();

    // 可选：在后台异步更新爬取的模板
    if (!this.useStaticData) {
      this.updateLibraryInBackground();
    }
  }

  /**
   * 设置是否使用静态数据
   */
  setUseStaticData(useStatic: boolean): void {
    this.useStaticData = useStatic;
    if (!useStatic) {
      this.updateLibraryInBackground();
    }
  }

  /**
   * 获取模板库
   */
  async getLibrary(): Promise<TemplateLibrary> {
    if (!this.library) {
      await this.initializeLibrary();
    }

    // 如果使用静态数据或不需要更新，直接返回
    if (this.useStaticData || !this.shouldUpdate()) {
      return this.library!;
    }

    // 异步更新但不阻塞返回
    this.updateLibraryInBackground();
    return this.library!;
  }

  /**
   * 后台异步更新模板库
   */
  private async updateLibraryInBackground(): Promise<void> {
    try {
      console.log('后台更新模板库...');
      await this.updateLibrary(false);
    } catch (error) {
      console.error('后台更新失败:', error);
    }
  }

  /**
   * 从存储加载额外模板
   */
  private loadStoredTemplates(): void {
    try {
      const stored = localStorage.getItem(`${this.storageKey}-additional`);
      if (stored) {
        const additionalTemplates: WorkflowTemplate[] = JSON.parse(stored);
        if (this.library && additionalTemplates.length > 0) {
          // 合并额外的模板，避免重复
          const existingIds = new Set(this.library.templates.map((t) => t.id));
          const newTemplates = additionalTemplates.filter((t) => !existingIds.has(t.id));

          if (newTemplates.length > 0) {
            this.library.templates.push(...newTemplates);
            this.library.totalTemplates = this.library.templates.length;
            this.library.categories = this.extractAllCategories(this.library.templates);
            console.log(`加载了 ${newTemplates.length} 个额外模板`);
          }
        }
      }
    } catch (error) {
      console.error('加载额外模板失败:', error);
    }
  }

  /**
   * 搜索模板
   */
  async searchTemplates(options: TemplateSearchOptions): Promise<TemplateSearchResult> {
    const library = await this.getLibrary();
    let templates = [...library.templates];

    // 按查询词过滤
    if (options.query) {
      const query = options.query.toLowerCase();
      templates = templates.filter(
        (template) =>
          template.title.toLowerCase().includes(query) ||
          template.description.toLowerCase().includes(query) ||
          template.triggerKeywords.some((keyword) => keyword.includes(query)) ||
          template.metadata.tags.some((tag) => tag.toLowerCase().includes(query)),
      );
    }

    // 按分类过滤
    if (options.categories && options.categories.length > 0) {
      templates = templates.filter((template) =>
        template.categories.some((cat) => options.categories!.includes(cat)),
      );
    }

    // 按服务提供商过滤
    if (options.providers && options.providers.length > 0) {
      templates = templates.filter((template) =>
        template.providers.some((provider) => options.providers!.includes(provider.name)),
      );
    }

    // 按复杂度过滤
    if (options.complexity && options.complexity.length > 0) {
      templates = templates.filter((template) =>
        options.complexity!.includes(template.metadata.complexity),
      );
    }

    // 按标签过滤
    if (options.tags && options.tags.length > 0) {
      templates = templates.filter((template) =>
        template.metadata.tags.some((tag) => options.tags!.includes(tag)),
      );
    }

    // 按受欢迎程度排序
    templates.sort((a, b) => b.metadata.popularity - a.metadata.popularity);

    // 分页
    const offset = options.offset || 0;
    const limit = options.limit || 20;
    const total = templates.length;
    const paginatedTemplates = templates.slice(offset, offset + limit);

    return {
      templates: paginatedTemplates,
      total,
      hasMore: offset + limit < total,
    };
  }

  /**
   * 根据用户输入检测匹配的模板
   */
  async detectTemplate(userInput: string): Promise<TemplateTriggerResult> {
    const library = await this.getLibrary();
    const input = userInput.toLowerCase().trim();

    let bestMatch: { template: WorkflowTemplate; confidence: number; keywords: string[] } | null =
      null;

    for (const template of library.templates) {
      const matchResult = this.calculateTemplateMatch(input, template);

      if (
        matchResult.confidence > 0 &&
        (!bestMatch || matchResult.confidence > bestMatch.confidence)
      ) {
        bestMatch = matchResult;
      }
    }

    if (bestMatch && bestMatch.confidence >= 0.6) {
      // 阈值调整
      return {
        triggered: true,
        template: bestMatch.template,
        confidence: bestMatch.confidence,
        matchedKeywords: bestMatch.keywords,
      };
    }

    return {
      triggered: false,
      template: null,
      confidence: 0,
      matchedKeywords: [],
    };
  }

  /**
   * 获取模板详情
   */
  async getTemplate(id: string): Promise<WorkflowTemplate | null> {
    const library = await this.getLibrary();
    return library.templates.find((template) => template.id === id) || null;
  }

  /**
   * 获取所有分类
   */
  async getCategories(): Promise<string[]> {
    const library = await this.getLibrary();
    return library.categories;
  }

  /**
   * 获取推荐模板
   */
  async getRecommendedTemplates(limit = 6): Promise<WorkflowTemplate[]> {
    const searchResult = await this.searchTemplates({
      limit,
      // 可以根据用户历史记录或偏好进行推荐
    });
    return searchResult.templates;
  }

  /**
   * 更新模板库
   */
  async updateLibrary(force = false): Promise<void> {
    if (!force && this.library && !this.shouldUpdate()) {
      return;
    }

    try {
      console.log('开始更新模板库...');

      // 如果使用静态数据，只更新爬取到的额外模板
      if (this.useStaticData) {
        await this.updateAdditionalTemplates();
        return;
      }

      // 完整爬取模式（包含静态数据）
      const scrapedTemplates = await templateScraper.scrapeAllTemplates();

      // 合并静态模板和爬取模板
      const staticTemplates = TEMPLATE_LIBRARY_DATA;
      const staticIds = new Set(staticTemplates.map((t) => t.id));
      const additionalTemplates = scrapedTemplates.filter((t) => !staticIds.has(t.id));

      const allTemplates = [...staticTemplates, ...additionalTemplates];
      const categories = this.extractAllCategories(allTemplates);

      // 创建新的库对象
      const newLibrary: TemplateLibrary = {
        version: '1.0.0',
        lastUpdated: new Date().toISOString(),
        totalTemplates: allTemplates.length,
        templates: allTemplates,
        categories,
      };

      // 保存到存储
      this.library = newLibrary;
      this.saveLibrary();
      this.lastUpdateCheck = Date.now();

      // 单独保存额外的模板
      this.saveAdditionalTemplates(additionalTemplates);

      console.log(
        `模板库更新完成: 静态 ${staticTemplates.length} + 爬取 ${additionalTemplates.length} = 总计 ${allTemplates.length} 个模板`,
      );
    } catch (error) {
      console.error('更新模板库失败:', error);

      // 如果失败且没有库，使用静态数据
      if (!this.library) {
        this.library = createTemplateLibrary();
        console.log('使用静态模板数据作为后备');
      }
    }
  }

  /**
   * 更新额外模板（仅爬取新模板）
   */
  private async updateAdditionalTemplates(): Promise<void> {
    try {
      console.log('更新额外模板...');

      const scrapedTemplates = await templateScraper.scrapeAllTemplates();
      const staticIds = new Set(TEMPLATE_LIBRARY_DATA.map((t) => t.id));
      const additionalTemplates = scrapedTemplates.filter((t) => !staticIds.has(t.id));

      if (additionalTemplates.length > 0) {
        this.saveAdditionalTemplates(additionalTemplates);

        // 更新当前库
        if (this.library) {
          const existingIds = new Set(this.library.templates.map((t) => t.id));
          const newTemplates = additionalTemplates.filter((t) => !existingIds.has(t.id));

          if (newTemplates.length > 0) {
            this.library.templates.push(...newTemplates);
            this.library.totalTemplates = this.library.templates.length;
            this.library.categories = this.extractAllCategories(this.library.templates);
          }
        }

        console.log(`更新了 ${additionalTemplates.length} 个额外模板`);
      }

      this.lastUpdateCheck = Date.now();
    } catch (error) {
      console.error('更新额外模板失败:', error);
    }
  }

  /**
   * 保存额外模板到本地存储
   */
  private saveAdditionalTemplates(templates: WorkflowTemplate[]): void {
    try {
      localStorage.setItem(`${this.storageKey}-additional`, JSON.stringify(templates));
      console.log(`保存了 ${templates.length} 个额外模板`);
    } catch (error) {
      console.error('保存额外模板失败:', error);
    }
  }

  /**
   * 手动添加模板
   */
  addTemplate(template: WorkflowTemplate): void {
    if (!this.library) {
      this.library = {
        version: '1.0.0',
        lastUpdated: new Date().toISOString(),
        totalTemplates: 0,
        templates: [],
        categories: [],
      };
    }

    // 检查是否已存在
    const existingIndex = this.library.templates.findIndex((t) => t.id === template.id);
    if (existingIndex >= 0) {
      this.library.templates[existingIndex] = template;
    } else {
      this.library.templates.push(template);
      this.library.totalTemplates = this.library.templates.length;
    }

    // 更新分类列表
    this.library.categories = this.extractAllCategories(this.library.templates);
    this.library.lastUpdated = new Date().toISOString();

    this.saveLibrary();
  }

  /**
   * 计算模板匹配度
   */
  private calculateTemplateMatch(
    input: string,
    template: WorkflowTemplate,
  ): {
    template: WorkflowTemplate;
    confidence: number;
    keywords: string[];
  } {
    let score = 0;
    const matchedKeywords: string[] = [];
    const maxScore = template.triggerKeywords.length;

    // 检查触发关键词匹配
    for (const keyword of template.triggerKeywords) {
      if (input.includes(keyword)) {
        matchedKeywords.push(keyword);

        // 根据关键词长度和匹配精确度给分
        const keywordScore = keyword.length / 10; // 长关键词权重更高
        const exactMatch = input === keyword ? 2 : 1; // 精确匹配加分
        score += keywordScore * exactMatch;
      }
    }

    // 检查标题匹配
    if (input.includes(template.title.toLowerCase())) {
      score += 5;
      matchedKeywords.push(template.title);
    }

    // 检查分类匹配
    for (const category of template.categories) {
      if (input.includes(category.toLowerCase())) {
        score += 2;
        matchedKeywords.push(category);
      }
    }

    // 计算置信度 (0-1)
    const confidence = Math.min(score / Math.max(maxScore, 5), 1);

    return {
      template,
      confidence,
      keywords: matchedKeywords,
    };
  }

  /**
   * 是否需要更新
   */
  private shouldUpdate(): boolean {
    return Date.now() - this.lastUpdateCheck > this.updateInterval;
  }

  /**
   * 从存储加载模板库
   */
  private loadLibrary(): void {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        this.library = JSON.parse(stored);
        this.lastUpdateCheck = Date.now();
        console.log(`从缓存加载模板库，共 ${this.library?.totalTemplates || 0} 个模板`);
      }
    } catch (error) {
      console.error('加载模板库失败:', error);
      this.library = null;
    }
  }

  /**
   * 保存模板库到存储
   */
  private saveLibrary(): void {
    try {
      if (this.library) {
        localStorage.setItem(this.storageKey, JSON.stringify(this.library));
        console.log('模板库已保存到本地存储');
      }
    } catch (error) {
      console.error('保存模板库失败:', error);
    }
  }

  /**
   * 提取所有分类
   */
  private extractAllCategories(templates: WorkflowTemplate[]): string[] {
    const categorySet = new Set<string>();

    for (const template of templates) {
      for (const category of template.categories) {
        categorySet.add(category);
      }
    }

    return Array.from(categorySet).sort();
  }
}

export const templateManager = new TemplateManager();
