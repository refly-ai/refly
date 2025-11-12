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
} from '@refly/openapi-schema';
import { buildSuccessResponse } from '../../utils/response';
import { driveFilePO2DTO } from './drive.dto';
import { Response, Request } from 'express';

@Controller('v1/drive')
@UseGuards(JwtAuthGuard)
export class DriveController {
  constructor(private readonly driveService: DriveService) {}

  @Get('file/list')
  async listDriveFiles(
    @LoginedUser() user: User,
    @Query('canvasId') canvasId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('pageSize', new DefaultValuePipe(10), ParseIntPipe) pageSize: number,
    @Query('order', new DefaultValuePipe('creationDesc')) order: ListOrder,
  ): Promise<ListDriveFilesResponse> {
    const driveFiles = await this.driveService.listDriveFiles(user, {
      canvasId,
      page,
      pageSize,
      order,
    });
    return buildSuccessResponse(driveFiles.map(driveFilePO2DTO));
  }

  @Post('file/create')
  async createDriveFile(
    @LoginedUser() user: User,
    @Body() request: UpsertDriveFileRequest,
  ): Promise<UpsertDriveFileResponse> {
    const driveFile = await this.driveService.upsertDriveFile(user, request);
    return buildSuccessResponse(driveFilePO2DTO(driveFile));
  }

  @Post('file/batchCreate')
  async batchCreateDriveFiles(
    @LoginedUser() user: User,
    @Body() request: BatchCreateDriveFilesRequest,
  ): Promise<BatchCreateDriveFilesResponse> {
    const driveFiles = await this.driveService.batchCreateDriveFiles(user, request);
    return buildSuccessResponse(driveFiles.map(driveFilePO2DTO));
  }

  @Post('file/update')
  async updateDriveFile(
    @LoginedUser() user: User,
    @Body() request: UpsertDriveFileRequest,
  ): Promise<UpsertDriveFileResponse> {
    const driveFile = await this.driveService.upsertDriveFile(user, request);
    return buildSuccessResponse(driveFilePO2DTO(driveFile));
  }

  @Post('file/delete')
  async deleteDriveFile(
    @LoginedUser() user: User,
    @Body() request: DeleteDriveFileRequest,
  ): Promise<BaseResponse> {
    await this.driveService.deleteDriveFile(user, request);
    return buildSuccessResponse();
  }

  @Get('file/content/:fileId')
  async serveDriveFile(
    @LoginedUser() user: User,
    @Param('fileId') fileId: string,
    @Query('download') download: string,
    @Res() res: Response,
    @Req() req: Request,
  ): Promise<void> {
    const { data, contentType, filename } = await this.driveService.getDriveFileStream(
      user,
      fileId,
    );

    const origin = req.headers.origin;

    res.set({
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': origin || '*',
      'Access-Control-Allow-Credentials': 'true',
      'Cross-Origin-Resource-Policy': 'cross-origin',
      'Content-Length': String(data.length),
      ...(download ? { 'Content-Disposition': `attachment; filename="${filename}"` } : {}),
    });

    res.end(data);
  }
}
