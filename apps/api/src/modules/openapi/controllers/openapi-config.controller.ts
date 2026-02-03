import {
  Body,
  Controller,
  Get,
  Logger,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guard/jwt-auth.guard';
import { LoginedUser } from '../../../utils/decorators/user.decorator';
import { User } from '@prisma/client';
import { buildSuccessResponse } from '../../../utils/response';
import { OpenapiService } from '../openapi.service';
import { UpdateOpenapiConfigDto } from '../dto/openapi-config.dto';
import { ApiCallTrackingInterceptor } from '../interceptors/api-call-tracking.interceptor';

@ApiTags('OpenAPI Config')
@Controller('v1/openapi/config')
@UseGuards(JwtAuthGuard)
@UseInterceptors(ApiCallTrackingInterceptor)
export class OpenapiConfigController {
  private readonly logger = new Logger(OpenapiConfigController.name);

  constructor(private readonly openapiService: OpenapiService) {}

  @Get()
  @ApiOperation({ summary: 'Get OpenAPI configuration for a canvas' })
  async getConfig(@Query('canvasId') canvasId: string, @LoginedUser() user: User) {
    this.logger.log(`[OPENAPI_CONFIG_GET] uid=${user.uid} canvasId=${canvasId}`);
    const config = await this.openapiService.getOpenapiConfig(user.uid, canvasId);
    return buildSuccessResponse(config);
  }

  @Post()
  @ApiOperation({ summary: 'Update OpenAPI configuration for a canvas' })
  async updateConfig(@Body() dto: UpdateOpenapiConfigDto, @LoginedUser() user: User) {
    this.logger.log(`[OPENAPI_CONFIG_UPDATE] uid=${user.uid} canvasId=${dto.canvasId}`);
    const config = await this.openapiService.upsertOpenapiConfig(
      user.uid,
      dto.canvasId,
      dto.resultNodeIds,
    );
    return buildSuccessResponse(config);
  }
}
