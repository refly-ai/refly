import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  DefaultValuePipe,
  ParseIntPipe,
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
} from '@refly/openapi-schema';
import { buildSuccessResponse } from '../../utils/response';
import { driveFilePO2DTO } from './drive.dto';

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
}
