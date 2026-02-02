import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  DefaultValuePipe,
  ParseIntPipe,
  Param,
  Res,
  Req,
  UseInterceptors,
  UploadedFile,
  ParseFilePipe,
  MaxFileSizeValidator,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiConsumes } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/guard/optional-jwt-auth.guard';
import { DriveService } from './drive.service';
import { LoginedUser } from '../../utils/decorators/user.decorator';
import {
  User,
  UpsertDriveFileRequest,
  DeleteDriveFileRequest,
  ListDriveFilesResponse,
  UpsertDriveFileResponse,
  BaseResponse,
  ListOrder,
  BatchCreateDriveFilesRequest,
  BatchCreateDriveFilesResponse,
  DriveFileSource,
  DriveFileScope,
  StartExportJobRequest,
  StartExportJobResponse,
  GetExportJobStatusResponse,
} from '@refly/openapi-schema';
import { buildSuccessResponse } from '../../utils/response';
import { Response, Request } from 'express';
import { buildContentDisposition } from '../../utils/filename';
import { checkHttpCache, send304NotModified, applyCacheHeaders } from '../../utils/http-cache';

@ApiTags('Drive')
@Controller('v1/drive')
export class DriveController {
  constructor(private readonly driveService: DriveService) {}

  @Get('file/list')
  @UseGuards(JwtAuthGuard)
  async listDriveFiles(
    @LoginedUser() user: User,
    @Query('canvasId') canvasId: string,
    @Query('source') source: DriveFileSource,
    @Query('scope') scope: DriveFileScope,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('pageSize', new DefaultValuePipe(10), ParseIntPipe) pageSize: number,
    @Query('order', new DefaultValuePipe('creationDesc')) order: ListOrder,
  ): Promise<ListDriveFilesResponse> {
    const driveFiles = await this.driveService.listDriveFiles(user, {
      canvasId,
      source,
      scope,
      page,
      pageSize,
      order,
    });
    return buildSuccessResponse(driveFiles);
  }

  @Post('file/create')
  @UseGuards(JwtAuthGuard)
  async createDriveFile(
    @LoginedUser() user: User,
    @Body() request: UpsertDriveFileRequest,
  ): Promise<UpsertDriveFileResponse> {
    const driveFile = await this.driveService.createDriveFile(user, request);
    return buildSuccessResponse(driveFile);
  }

  @Post('file/batchCreate')
  @UseGuards(JwtAuthGuard)
  async batchCreateDriveFiles(
    @LoginedUser() user: User,
    @Body() request: BatchCreateDriveFilesRequest,
  ): Promise<BatchCreateDriveFilesResponse> {
    const driveFiles = await this.driveService.batchCreateDriveFiles(user, request);
    return buildSuccessResponse(driveFiles);
  }

  @Post('file/upload')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
    }),
  )
  @ApiOperation({ summary: 'Upload file to canvas' })
  @ApiConsumes('multipart/form-data')
  async uploadFile(
    @UploadedFile(
      new ParseFilePipe({
        validators: [new MaxFileSizeValidator({ maxSize: 50 * 1024 * 1024 })],
      }),
    )
    file: Express.Multer.File,
    @Body('canvasId') canvasId: string,
    @LoginedUser() user: User,
  ): Promise<UpsertDriveFileResponse> {
    const result = await this.driveService.uploadAndCreateFile(user, file, canvasId);
    return buildSuccessResponse(result);
  }

  @Post('file/update')
  @UseGuards(JwtAuthGuard)
  async updateDriveFile(
    @LoginedUser() user: User,
    @Body() request: UpsertDriveFileRequest,
  ): Promise<UpsertDriveFileResponse> {
    const driveFile = await this.driveService.updateDriveFile(user, request);
    return buildSuccessResponse(driveFile);
  }

  @Post('file/delete')
  @UseGuards(JwtAuthGuard)
  async deleteDriveFile(
    @LoginedUser() user: User,
    @Body() request: DeleteDriveFileRequest,
  ): Promise<BaseResponse> {
    await this.driveService.deleteDriveFile(user, request);
    return buildSuccessResponse();
  }

  @Get('file/content/:fileId')
  @UseGuards(OptionalJwtAuthGuard)
  async serveDriveFile(
    @LoginedUser() user: User | null,
    @Param('fileId') fileId: string,
    @Query('download') download: string,
    @Res() res: Response,
    @Req() req: Request,
  ): Promise<void> {
    await this.serveDriveFileInternal({ user, fileId, download, res, req });
  }

  @Get('file/content/:fileId/:filename')
  @UseGuards(OptionalJwtAuthGuard)
  async serveDriveFileWithName(
    @LoginedUser() user: User | null,
    @Param('fileId') fileId: string,
    @Param('filename') filename: string,
    @Query('download') download: string,
    @Res() res: Response,
    @Req() req: Request,
  ): Promise<void> {
    await this.serveDriveFileInternal({ user, fileId, download, res, req, filename });
  }

  @Get('file/public/:fileId')
  async servePublicDriveFile(
    @Param('fileId') fileId: string,
    @Query('download') download: string,
    @Res() res: Response,
    @Req() req: Request,
  ): Promise<void> {
    await this.servePublicDriveFileInternal({ fileId, download, res, req });
  }

  @Get('file/public/:fileId/:filename')
  async servePublicDriveFileWithName(
    @Param('fileId') fileId: string,
    @Param('filename') filename: string,
    @Query('download') download: string,
    @Res() res: Response,
    @Req() req: Request,
  ): Promise<void> {
    await this.servePublicDriveFileInternal({ fileId, download, res, req, filename });
  }

  private async serveDriveFileInternal(params: {
    user: User | null;
    fileId: string;
    download: string;
    res: Response;
    req: Request;
    filename?: string;
  }): Promise<void> {
    const { user, fileId, download, res, req, filename: filenameHint } = params;
    const origin = req.headers.origin;

    // First, get only metadata (no file content loaded yet)
    // Uses unified access: checks externalOss (public) first, then internalOss (private) if user is authenticated
    const { contentType, filename, lastModified, isPublic } =
      await this.driveService.getUnifiedFileMetadata(fileId, user);
    const resolvedFilename = filename || filenameHint || 'file';

    // Check HTTP cache and get cache headers
    const cacheResult = checkHttpCache(req, {
      identifier: fileId,
      lastModified,
    });

    const corsHeaders = {
      'Access-Control-Allow-Origin': origin || '*',
      'Access-Control-Allow-Credentials': 'true',
      'Cross-Origin-Resource-Policy': 'cross-origin',
    };

    // If client has valid cache, return 304 Not Modified (without loading file content)
    if (cacheResult.useCache) {
      send304NotModified(res, cacheResult, corsHeaders);
      return;
    }

    // Cache is stale, load the full file content
    let { data } = await this.driveService.getUnifiedFileStream(fileId, user);

    // Process content for download: replace private URLs with public URLs in markdown/html
    // Only process if user is authenticated (private files)
    if (download && user && !isPublic) {
      data = await this.driveService.processContentForDownload(
        user,
        data,
        resolvedFilename,
        contentType,
      );
    }

    // Return file with cache headers
    applyCacheHeaders(res, cacheResult, {
      'Content-Type': contentType,
      'Content-Length': String(data.length),
      ...corsHeaders,
      ...(download
        ? {
            'Content-Disposition': buildContentDisposition(resolvedFilename),
          }
        : {}),
    });

    res.end(data);
  }

  private async servePublicDriveFileInternal(params: {
    fileId: string;
    download: string;
    res: Response;
    req: Request;
    filename?: string;
  }): Promise<void> {
    const { fileId, download, res, req, filename: filenameHint } = params;
    const origin = req.headers.origin;

    // First, get only metadata (no file content loaded yet)
    const { contentType, filename, lastModified } =
      await this.driveService.getPublicFileMetadata(fileId);
    const resolvedFilename = filename || filenameHint || 'file';

    // Check HTTP cache and get cache headers
    const cacheResult = checkHttpCache(req, {
      identifier: fileId,
      lastModified,
    });

    const corsHeaders = {
      'Access-Control-Allow-Origin': origin || '*',
      'Access-Control-Allow-Credentials': 'true',
      'Cross-Origin-Resource-Policy': 'cross-origin',
    };

    // If client has valid cache, return 304 Not Modified (without loading file content)
    if (cacheResult.useCache) {
      send304NotModified(res, cacheResult, corsHeaders);
      return;
    }

    // Cache is stale, load the full file content
    const { data } = await this.driveService.getPublicFileContent(fileId);

    // Return file with cache headers
    applyCacheHeaders(res, cacheResult, {
      'Content-Type': contentType,
      'Content-Length': String(data.length),
      ...corsHeaders,
      ...(download
        ? {
            'Content-Disposition': buildContentDisposition(resolvedFilename),
          }
        : {}),
    });

    res.end(data);
  }

  @UseGuards(JwtAuthGuard)
  @Get('document/export')
  async exportDocument(
    @LoginedUser() user: User,
    @Query('fileId') fileId: string,
    @Query('format') format: 'markdown' | 'docx' | 'pdf',
    @Res() res: Response,
    @Req() req: Request,
  ): Promise<void> {
    const data = await this.driveService.exportDocument(user, { fileId, format });

    const origin = req.headers.origin;
    let contentType = 'text/markdown';

    if (format === 'docx') {
      contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    } else if (format === 'pdf') {
      contentType = 'application/pdf';
    }

    res.set({
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': origin || '*',
      'Access-Control-Allow-Credentials': 'true',
      'Cross-Origin-Resource-Policy': 'cross-origin',
    });

    res.end(data);
  }

  @Post('document/export/async')
  @UseGuards(JwtAuthGuard)
  async startExportJob(
    @LoginedUser() user: User,
    @Body() request: StartExportJobRequest,
  ): Promise<StartExportJobResponse> {
    const exportJob = await this.driveService.startExportJob(user, request);
    return buildSuccessResponse(exportJob);
  }

  @Get('document/export/job/:jobId')
  @UseGuards(JwtAuthGuard)
  async getExportJobStatus(
    @LoginedUser() user: User,
    @Param('jobId') jobId: string,
  ): Promise<GetExportJobStatusResponse> {
    const exportJob = await this.driveService.getExportJobStatus(user, jobId);
    return buildSuccessResponse(exportJob);
  }

  @Get('document/export/job/:jobId/download')
  @UseGuards(JwtAuthGuard)
  async downloadExportJobResult(
    @LoginedUser() user: User,
    @Param('jobId') jobId: string,
    @Res() res: Response,
    @Req() req: Request,
  ): Promise<void> {
    const { data, contentType, filename } = await this.driveService.downloadExportJobResult(
      user,
      jobId,
    );

    const origin = req.headers.origin;

    res.set({
      'Content-Type': contentType,
      'Content-Length': String(data.length),
      'Content-Disposition': buildContentDisposition(filename),
      'Access-Control-Allow-Origin': origin || '*',
      'Access-Control-Allow-Credentials': 'true',
      'Cross-Origin-Resource-Policy': 'cross-origin',
    });

    res.end(data);
  }
}
