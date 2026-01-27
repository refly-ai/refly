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
import { LoginedUser } from '../../../utils/decorators/user.decorator';
import { User } from '@prisma/client';
import { buildSuccessResponse } from '../../../utils/response';

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const MAX_FILES_PER_REQUEST = 10;

/**
 * Controller for file upload endpoints (requires API Key)
 */
@ApiTags('OpenAPI - Files')
@Controller('v1/openapi/files')
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
  @ApiOperation({ summary: 'Upload files for workflow API use' })
  @ApiConsumes('multipart/form-data')
  async uploadFiles(@UploadedFiles() files: Express.Multer.File[], @LoginedUser() user: User) {
    this.logger.log(`[FILE_UPLOAD_REQUEST] uid=${user.uid} fileCount=${files?.length || 0}`);

    if (!files || files.length === 0) {
      throw new BadRequestException('No files provided');
    }

    const results = await this.fileUploadService.uploadFiles(files, user);

    return buildSuccessResponse({ files: results });
  }
}
