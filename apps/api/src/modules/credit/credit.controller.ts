import { Controller, UseGuards, Get } from '@nestjs/common';
import { CreditService } from './credit.service';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { LoginedUser } from '../../utils/decorators/user.decorator';
import {
  User,
  GetCreditRechargeResponse,
  GetCreditUsageResponse,
  GetCreditBalanceResponse,
} from '@refly/openapi-schema';
import { buildSuccessResponse } from '../../utils';
@Controller('v1/credit')
export class CreditController {
  constructor(private readonly creditService: CreditService) {}

  @UseGuards(JwtAuthGuard)
  @Get('/recharge')
  async getCreditRecharge(@LoginedUser() user: User): Promise<GetCreditRechargeResponse> {
    const recharge = await this.creditService.getCreditRecharge(user);
    return buildSuccessResponse(recharge);
  }

  @UseGuards(JwtAuthGuard)
  @Get('/usage')
  async getCreditUsage(@LoginedUser() user: User): Promise<GetCreditUsageResponse> {
    const usage = await this.creditService.getCreditUsage(user);
    return buildSuccessResponse(usage);
  }

  @UseGuards(JwtAuthGuard)
  @Get('/balance')
  async getCreditBalance(@LoginedUser() user: User): Promise<GetCreditBalanceResponse> {
    const balance = await this.creditService.getCreditBalance(user);
    return buildSuccessResponse(balance);
  }
}
