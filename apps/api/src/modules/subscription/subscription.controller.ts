import { Controller, UseGuards, Post, Body, Get } from '@nestjs/common';
import { SubscriptionService } from '../subscription/subscription.service';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { LoginedUser } from '../../utils/decorators/user.decorator';
import {
  User,
  CreateCheckoutSessionRequest,
  CreateCreditPackCheckoutSessionRequest,
  CreateCheckoutSessionResponse,
  CreatePortalSessionResponse,
  GetSubscriptionPlansResponse,
  GetSubscriptionUsageResponse,
  ListModelsResponse,
} from '@refly/openapi-schema';
import { buildSuccessResponse } from '../../utils';
import { modelInfoPO2DTO, subscriptionPlanPO2DTO } from '../misc/misc.dto';

@Controller('v1/subscription')
export class SubscriptionController {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  @UseGuards(JwtAuthGuard)
  @Post('/createCheckoutSession')
  async createCheckoutSession(
    @LoginedUser() user: User,
    @Body() param: CreateCheckoutSessionRequest,
  ): Promise<CreateCheckoutSessionResponse> {
    const session = await this.subscriptionService.createCheckoutSession(user, param);
    return buildSuccessResponse({ url: session.url });
  }

  @UseGuards(JwtAuthGuard)
  @Post('/createCreditPackSession')
  async createCreditPackSession(
    @LoginedUser() user: User,
    @Body() param: CreateCreditPackCheckoutSessionRequest,
  ): Promise<CreateCheckoutSessionResponse> {
    const session = await this.subscriptionService.createCreditPackSession(user, param);
    return buildSuccessResponse({ url: session.url });
  }

  @UseGuards(JwtAuthGuard)
  @Post('/createPortalSession')
  async createPortalSession(@LoginedUser() user: User): Promise<CreatePortalSessionResponse> {
    const session = await this.subscriptionService.createPortalSession(user);
    return buildSuccessResponse({ url: session.url });
  }

  @Get('/plans')
  async getPlans(): Promise<GetSubscriptionPlansResponse> {
    const plans = await this.subscriptionService.getSubscriptionPlans();
    return buildSuccessResponse(plans.map(subscriptionPlanPO2DTO));
  }

  @UseGuards(JwtAuthGuard)
  @Get('/usage')
  async getUsage(@LoginedUser() user: User): Promise<GetSubscriptionUsageResponse> {
    const usage = await this.subscriptionService.getOrCreateUsageMeter(user);
    return buildSuccessResponse(usage);
  }

  /**
   * @deprecated Use /v1/provider/item/list instead
   */
  @UseGuards(JwtAuthGuard)
  @Get('modelList')
  async listModels(): Promise<ListModelsResponse> {
    const models = await this.subscriptionService.getModelList();
    return buildSuccessResponse(models.map(modelInfoPO2DTO));
  }
}
