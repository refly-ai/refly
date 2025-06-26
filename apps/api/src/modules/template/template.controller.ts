import {
  Body,
  Controller,
  Get,
  Post,
  UseGuards,
  Query,
  DefaultValuePipe,
  ParseIntPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/guard/optional-jwt-auth.guard';
import { LoginedUser } from '../../utils/decorators/user.decorator';
import { canvasTemplateCategoryPO2DTO, canvasTemplatePO2DTO } from './template.dto';
import { buildSuccessResponse } from '../../utils';
import {
  User,
  CreateCanvasTemplateRequest,
  UpdateCanvasTemplateRequest,
} from '@refly/openapi-schema';
import { TemplateService } from './template.service';

@Controller('v1/template')
export class TemplateController {
  constructor(private templateService: TemplateService) {}

  @UseGuards(OptionalJwtAuthGuard)
  @Get('list')
  async listCanvasTemplates(
    @LoginedUser() user: User | null,
    @Query('categoryId') categoryId: string,
    @Query('scope', new DefaultValuePipe('public')) scope: 'public' | 'private',
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('pageSize', new DefaultValuePipe(10), ParseIntPipe) pageSize: number,
  ) {
    const templates = await this.templateService.listCanvasTemplates(user, {
      page,
      pageSize,
      scope,
      categoryId,
    });
    return buildSuccessResponse(templates.map(canvasTemplatePO2DTO));
  }

  @UseGuards(JwtAuthGuard)
  @Post('create')
  async createCanvasTemplate(@LoginedUser() user: User, @Body() body: CreateCanvasTemplateRequest) {
    const template = await this.templateService.createCanvasTemplate(user, body);
    return buildSuccessResponse(canvasTemplatePO2DTO(template));
  }

  @UseGuards(JwtAuthGuard)
  @Post('update')
  async updateCanvasTemplate(@LoginedUser() user: User, @Body() body: UpdateCanvasTemplateRequest) {
    const template = await this.templateService.updateCanvasTemplate(user, body);
    return buildSuccessResponse(canvasTemplatePO2DTO(template));
  }

  @UseGuards(JwtAuthGuard)
  @Get('category/list')
  async listCanvasTemplateCategories() {
    const categories = await this.templateService.listCanvasTemplateCategories();
    return buildSuccessResponse(categories.map(canvasTemplateCategoryPO2DTO));
  }
}
