import { Body, Controller, Get, Post, UseGuards, Query } from '@nestjs/common';
import {
  User,
  CreateShareRequest,
  DeleteShareRequest,
  CreateShareResponse,
  EntityType,
  ListShareResponse,
  DuplicateShareRequest,
  DuplicateShareResponse,
} from '@refly/openapi-schema';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { LoginedUser } from '../../utils/decorators/user.decorator';
import { buildSuccessResponse } from '../../utils';
import { shareRecordPO2DTO } from '../share/share.dto';
import { ShareCommonService } from './share-common.service';
import { ShareCreationService } from './share-creation.service';
import { ShareDuplicationService } from './share-duplication.service';

@Controller('v1/share')
export class ShareController {
  constructor(
    private readonly shareCommonService: ShareCommonService,
    private readonly shareCreationService: ShareCreationService,
    private readonly shareDuplicationService: ShareDuplicationService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Get('list')
  async listShares(
    @LoginedUser() user: User,
    @Query('shareId') shareId: string,
    @Query('entityId') entityId: string,
    @Query('entityType') entityType: EntityType,
  ): Promise<ListShareResponse> {
    const results = await this.shareCommonService.listShares(user, {
      shareId,
      entityId,
      entityType,
    });
    return buildSuccessResponse(results.map(shareRecordPO2DTO));
  }

  @UseGuards(JwtAuthGuard)
  @Post('new')
  async createShare(
    @LoginedUser() user: User,
    @Body() body: CreateShareRequest,
  ): Promise<CreateShareResponse> {
    const result = await this.shareCreationService.createShare(user, body);
    // Immediately return minimal share record (contains shareId)
    return buildSuccessResponse(shareRecordPO2DTO(result));
  }

  @UseGuards(JwtAuthGuard)
  @Post('delete')
  async deleteShare(@LoginedUser() user: User, @Body() body: DeleteShareRequest) {
    await this.shareCommonService.deleteShare(user, body);
    return buildSuccessResponse(null);
  }

  @UseGuards(JwtAuthGuard)
  @Post('duplicate')
  async duplicateShare(
    @LoginedUser() user: User,
    @Body() body: DuplicateShareRequest,
  ): Promise<DuplicateShareResponse> {
    const result = await this.shareDuplicationService.duplicateShare(user, body);
    return buildSuccessResponse(result);
  }
}
