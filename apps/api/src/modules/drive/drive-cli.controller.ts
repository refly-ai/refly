/**
 * CLI-specific drive endpoints
 * Provides drive file operations for CLI tooling
 */

import { Body, Controller, Get, Param, Post, Query, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { LoginedUser } from '../../utils/decorators/user.decorator';
import { User } from '@refly/openapi-schema';
import { DriveService } from './drive.service';
import { buildSuccessResponse } from '../../utils/response';

@Controller('v1/cli/drive')
@UseGuards(JwtAuthGuard)
export class DriveCliController {
  constructor(private readonly driveService: DriveService) {}

  /**
   * List drive files with pagination
   */
  @Get('files')
  async listFiles(
    @LoginedUser() user: User,
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
    @Query('canvasId') canvasId?: string,
    @Query('resultId') resultId?: string,
    @Query('includeContent') includeContent = 'false',
  ) {
    const result = await this.driveService.listDriveFiles(user, {
      page: Number.parseInt(page, 10) || 1,
      pageSize: Number.parseInt(pageSize, 10) || 20,
      canvasId,
      resultId,
      includeContent: includeContent === 'true',
    });

    return buildSuccessResponse({
      files: result,
      total: result.length,
      page: Number.parseInt(page, 10) || 1,
      pageSize: Number.parseInt(pageSize, 10) || 20,
    });
  }

  /**
   * Get file detail with optional content
   */
  @Get('files/:fileId')
  async getFile(
    @LoginedUser() user: User,
    @Param('fileId') fileId: string,
    @Query('includeContent') includeContent = 'true',
  ) {
    const file = await this.driveService.getDriveFileDetail(user, fileId, {
      includeContent: includeContent === 'true',
    });
    return buildSuccessResponse(file);
  }

  /**
   * Download file as binary stream
   */
  @Get('files/:fileId/download')
  async downloadFile(
    @LoginedUser() user: User,
    @Param('fileId') fileId: string,
    @Res() res: Response,
  ) {
    const { data, contentType, filename, lastModified } =
      await this.driveService.getDriveFileStream(user, fileId);

    res.setHeader('Content-Type', contentType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
    res.setHeader('Content-Length', data.length.toString());
    res.setHeader('Last-Modified', lastModified.toUTCString());

    res.send(data);
  }

  /**
   * Get a presigned URL for file upload
   * Step 1 of presigned upload flow
   */
  @Post('file/upload/presign')
  async getUploadPresignedUrl(
    @LoginedUser() user: User,
    @Body()
    body: {
      canvasId: string;
      filename: string;
      size: number;
      contentType: string;
    },
  ) {
    const result = await this.driveService.createPresignedUpload(user, body);
    return buildSuccessResponse(result);
  }

  /**
   * Confirm a presigned upload has completed
   * Step 2 of presigned upload flow
   */
  @Post('file/upload/confirm')
  async confirmUpload(@LoginedUser() user: User, @Body() body: { uploadId: string }) {
    const result = await this.driveService.confirmPresignedUpload(user, body.uploadId);
    return buildSuccessResponse(result);
  }
}
