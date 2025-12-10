import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  UseGuards,
  ParseIntPipe,
  DefaultValuePipe,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  User,
  UpsertResourceRequest,
  UpsertResourceResponse,
  ListResourceResponse,
  GetResourceDetailResponse,
  DeleteResourceRequest,
  DeleteResourceResponse,
  ResourceType,
  BatchCreateResourceResponse,
  ReindexResourceRequest,
  ReindexResourceResponse,
  ListOrder,
  ListDocumentResponse,
  GetDocumentDetailResponse,
  UpsertDocumentRequest,
  UpsertDocumentResponse,
  DeleteDocumentRequest,
} from '@refly/openapi-schema';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { buildSuccessResponse } from '../../utils';
import { LoginedUser } from '../../utils/decorators/user.decorator';
import { documentPO2DTO, resourcePO2DTO } from './knowledge.dto';
import { ParamsError } from '@refly/errors';
import { safeParseJSON } from '@refly/utils';
import { ResourceService } from './resource.service';
import { DocumentService } from './document.service';

@Controller('v1/knowledge')
export class KnowledgeController {
  constructor(
    private resourceService: ResourceService,
    private documentService: DocumentService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Get('resource/list')
  async listResources(
    @LoginedUser() user: User,
    @Query('resourceId') resourceId: string,
    @Query('resourceType') resourceType: ResourceType,
    @Query('projectId') projectId: string,
    @Query('canvasId') canvasId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('pageSize', new DefaultValuePipe(10), ParseIntPipe) pageSize: number,
    @Query('order', new DefaultValuePipe('creationDesc')) order: ListOrder,
  ): Promise<ListResourceResponse> {
    const resources = await this.resourceService.listResources(user, {
      resourceId,
      resourceType,
      projectId,
      canvasId,
      page,
      pageSize,
      order,
    });
    return buildSuccessResponse(resources?.map(resourcePO2DTO));
  }

  @UseGuards(JwtAuthGuard)
  @Get('resource/detail')
  async showResourceDetail(
    @LoginedUser() user: User,
    @Query('resourceId') resourceId: string,
  ): Promise<GetResourceDetailResponse> {
    const resource = await this.resourceService.getResourceDetail(user, { resourceId });
    return buildSuccessResponse(resourcePO2DTO(resource));
  }

  @UseGuards(JwtAuthGuard)
  @Post('resource/create')
  async createResource(
    @LoginedUser() user: User,
    @Body() body: UpsertResourceRequest,
  ): Promise<UpsertResourceResponse> {
    const resource = await this.resourceService.createResource(user, body, {
      checkStorageQuota: true,
      syncStorageUsage: true,
    });
    return buildSuccessResponse(resourcePO2DTO(resource));
  }

  @UseGuards(JwtAuthGuard)
  @Post('resource/createWithFile')
  @UseInterceptors(FileInterceptor('file'))
  async createResourceWithFile(
    @LoginedUser() user: User,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: UpsertResourceRequest,
  ): Promise<UpsertResourceResponse> {
    if (!file) {
      throw new ParamsError('File is required');
    }

    // Convert file content to string
    const content = file.buffer.toString('utf-8');
    const data = typeof body.data === 'object' ? body.data : safeParseJSON(body.data);

    // Create resource with file content
    const resource = await this.resourceService.createResource(
      user,
      {
        ...body,
        content,
        data,
      },
      {
        checkStorageQuota: true,
        syncStorageUsage: true,
      },
    );

    return buildSuccessResponse(resourcePO2DTO(resource));
  }

  @UseGuards(JwtAuthGuard)
  @Post('resource/batchCreate')
  async importResource(
    @LoginedUser() user: User,
    @Body() body: UpsertResourceRequest[],
  ): Promise<BatchCreateResourceResponse> {
    const resources = await this.resourceService.batchCreateResource(user, body ?? []);
    return buildSuccessResponse(resources.map(resourcePO2DTO));
  }

  @UseGuards(JwtAuthGuard)
  @Post('resource/update')
  async updateResource(
    @LoginedUser() user: User,
    @Body() body: UpsertResourceRequest,
  ): Promise<UpsertResourceResponse> {
    const { resourceId } = body;
    if (!resourceId) {
      throw new ParamsError('Resource ID is required');
    }

    // Check if the resource exists
    await this.resourceService.getResourceDetail(user, { resourceId });

    const updated = await this.resourceService.updateResource(user, body);
    return buildSuccessResponse(resourcePO2DTO(updated));
  }

  @UseGuards(JwtAuthGuard)
  @Post('resource/reindex')
  async reindexResource(
    @LoginedUser() user: User,
    @Body() body: ReindexResourceRequest,
  ): Promise<ReindexResourceResponse> {
    const resources = await this.resourceService.reindexResource(user, body);
    return buildSuccessResponse(resources.map(resourcePO2DTO));
  }

  @UseGuards(JwtAuthGuard)
  @Post('resource/delete')
  async deleteResource(
    @LoginedUser() user: User,
    @Body() body: DeleteResourceRequest,
  ): Promise<DeleteResourceResponse> {
    if (!body.resourceId) {
      throw new ParamsError('Resource ID is required');
    }
    await this.resourceService.deleteResource(user, body.resourceId);
    return buildSuccessResponse(null);
  }

  @UseGuards(JwtAuthGuard)
  @Get('document/list')
  async listDocuments(
    @LoginedUser() user: User,
    @Query('projectId') projectId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('pageSize', new DefaultValuePipe(10), ParseIntPipe) pageSize: number,
    @Query('order', new DefaultValuePipe('creationDesc')) order: ListOrder,
  ): Promise<ListDocumentResponse> {
    const documents = await this.documentService.listDocuments(user, {
      page,
      pageSize,
      order,
      projectId,
    });
    return buildSuccessResponse((documents ?? []).map(documentPO2DTO));
  }

  @UseGuards(JwtAuthGuard)
  @Get('document/detail')
  async getDocumentDetail(
    @LoginedUser() user: User,
    @Query('docId') docId: string,
  ): Promise<GetDocumentDetailResponse> {
    const document = await this.documentService.getDocumentDetail(user, { docId });
    return buildSuccessResponse(documentPO2DTO(document));
  }

  @UseGuards(JwtAuthGuard)
  @Post('document/create')
  async createDocument(
    @LoginedUser() user: User,
    @Body() body: UpsertDocumentRequest,
  ): Promise<UpsertDocumentResponse> {
    const document = await this.documentService.createDocument(user, body, {
      checkStorageQuota: true,
    });
    return buildSuccessResponse(documentPO2DTO(document));
  }

  @UseGuards(JwtAuthGuard)
  @Post('document/update')
  async updateDocument(
    @LoginedUser() user: User,
    @Body() body: UpsertDocumentRequest,
  ): Promise<UpsertDocumentResponse> {
    if (!body.docId) {
      throw new ParamsError('Document ID is required');
    }
    const documents = await this.documentService.batchUpdateDocument(user, [body]);
    return buildSuccessResponse(documentPO2DTO(documents?.[0]));
  }

  @UseGuards(JwtAuthGuard)
  @Post('document/batchUpdate')
  async batchUpdateDocument(@LoginedUser() user: User, @Body() body: UpsertDocumentRequest[]) {
    await this.documentService.batchUpdateDocument(user, body);
    return buildSuccessResponse({});
  }

  @UseGuards(JwtAuthGuard)
  @Post('document/delete')
  async deleteDocument(@LoginedUser() user: User, @Body() body: DeleteDocumentRequest) {
    if (!body.docId) {
      throw new ParamsError('Document ID is required');
    }
    await this.documentService.deleteDocument(user, body);
    return buildSuccessResponse({});
  }
}
