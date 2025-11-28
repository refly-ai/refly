import { Controller, UseGuards, Get, Query } from '@nestjs/common';
import { CreditService } from './credit.service';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { LoginedUser } from '../../utils/decorators/user.decorator';
import {
  User,
  GetCreditRechargeResponse,
  GetCreditUsageResponse,
  GetCreditBalanceResponse,
  GetCreditUsageByResultIdResponse,
  GetCreditUsageByExecutionIdResponse,
  GetCreditUsageByCanvasIdResponse,
} from '@refly/openapi-schema';
import { buildSuccessResponse } from '../../utils';
import { ConfigService } from '@nestjs/config';

// Define pagination DTO
class PaginationDto {
  page?: string;
  pageSize?: string;
}

@Controller('v1/credit')
export class CreditController {
  constructor(
    private readonly creditService: CreditService,
    private readonly configService: ConfigService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Get('/recharge')
  async getCreditRecharge(
    @LoginedUser() user: User,
    @Query() query: PaginationDto,
  ): Promise<GetCreditRechargeResponse> {
    const page = query.page ? Number.parseInt(query.page, 10) : 1;
    const pageSize = query.pageSize ? Number.parseInt(query.pageSize, 10) : 10;
    const recharge = await this.creditService.getCreditRecharge(user, { page, pageSize });
    return buildSuccessResponse(recharge);
  }

  @UseGuards(JwtAuthGuard)
  @Get('/usage')
  async getCreditUsage(
    @LoginedUser() user: User,
    @Query() query: PaginationDto,
  ): Promise<GetCreditUsageResponse> {
    const page = query.page ? Number.parseInt(query.page, 10) : 1;
    const pageSize = query.pageSize ? Number.parseInt(query.pageSize, 10) : 10;
    const usage = await this.creditService.getCreditUsage(user, { page, pageSize });
    return buildSuccessResponse(usage);
  }

  @UseGuards(JwtAuthGuard)
  @Get('/balance')
  async getCreditBalance(@LoginedUser() user: User): Promise<GetCreditBalanceResponse> {
    const balance = await this.creditService.getCreditBalance(user);
    return buildSuccessResponse(balance);
  }

  @UseGuards(JwtAuthGuard)
  @Get('/result')
  async getCreditUsageByResultId(
    @LoginedUser() user: User,
    @Query() query: { resultId: string; version?: string },
  ): Promise<GetCreditUsageByResultIdResponse> {
    const { resultId, version } = query;
    const versionNumber = version ? Number.parseInt(version, 10) : undefined;
    const total = await this.creditService.countResultCreditUsage(user, resultId, versionNumber);
    return buildSuccessResponse({ total });
  }

  @UseGuards(JwtAuthGuard)
  @Get('/execution')
  async getCreditUsageByExecutionId(
    @LoginedUser() user: User,
    @Query() query: { executionId: string },
  ): Promise<GetCreditUsageByExecutionIdResponse> {
    const { executionId } = query;
    const total = await this.creditService.countExecutionCreditUsageByExecutionId(
      user,
      executionId,
    );
    return buildSuccessResponse({
      total: Math.ceil(total * this.configService.get('credit.executionCreditMarkup')),
    });
  }

  @UseGuards(JwtAuthGuard)
  @Get('/canvas')
  async getCreditUsageByCanvasId(
    @LoginedUser() user: User,
    @Query() query: { canvasId: string },
  ): Promise<GetCreditUsageByCanvasIdResponse> {
    const { canvasId } = query;
    const total = await this.creditService.countCanvasCreditUsageByCanvasId(user, canvasId);
    return buildSuccessResponse({
      total: Math.ceil(total * (1 + this.configService.get('credit.canvasCreditCommissionRate'))),
    });
  }
}
