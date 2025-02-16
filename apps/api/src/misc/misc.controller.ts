import {
  Controller,
  Post,
  Body,
  UseGuards,
  Get,
  Param,
  StreamableFile,
  Header,
  Res,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import path from 'node:path';
import { JwtAuthGuard } from '@/auth/guard/jwt-auth.guard';
import { MiscService } from '@/misc/misc.service';
import {
  User,
  ScrapeWeblinkRequest,
  ScrapeWeblinkResponse,
  UploadRequest,
  UploadResponse,
} from '@refly-packages/openapi-schema';
import { buildSuccessResponse } from '@/utils';
import { LoginedUser } from '@/utils/decorators/user.decorator';
import { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { ParamsError } from '@refly-packages/errors';

@Controller('v1/misc')
export class MiscController {
  constructor(private readonly miscService: MiscService) {}

  @UseGuards(JwtAuthGuard)
  @Post('scrape')
  async scrapeWeblink(@Body() body: ScrapeWeblinkRequest): Promise<ScrapeWeblinkResponse> {
    const result = await this.miscService.scrapeWeblink(body);
    return buildSuccessResponse(result);
  }

  @UseGuards(JwtAuthGuard)
  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadStaticFile(
    @LoginedUser() user: User,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: UploadRequest,
  ): Promise<UploadResponse> {
    if (!file) {
      throw new ParamsError('No file uploaded');
    }
    const result = await this.miscService.uploadFile(user, {
      file,
      entityId: body.entityId,
      entityType: body.entityType,
    });
    return buildSuccessResponse(result);
  }

  @UseGuards(JwtAuthGuard)
  @Post('convert')
  @UseInterceptors(FileInterceptor('file'))
  async convert(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { from?: string; to?: string },
  ): Promise<{ data: { content: string } }> {
    if (!file) {
      throw new ParamsError('File is required');
    }

    const from = body.from ?? 'html';
    const to = body.to ?? 'markdown';
    const content = file.buffer.toString('utf-8');

    const result = await this.miscService.convert({
      content,
      from,
      to,
    });

    return buildSuccessResponse({ content: result });
  }

  @UseGuards(JwtAuthGuard)
  @Get('static/:objectKey')
  @Header('Access-Control-Allow-Origin', '*')
  @Header('Cross-Origin-Resource-Policy', 'cross-origin')
  async serveStatic(
    @LoginedUser() user: User,
    @Param('objectKey') objectKey: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const fileStream = await this.miscService.getInternalFileStream(user, `static/${objectKey}`);
    const filename = path.basename(objectKey);

    res.set({
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `inline; filename="${filename}"`,
    });

    return fileStream;
  }
}
