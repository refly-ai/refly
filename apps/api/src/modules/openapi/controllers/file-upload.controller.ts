import {
  Controller,
  Post,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiConsumes } from '@nestjs/swagger';
import { FilesInterceptor } from '@nestjs/platform-express';
import { FileUploadService } from '../file-upload.service';
import { ApiKeyAuthGuard } from '../guards/api-key-auth.guard';
import { RateLimitGuard } from '../guards/rate-limit.guard';
import { MAX_FILE_SIZE, MAX_FILES_PER_REQUEST } from '../openapi.constants';
import { LoginedUser } from '../../../utils/decorators/user.decorator';
import { User } from '@prisma/client';
import { buildSuccessResponse } from '../../../utils/response';
import { OpenapiFileUploadResponse } from '@refly/openapi-schema';
import { ApiCallTrackingInterceptor } from '../interceptors/api-call-tracking.interceptor';

/**
 * Controller for file upload endpoints (requires API Key)
 */
@ApiTags('OpenAPI - Files')
@Controller('v1/openapi/files')
@UseInterceptors(ApiCallTrackingInterceptor)
export class FileUploadController {
  private readonly logger = new Logger(FileUploadController.name);

  constructor(private readonly fileUploadService: FileUploadService) {}

  /**
   * Upload files for workflow API use
   * POST /v1/openapi/files/upload
   * Requires X-Refly-Api-Key header
   */
  @Post('upload')
  @UseGuards(ApiKeyAuthGuard, RateLimitGuard)
  @UseInterceptors(
    FilesInterceptor('files', MAX_FILES_PER_REQUEST, {
      limits: { fileSize: MAX_FILE_SIZE },
    }),
  )
  @ApiOperation({
    summary: '上传文件并返回 fileKey',
    description:
      'fileKey 可直接作为 run 的变量值（字符串或字符串数组）传入。未使用的临时文件约 24 小时后清理。',
  })
  @ApiConsumes('multipart/form-data')
  async uploadFiles(
    @UploadedFiles() files: Express.Multer.File[],
    @LoginedUser() user: User,
  ): Promise<OpenapiFileUploadResponse> {
    this.logger.log(`[FILE_UPLOAD_REQUEST] uid=${user.uid} fileCount=${files?.length || 0}`);

    if (!files || files.length === 0) {
      throw new BadRequestException('No files provided');
    }

    const results = await this.fileUploadService.uploadFiles(files, user);

    return buildSuccessResponse({ files: results });
  }
}
