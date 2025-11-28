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
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
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
  @UseGuards(JwtAuthGuard)
  async serveDriveFile(
    @LoginedUser() user: User,
    @Param('fileId') fileId: string,
    @Query('download') download: string,
    @Res() res: Response,
    @Req() req: Request,
  ): Promise<void> {
    const { data, contentType, filename, lastModified } =
      await this.driveService.getDriveFileStream(user, fileId);

    const origin = req.headers.origin;

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

    // If client has valid cache, return 304 Not Modified
    if (cacheResult.useCache) {
      send304NotModified(res, cacheResult, corsHeaders);
      return;
    }

    // Return file with cache headers
    applyCacheHeaders(res, cacheResult, {
      'Content-Type': contentType,
      'Content-Length': String(data.length),
      ...corsHeaders,
      ...(download
        ? {
            'Content-Disposition': buildContentDisposition(filename),
          }
        : {}),
    });

    res.end(data);
  }

  @Get('file/public/:fileId')
  async servePublicDriveFile(
    @Param('fileId') fileId: string,
    @Query('download') download: string,
    @Res() res: Response,
    @Req() req: Request,
  ): Promise<void> {
    const { data, contentType, filename, lastModified } =
      await this.driveService.getPublicFileContent(fileId);

    const origin = req.headers.origin;

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

    // If client has valid cache, return 304 Not Modified
    if (cacheResult.useCache) {
      send304NotModified(res, cacheResult, corsHeaders);
      return;
    }

    // Return file with cache headers
    applyCacheHeaders(res, cacheResult, {
      'Content-Type': contentType,
      'Content-Length': String(data.length),
      ...corsHeaders,
      ...(download
        ? {
            'Content-Disposition': buildContentDisposition(filename),
          }
        : {}),
    });

    res.end(data);
  }
}
