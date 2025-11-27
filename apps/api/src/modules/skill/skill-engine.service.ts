import { Injectable, OnModuleInit } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { ConfigService } from '@nestjs/config';
import { ModuleRef } from '@nestjs/core';
import { ReflyService } from '@refly/agent-tools';
import { SkillEngine, SkillEngineOptions } from '@refly/skill-template';
import { genImageID } from '@refly/utils';
import { buildSuccessResponse } from '../../utils';
import { genBaseRespDataFromError } from '../../utils/exception';
import { ActionService } from '../action/action.service';
import { AuthService } from '../auth/auth.service';
import { CanvasSyncService } from '../canvas-sync/canvas-sync.service';
import { canvasPO2DTO } from '../canvas/canvas.dto';
import { CanvasService } from '../canvas/canvas.service';
import { codeArtifactPO2DTO } from '../code-artifact/code-artifact.dto';
import { CodeArtifactService } from '../code-artifact/code-artifact.service';
import { DriveService } from '../drive/drive.service';
import { DocumentService } from '../knowledge/document.service';
import { documentPO2DTO, resourcePO2DTO } from '../knowledge/knowledge.dto';
import { ParserFactory } from '../knowledge/parsers/factory';
import { ResourceService } from '../knowledge/resource.service';
import { MediaGeneratorService } from '../media-generator/media-generator.service';
import { MiscService } from '../misc/misc.service';
import { NotificationService } from '../notification/notification.service';
import { ProviderService } from '../provider/provider.service';
import { RAGService } from '../rag/rag.service';
import { SearchService } from '../search/search.service';
import { ShareCreationService } from '../share/share-creation.service';
import { ScaleboxService } from '../tool/sandbox/scalebox.service';
import { ToolService } from '../tool/tool.service';

@Injectable()
export class SkillEngineService implements OnModuleInit {
  private searchService: SearchService;
  private resourceService: ResourceService;
  private documentService: DocumentService;
  private ragService: RAGService;
  private canvasService: CanvasService;
  private providerService: ProviderService;
  private authService: AuthService;
  private mediaGeneratorService: MediaGeneratorService;
  private actionService: ActionService;
  private driveService: DriveService;
  private notificationService: NotificationService;
  private codeArtifactService: CodeArtifactService;
  private miscService: MiscService;
  private engine: SkillEngine;
  private canvasSyncService: CanvasSyncService;
  private toolService: ToolService;
  private scaleboxService: ScaleboxService;
  private shareCreationService: ShareCreationService;
  constructor(
    private moduleRef: ModuleRef,
    private config: ConfigService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(SkillEngineService.name);
  }

  async onModuleInit() {
    this.searchService = this.moduleRef.get(SearchService, { strict: false });
    this.resourceService = this.moduleRef.get(ResourceService, { strict: false });
    this.documentService = this.moduleRef.get(DocumentService, { strict: false });
    this.ragService = this.moduleRef.get(RAGService, { strict: false });
    this.canvasService = this.moduleRef.get(CanvasService, { strict: false });
    this.providerService = this.moduleRef.get(ProviderService, { strict: false });
    this.authService = this.moduleRef.get(AuthService, { strict: false });
    this.mediaGeneratorService = this.moduleRef.get(MediaGeneratorService, { strict: false });
    this.actionService = this.moduleRef.get(ActionService, { strict: false });
    this.driveService = this.moduleRef.get(DriveService, { strict: false });
    this.notificationService = this.moduleRef.get(NotificationService, { strict: false });
    this.codeArtifactService = this.moduleRef.get(CodeArtifactService, { strict: false });
    this.miscService = this.moduleRef.get(MiscService, { strict: false });
    this.canvasSyncService = this.moduleRef.get(CanvasSyncService, { strict: false });
    this.toolService = this.moduleRef.get(ToolService, { strict: false });
    this.scaleboxService = this.moduleRef.get(ScaleboxService, { strict: false });
    this.shareCreationService = this.moduleRef.get(ShareCreationService, { strict: false });
  }

  /**
   * Build the ReflyService object with all required methods, including the async property.
   */
  buildReflyService = (): ReflyService => {
    return {
      getUserMediaConfig: async (user, mediaType) => {
        const result = await this.providerService.getUserMediaConfig(user, mediaType);
        return result;
      },
      generateMedia: async (user, req) => {
        const result = await this.mediaGeneratorService.generate(user, req);
        return result;
      },
      getActionResult: async (user, req) => {
        const result = await this.actionService.getActionResult(user, req);
        return result;
      },
      createCanvas: async (user, req) => {
        const canvas = await this.canvasService.createCanvas(user, req);
        const canvasDTO = canvasPO2DTO(canvas);
        if (canvasDTO.usedToolsets && canvasDTO.usedToolsets.length > 0) {
          canvasDTO.usedToolsets = await this.toolService.populateToolsetsWithDefinition(
            canvasDTO.usedToolsets,
          );
        }
        return buildSuccessResponse(canvasDTO);
      },
      listCanvases: async (user, param) => {
        const canvasList = await this.canvasService.listCanvases(user, param);
        const canvasDTOs = canvasList.map((canvas) => canvasPO2DTO(canvas));
        const populatedCanvases = await Promise.all(
          canvasDTOs.map(async (canvasDTO) => {
            if (canvasDTO.usedToolsets && canvasDTO.usedToolsets.length > 0) {
              canvasDTO.usedToolsets = await this.toolService.populateToolsetsWithDefinition(
                canvasDTO.usedToolsets,
              );
            }
            return canvasDTO;
          }),
        );
        return buildSuccessResponse(populatedCanvases);
      },
      deleteCanvas: async (user, param) => {
        await this.canvasService.deleteCanvas(user, param);
        return buildSuccessResponse({});
      },
      getDocumentDetail: async (user, param) => {
        const document = await this.documentService.getDocumentDetail(user, param);
        return buildSuccessResponse(documentPO2DTO(document));
      },
      createDocument: async (user, req) => {
        const document = await this.documentService.createDocument(user, req);
        return documentPO2DTO(document);
      },
      listDocuments: async (user, param) => {
        const documentList = await this.documentService.listDocuments(user, param);
        return documentList.map((document) => documentPO2DTO(document));
      },
      deleteDocument: async (user, param) => {
        await this.documentService.deleteDocument(user, param);
      },
      getResourceDetail: async (user, req) => {
        const resource = await this.resourceService.getResourceDetail(user, req);
        return buildSuccessResponse(resourcePO2DTO(resource));
      },
      createResource: async (user, req) => {
        const resource = await this.resourceService.createResource(user, req);
        return buildSuccessResponse(resourcePO2DTO(resource));
      },
      batchCreateResource: async (user, req) => {
        const resources = await this.resourceService.batchCreateResource(user, req);
        return buildSuccessResponse(resources.map(resourcePO2DTO));
      },
      updateResource: async (user, req) => {
        const resource = await this.resourceService.updateResource(user, req);
        return buildSuccessResponse(resourcePO2DTO(resource));
      },
      createCodeArtifact: async (user, req) => {
        const result = await this.codeArtifactService.createCodeArtifact(user, req);
        return codeArtifactPO2DTO(result);
      },
      webSearch: async (user, req) => {
        const result = await this.searchService.webSearch(user, req);
        return buildSuccessResponse(result);
      },
      rerank: async (user, query, results, options) => {
        const result = await this.ragService.rerank(user, query, results, options);
        return buildSuccessResponse(result);
      },
      librarySearch: async (user, req, options) => {
        const result = await this.searchService.search(user, req, options);
        return buildSuccessResponse(result);
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
      sendEmail: async (user, req) => {
        try {
          await this.notificationService.sendEmail(req, user);
          return buildSuccessResponse();
        } catch (error) {
          const baseRespData = genBaseRespDataFromError(error);
          this.logger.error(`Failed to send email: ${error.stack}`);
          return baseRespData;
        }
      },
      generateJwtToken: async (user) => {
        // Use the same JWT generation method as AuthService.login()
        const tokenData = await this.authService.login(user);
        return tokenData.accessToken;
      },
      processURL: async (url) => {
        const result = await this.notificationService.processURL(url);
        return result;
      },
      batchProcessURL: async (urls) => {
        const result = await this.notificationService.batchProcessURL(urls);
        return result;
      },
      downloadFile: async (params) => {
        const result = await this.miscService.downloadFile(params);
        return result;
      },
      downloadFileFromUrl: async (url) => {
        const result = await this.miscService.downloadFileFromUrl(url);
        return result;
      },
      uploadFile: async (user, param) => {
        const result = await this.miscService.uploadFile(user, param);
        return result;
      },
      uploadBase64: async (user, param) => {
        const result = await this.miscService.uploadBase64(user, param);
        return result;
      },
      readFile: async (user, fileId) => {
        const result = await this.driveService.getDriveFileDetail(user, fileId);
        return result;
      },
      writeFile: async (user, param) => {
        return await this.driveService.createDriveFile(user, param);
      },
      createShareForDriveFile: async (user, fileId) => {
        const { shareRecord, driveFile } = await this.shareCreationService.createShareForDriveFile(
          user,
          {
            entityId: fileId,
            entityType: 'driveFile',
            allowDuplication: false,
          },
        );

        const url = `${this.config.get('origin')}/share/file/${shareRecord.shareId}`;

        return { url, shareId: shareRecord.shareId, driveFile };
      },
      genImageID: async () => {
        return genImageID();
      },
      execute: async (user, req) => {
        return await this.scaleboxService.execute(user, req);
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
