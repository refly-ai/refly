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
  QueryReferencesRequest,
  AddReferencesRequest,
  DeleteReferencesRequest,
  ListOrder,
  ListDocumentResponse,
  GetDocumentDetailResponse,
  UpsertDocumentRequest,
  UpsertDocumentResponse,
  DeleteDocumentRequest,
} from '@refly-packages/openapi-schema';
import { KnowledgeService } from './knowledge.service';
import { JwtAuthGuard } from '@/auth/guard/jwt-auth.guard';
import { buildSuccessResponse } from '@/utils';
import { LoginedUser } from '@/utils/decorators/user.decorator';
import { documentPO2DTO, resourcePO2DTO, referencePO2DTO } from './knowledge.dto';
import { ParamsError } from '@refly-packages/errors';
import { safeParseJSON } from '@refly-packages/utils';

@Controller('v1/knowledge')
export class KnowledgeController {
  constructor(private knowledgeService: KnowledgeService) {}

  @UseGuards(JwtAuthGuard)
  @Get('resource/list')
  async listResources(
    @LoginedUser() user: User,
    @Query('resourceId') resourceId: string,
    @Query('resourceType') resourceType: ResourceType,
    @Query('projectId') projectId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('pageSize', new DefaultValuePipe(10), ParseIntPipe) pageSize: number,
    @Query('order', new DefaultValuePipe('creationDesc')) order: ListOrder,
  ): Promise<ListResourceResponse> {
    const resources = await this.knowledgeService.listResources(user, {
      resourceId,
      resourceType,
      projectId,
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
    const resource = await this.knowledgeService.getResourceDetail(user, { resourceId });
    return buildSuccessResponse(resourcePO2DTO(resource));
  }

  @UseGuards(JwtAuthGuard)
  @Post('resource/create')
  async createResource(
    @LoginedUser() user: User,
    @Body() body: UpsertResourceRequest,
  ): Promise<UpsertResourceResponse> {
    const resource = await this.knowledgeService.createResource(user, body, {
      checkStorageQuota: true,
    });
    await this.knowledgeService.syncStorageUsage(user);
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
    const resource = await this.knowledgeService.createResource(
      user,
      {
        ...body,
        content,
        data,
      },
      {
        checkStorageQuota: true,
      },
    );

    await this.knowledgeService.syncStorageUsage(user);
    return buildSuccessResponse(resourcePO2DTO(resource));
  }

  @UseGuards(JwtAuthGuard)
  @Post('resource/batchCreate')
  async importResource(
    @LoginedUser() user: User,
    @Body() body: UpsertResourceRequest[],
  ): Promise<BatchCreateResourceResponse> {
    const resources = await this.knowledgeService.batchCreateResource(user, body ?? []);
    await this.knowledgeService.syncStorageUsage(user);
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
    await this.knowledgeService.getResourceDetail(user, { resourceId });

    const updated = await this.knowledgeService.updateResource(user, body);
    return buildSuccessResponse(resourcePO2DTO(updated));
  }

  @UseGuards(JwtAuthGuard)
  @Post('resource/reindex')
  async reindexResource(
    @LoginedUser() user: User,
    @Body() body: ReindexResourceRequest,
  ): Promise<ReindexResourceResponse> {
    const resources = await this.knowledgeService.reindexResource(user, body);
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
    await this.knowledgeService.deleteResource(user, body.resourceId);
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
    const documents = await this.knowledgeService.listDocuments(user, {
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
    const document = await this.knowledgeService.getDocumentDetail(user, { docId });
    return buildSuccessResponse(documentPO2DTO(document));
  }

  @UseGuards(JwtAuthGuard)
  @Post('document/create')
  async createDocument(
    @LoginedUser() user: User,
    @Body() body: UpsertDocumentRequest,
  ): Promise<UpsertDocumentResponse> {
    const document = await this.knowledgeService.createDocument(user, body, {
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
    const documents = await this.knowledgeService.batchUpdateDocument(user, [body]);
    return buildSuccessResponse(documentPO2DTO(documents?.[0]));
  }

  @UseGuards(JwtAuthGuard)
  @Post('document/batchUpdate')
  async batchUpdateDocument(@LoginedUser() user: User, @Body() body: UpsertDocumentRequest[]) {
    await this.knowledgeService.batchUpdateDocument(user, body);
    return buildSuccessResponse({});
  }

  @UseGuards(JwtAuthGuard)
  @Post('document/delete')
  async deleteDocument(@LoginedUser() user: User, @Body() body: DeleteDocumentRequest) {
    if (!body.docId) {
      throw new ParamsError('Document ID is required');
    }
    await this.knowledgeService.deleteDocument(user, body);
    return buildSuccessResponse({});
  }

  @UseGuards(JwtAuthGuard)
  @Post('reference/query')
  async queryReferences(@LoginedUser() user: User, @Body() body: QueryReferencesRequest) {
    const references = await this.knowledgeService.queryReferences(user, body);
    return buildSuccessResponse(references.map(referencePO2DTO));
  }

  @UseGuards(JwtAuthGuard)
  @Post('reference/add')
  async addReferences(@LoginedUser() user: User, @Body() body: AddReferencesRequest) {
    const references = await this.knowledgeService.addReferences(user, body);
    return buildSuccessResponse(references.map(referencePO2DTO));
  }

  @UseGuards(JwtAuthGuard)
  @Post('reference/delete')
  async deleteReferences(@LoginedUser() user: User, @Body() body: DeleteReferencesRequest) {
    await this.knowledgeService.deleteReferences(user, body);
    return buildSuccessResponse({});
  }
}
