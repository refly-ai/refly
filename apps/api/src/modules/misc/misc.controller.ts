import {
  Controller,
  Post,
  Body,
  UseGuards,
  Get,
  Param,
  Res,
  UseInterceptors,
  UploadedFile,
  Req,
  Query,
} from '@nestjs/common';
import path from 'node:path';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { MiscService } from '../misc/misc.service';
import {
  User,
  ScrapeWeblinkRequest,
  ScrapeWeblinkResponse,
  UploadRequest,
  UploadResponse,
} from '@refly/openapi-schema';
import { buildSuccessResponse } from '../../utils';
import { LoginedUser } from '../../utils/decorators/user.decorator';
import { Response, Request } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { ParamsError } from '@refly/errors';
import { buildContentDisposition } from '../../utils/filename';
import { checkHttpCache, send304NotModified, applyCacheHeaders } from '../../utils/http-cache';

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
      visibility: body.visibility,
      storageKey: body.storageKey,
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
  async serveStatic(
    @LoginedUser() user: User,
    @Param('objectKey') objectKey: string,
    @Query('download') download: string,
    @Res() res: Response,
    @Req() req: Request,
  ): Promise<void> {
    const storageKey = `static/${objectKey}`;
    const filename = path.basename(objectKey);
    const origin = req.headers.origin;

    // First, get only metadata (no file content loaded yet)
    const { contentType, lastModified } = await this.miscService.getInternalFileMetadata(
      user,
      storageKey,
    );

    // Check HTTP cache with revalidation (always verify freshness)
    const cacheResult = checkHttpCache(req, {
      identifier: storageKey,
      lastModified,
      maxAge: 0,
      immutable: false,
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
    const { data } = await this.miscService.getInternalFileStream(user, storageKey);

    // Return file with cache headers
    applyCacheHeaders(res, cacheResult, {
      'Content-Type': contentType,
      'Content-Length': String(data.length),
      ...corsHeaders,
      ...(download ? { 'Content-Disposition': `attachment; filename="${filename}"` } : {}),
    });

    res.end(data);
  }

  @Get('public/:storageKey(*)')
  async servePublicStatic(
    @Param('storageKey') storageKey: string,
    @Query('download') download: string,
    @Res() res: Response,
    @Req() req: Request,
  ): Promise<void> {
    const filename = path.basename(storageKey);
    const origin = req.headers.origin;

    // First, get only metadata (no file content loaded yet)
    const { contentType, lastModified } =
      await this.miscService.getExternalFileMetadata(storageKey);

    // Check HTTP cache with revalidation (always verify freshness)
    const cacheResult = checkHttpCache(req, {
      identifier: storageKey,
      lastModified,
      maxAge: 0,
      immutable: false,
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
    const { data } = await this.miscService.getExternalFileStream(storageKey);

    // Return file with cache headers
    applyCacheHeaders(res, cacheResult, {
      'Content-Type': contentType,
      'Content-Length': String(data.length),
      ...corsHeaders,
      ...(download ? { 'Content-Disposition': buildContentDisposition(filename) } : {}),
    });

    res.end(data);
  }

  @Get('favicon')
  async getFavicon(@Query('domain') domain: string, @Res() res: Response): Promise<void> {
    const { data, contentType } = await this.miscService.getFavicon(domain);

    // Set cache headers for 24 hours (86400 seconds)
    res.set({
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=86400', // 24 hours
      'Access-Control-Allow-Origin': '*',
      'Cross-Origin-Resource-Policy': 'cross-origin',
      'Content-Length': String(data.length),
    });

    res.end(data);
  }
}
