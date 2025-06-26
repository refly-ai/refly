import { Body, Controller, Get, ParseBoolPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ProviderService } from './provider.service';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { LoginedUser } from '../../utils/decorators/user.decorator';
import { User as UserModel } from '../../generated/client';
import {
  BatchUpsertProviderItemsRequest,
  BatchUpsertProviderItemsResponse,
  DeleteProviderItemRequest,
  DeleteProviderItemResponse,
  DeleteProviderRequest,
  DeleteProviderResponse,
  ListProviderItemOptionsResponse,
  ListProviderItemsResponse,
  ListProvidersResponse,
  ProviderCategory,
  UpsertProviderItemRequest,
  UpsertProviderItemResponse,
  UpsertProviderRequest,
  UpsertProviderResponse,
} from '@refly/openapi-schema';
import { buildSuccessResponse } from '../../utils/response';
import { providerItemPO2DTO, providerPO2DTO } from './provider.dto';

@Controller('v1/provider')
export class ProviderController {
  constructor(private readonly providerService: ProviderService) {}

  @UseGuards(JwtAuthGuard)
  @Get('/list')
  async listProviders(
    @LoginedUser() user: UserModel,
    @Query('providerKey') providerKey: string,
    @Query('enabled', new ParseBoolPipe({ optional: true })) enabled: boolean,
  ): Promise<ListProvidersResponse> {
    const providers = await this.providerService.listProviders(user, { enabled, providerKey });
    return buildSuccessResponse(providers.map(providerPO2DTO));
  }

  @UseGuards(JwtAuthGuard)
  @Post('/create')
  async createProvider(
    @LoginedUser() user: UserModel,
    @Body() body: UpsertProviderRequest,
  ): Promise<UpsertProviderResponse> {
    const provider = await this.providerService.createProvider(user, body);
    return buildSuccessResponse(providerPO2DTO(provider));
  }

  @UseGuards(JwtAuthGuard)
  @Post('/update')
  async updateModelProvider(
    @LoginedUser() user: UserModel,
    @Body() body: UpsertProviderRequest,
  ): Promise<UpsertProviderResponse> {
    const provider = await this.providerService.updateProvider(user, body);
    return buildSuccessResponse(providerPO2DTO(provider));
  }

  @UseGuards(JwtAuthGuard)
  @Post('/delete')
  async deleteModelProvider(
    @LoginedUser() user: UserModel,
    @Body() body: DeleteProviderRequest,
  ): Promise<DeleteProviderResponse> {
    await this.providerService.deleteProvider(user, body);
    return buildSuccessResponse();
  }

  @UseGuards(JwtAuthGuard)
  @Get('/item/list')
  async listProviderItems(
    @LoginedUser() user: UserModel,
    @Query('providerId') providerId: string,
    @Query('category') category: ProviderCategory,
    @Query('enabled', new ParseBoolPipe({ optional: true })) enabled: boolean,
  ): Promise<ListProviderItemsResponse> {
    const items = await this.providerService.listProviderItems(user, {
      providerId,
      category,
      enabled,
    });
    return buildSuccessResponse(items.map(providerItemPO2DTO));
  }

  @UseGuards(JwtAuthGuard)
  @Post('/item/create')
  async createProviderItem(
    @LoginedUser() user: UserModel,
    @Body() body: UpsertProviderItemRequest,
  ): Promise<UpsertProviderItemResponse> {
    const item = await this.providerService.createProviderItem(user, body);
    return buildSuccessResponse(providerItemPO2DTO(item));
  }

  @UseGuards(JwtAuthGuard)
  @Post('/item/batchCreate')
  async batchCreateProviderItems(
    @LoginedUser() user: UserModel,
    @Body() body: BatchUpsertProviderItemsRequest,
  ): Promise<BatchUpsertProviderItemsResponse> {
    const items = await this.providerService.batchCreateProviderItems(user, body);
    return buildSuccessResponse(items.map(providerItemPO2DTO));
  }

  @UseGuards(JwtAuthGuard)
  @Post('/item/update')
  async updateProviderItem(
    @LoginedUser() user: UserModel,
    @Body() body: UpsertProviderItemRequest,
  ): Promise<UpsertProviderItemResponse> {
    const item = await this.providerService.updateProviderItem(user, body);
    return buildSuccessResponse(providerItemPO2DTO(item));
  }

  @UseGuards(JwtAuthGuard)
  @Post('/item/batchUpdate')
  async batchUpdateProviderItems(
    @LoginedUser() user: UserModel,
    @Body() body: BatchUpsertProviderItemsRequest,
  ): Promise<BatchUpsertProviderItemsResponse> {
    const items = await this.providerService.batchUpdateProviderItems(user, body);
    return buildSuccessResponse(items.map(providerItemPO2DTO));
  }

  @UseGuards(JwtAuthGuard)
  @Post('/item/delete')
  async deleteProviderItem(
    @LoginedUser() user: UserModel,
    @Body() body: DeleteProviderItemRequest,
  ): Promise<DeleteProviderItemResponse> {
    await this.providerService.deleteProviderItem(user, body);
    return buildSuccessResponse();
  }

  @UseGuards(JwtAuthGuard)
  @Get('/item/option/list')
  async listProviderItemOptions(
    @LoginedUser() user: UserModel,
    @Query('providerId') providerId: string,
    @Query('category') category: ProviderCategory,
  ): Promise<ListProviderItemOptionsResponse> {
    const options = await this.providerService.listProviderItemOptions(user, {
      providerId,
      category,
    });
    return buildSuccessResponse(options);
  }
}
