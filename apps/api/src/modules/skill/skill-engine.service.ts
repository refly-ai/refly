import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { ReflyService, SkillEngine, SkillEngineOptions } from '@refly/skill-template';
import { CanvasService } from '../canvas/canvas.service';
import { KnowledgeService } from '../knowledge/knowledge.service';
import { LabelService } from '../label/label.service';
import { McpServerService } from '../mcp-server/mcp-server.service';
import { ProviderService } from '../provider/provider.service';
import { RAGService } from '../rag/rag.service';
import { SearchService } from '../search/search.service';
import { buildSuccessResponse } from '../../utils';
import { mcpServerPO2DTO } from '../mcp-server/mcp-server.dto';
import { canvasPO2DTO } from '../canvas/canvas.dto';
import { ParserFactory } from '../knowledge/parsers/factory';
import { documentPO2DTO, referencePO2DTO, resourcePO2DTO } from '../knowledge/knowledge.dto';
import { labelClassPO2DTO, labelPO2DTO } from '../label/label.dto';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth/auth.service';

@Injectable()
export class SkillEngineService implements OnModuleInit {
  private logger = new Logger(SkillEngineService.name);

  private labelService: LabelService;
  private searchService: SearchService;
  private knowledgeService: KnowledgeService;
  private ragService: RAGService;
  private canvasService: CanvasService;
  private providerService: ProviderService;
  private mcpServerService: McpServerService;
  private authService: AuthService;

  private engine: SkillEngine;

  constructor(
    private moduleRef: ModuleRef,
    private config: ConfigService,
  ) {}

  async onModuleInit() {
    this.labelService = this.moduleRef.get(LabelService, { strict: false });
    this.searchService = this.moduleRef.get(SearchService, { strict: false });
    this.knowledgeService = this.moduleRef.get(KnowledgeService, { strict: false });
    this.ragService = this.moduleRef.get(RAGService, { strict: false });
    this.canvasService = this.moduleRef.get(CanvasService, { strict: false });
    this.providerService = this.moduleRef.get(ProviderService, { strict: false });
    this.mcpServerService = this.moduleRef.get(McpServerService, { strict: false });
    this.authService = this.moduleRef.get(AuthService, { strict: false });
  }

  buildReflyService = (): ReflyService => {
    return {
      listMcpServers: async (user, req) => {
        const servers = await this.mcpServerService.listMcpServers(user, req);
        return buildSuccessResponse(servers.map(mcpServerPO2DTO));
      },
      createCanvas: async (user, req) => {
        const canvas = await this.canvasService.createCanvas(user, req);
        return buildSuccessResponse(canvasPO2DTO(canvas));
      },
      listCanvases: async (user, param) => {
        const canvasList = await this.canvasService.listCanvases(user, param);
        return buildSuccessResponse(canvasList.map((canvas) => canvasPO2DTO(canvas)));
      },
      deleteCanvas: async (user, param) => {
        await this.canvasService.deleteCanvas(user, param);
        return buildSuccessResponse({});
      },
      getDocumentDetail: async (user, param) => {
        const canvas = await this.knowledgeService.getDocumentDetail(user, param);
        return buildSuccessResponse(documentPO2DTO(canvas));
      },
      createDocument: async (user, req) => {
        const canvas = await this.knowledgeService.createDocument(user, req);
        return buildSuccessResponse(documentPO2DTO(canvas));
      },
      listDocuments: async (user, param) => {
        const canvasList = await this.knowledgeService.listDocuments(user, param);
        return buildSuccessResponse(canvasList.map((canvas) => documentPO2DTO(canvas)));
      },
      deleteDocument: async (user, param) => {
        await this.knowledgeService.deleteDocument(user, param);
        return buildSuccessResponse({});
      },
      getResourceDetail: async (user, req) => {
        const resource = await this.knowledgeService.getResourceDetail(user, req);
        return buildSuccessResponse(resourcePO2DTO(resource));
      },
      createResource: async (user, req) => {
        const resource = await this.knowledgeService.createResource(user, req);
        return buildSuccessResponse(resourcePO2DTO(resource));
      },
      batchCreateResource: async (user, req) => {
        const resources = await this.knowledgeService.batchCreateResource(user, req);
        return buildSuccessResponse(resources.map(resourcePO2DTO));
      },
      updateResource: async (user, req) => {
        const resource = await this.knowledgeService.updateResource(user, req);
        return buildSuccessResponse(resourcePO2DTO(resource));
      },
      createLabelClass: async (user, req) => {
        const labelClass = await this.labelService.createLabelClass(user, req);
        return buildSuccessResponse(labelClassPO2DTO(labelClass));
      },
      createLabelInstance: async (user, req) => {
        const labels = await this.labelService.createLabelInstance(user, req);
        return buildSuccessResponse(labels.map((label) => labelPO2DTO(label)));
      },
      webSearch: async (user, req) => {
        const result = await this.searchService.webSearch(user, req);
        return buildSuccessResponse(result);
      },
      rerank: async (user, query, results, options) => {
        const result = await this.ragService.rerank(user, query, results, options);
        return buildSuccessResponse(result);
      },
      search: async (user, req, options) => {
        const result = await this.searchService.search(user, req, options);
        return buildSuccessResponse(result);
      },
      addReferences: async (user, req) => {
        const references = await this.knowledgeService.addReferences(user, req);
        return buildSuccessResponse(references.map(referencePO2DTO));
      },
      deleteReferences: async (user, req) => {
        await this.knowledgeService.deleteReferences(user, req);
        return buildSuccessResponse({});
      },
      inMemorySearchWithIndexing: async (user, options) => {
        const result = await this.ragService.inMemorySearchWithIndexing(user, options);
        return buildSuccessResponse(result);
      },
      crawlUrl: async (user, url) => {
        try {
          const parserFactory = new ParserFactory(this.config, this.providerService);
          const jinaParser = await parserFactory.createWebParser(user, {
            resourceId: `temp-${Date.now()}`,
          });

          const result = await jinaParser.parse(url);

          return {
            title: result.title,
            content: result.content,
            metadata: { ...result.metadata, url },
          };
        } catch (error) {
          this.logger.error(`Failed to crawl URL ${url}: ${error.stack}`);
          return {
            title: '',
            content: '',
            metadata: { url, error: error.message },
          };
        }
      },
      generateJwtToken: async (user) => {
        // Use the same JWT generation method as AuthService.login()
        const tokenData = await this.authService.login(user);
        return tokenData.accessToken;
      },
    };
  };

  public getEngine() {
    if (!this.engine) {
      // Get all configuration from config service
      const appConfig = {
        port: this.config.get('port'),
        wsPort: this.config.get('wsPort'),
        origin: this.config.get('origin'),
        static: this.config.get('static'),
        local: this.config.get('local'),
        image: this.config.get('image'),
        redis: this.config.get('redis'),
        objectStorage: this.config.get('objectStorage'),
        vectorStore: this.config.get('vectorStore'),
        fulltextSearch: this.config.get('fulltextSearch'),
        auth: this.config.get('auth'),
        encryption: this.config.get('encryption'),
        skill: this.config.get('skill'),
        defaultModel: this.config.get('defaultModel'),
        stripe: this.config.get('stripe'),
        quota: this.config.get('quota'),
        langfuse: this.config.get('langfuse'),
      };

      const options = {
        config: appConfig,
      } as SkillEngineOptions;

      this.engine = new SkillEngine(this.logger, this.buildReflyService(), options);
    }
    return this.engine;
  }
}
