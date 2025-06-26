import {
  Body,
  Controller,
  Get,
  Post,
  Put,
  Delete,
  UseGuards,
  Query,
  Param,
  UseInterceptors,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { PagesService } from './pages.service';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { LoginedUser } from '../../utils/decorators/user.decorator';
import { User } from '@refly/openapi-schema';
import { buildSuccessResponse } from '../../utils/response';
import {
  UpdatePageDto,
  pagePO2DTO,
  pageNodeRelationPO2DTO,
  AddPageNodesDto,
  pageDetailPO2DTO,
} from './pages.dto';
import { LoggingInterceptor } from '../../utils/interceptors/logging.interceptor';

@ApiTags('Pages')
@Controller('v1/pages')
@UseInterceptors(LoggingInterceptor)
export class PagesController {
  constructor(private readonly pagesService: PagesService) {}

  @ApiOperation({ summary: 'Get all user pages' })
  @ApiResponse({ status: 200, description: 'Get all user pages successfully' })
  @UseGuards(JwtAuthGuard)
  @Get()
  async listPages(
    @LoginedUser() user: User,
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
  ) {
    const result = await this.pagesService.listPages(user, page, pageSize);
    return buildSuccessResponse({
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
      pages: result.pages.map((page) => pagePO2DTO(page)),
    });
  }

  @ApiOperation({ summary: 'Get page details' })
  @ApiResponse({ status: 200, description: 'Get page details successfully' })
  @UseGuards(JwtAuthGuard)
  @Get(':pageId')
  async getPageDetail(@LoginedUser() user: User, @Param('pageId') pageId: string) {
    const result = await this.pagesService.getPageDetail(user, pageId);

    return buildSuccessResponse({
      ...pageDetailPO2DTO(result),
    });
  }

  @ApiOperation({ summary: 'Update page (PUT)' })
  @ApiResponse({ status: 200, description: 'Page updated successfully' })
  @UseGuards(JwtAuthGuard)
  @Put(':pageId')
  async updatePagePut(
    @LoginedUser() user: User,
    @Param('pageId') pageId: string,
    @Body() updatePageDto: UpdatePageDto,
  ) {
    const result = await this.pagesService.updatePage(user, pageId, updatePageDto);

    return buildSuccessResponse({
      ...pagePO2DTO(result.page),
      nodeRelations: result.nodeRelations
        ? result.nodeRelations.map(pageNodeRelationPO2DTO)
        : undefined,
    });
  }

  @ApiOperation({ summary: 'Share page' })
  @ApiResponse({ status: 200, description: 'Page shared successfully' })
  @UseGuards(JwtAuthGuard)
  @Post(':pageId/share')
  async sharePage(@LoginedUser() user: User, @Param('pageId') pageId: string) {
    const result = await this.pagesService.sharePage(user, pageId);

    return buildSuccessResponse({
      pageId: result.pageId,
      canvasId: result.canvasId,
      shareId: result.shareId,
    });
  }

  @ApiOperation({ summary: 'Delete page node' })
  @ApiResponse({ status: 200, description: 'Page node deleted successfully' })
  @UseGuards(JwtAuthGuard)
  @Delete(':pageId/nodes/:nodeId')
  async deletePageNode(
    @LoginedUser() user: User,
    @Param('pageId') pageId: string,
    @Param('nodeId') nodeId: string,
  ) {
    const result = await this.pagesService.deletePageNode(user, pageId, nodeId);

    return buildSuccessResponse({
      pageId: result.pageId,
      canvasId: result.canvasId,
      nodeId: result.nodeId,
    });
  }

  @ApiOperation({ summary: 'Get page by canvas ID' })
  @ApiResponse({ status: 200, description: 'Get page by canvas ID successfully' })
  @UseGuards(JwtAuthGuard)
  @Get('canvas/:canvasId')
  async getPageByCanvasId(@LoginedUser() user: User, @Param('canvasId') canvasId: string) {
    const result = await this.pagesService.getPageByCanvasId(user, canvasId);

    return buildSuccessResponse({
      page: result.page ? pagePO2DTO(result.page) : null,
      nodeRelations: Array.isArray(result.nodeRelations)
        ? result.nodeRelations.map(pageNodeRelationPO2DTO)
        : [],
    });
  }

  @ApiOperation({ summary: 'Add nodes to canvas page' })
  @ApiResponse({ status: 201, description: 'Nodes added to canvas page successfully' })
  @UseGuards(JwtAuthGuard)
  @Post('canvas/:canvasId/nodes')
  async addNodesToCanvasPage(
    @LoginedUser() user: User,
    @Param('canvasId') canvasId: string,
    @Body() addNodesDto: AddPageNodesDto,
  ) {
    const result = await this.pagesService.addNodesToCanvasPage(user, canvasId, addNodesDto);

    return buildSuccessResponse({
      page: pagePO2DTO(result.page),
      nodeRelations: Array.isArray(result.nodeRelations)
        ? result.nodeRelations.map(pageNodeRelationPO2DTO)
        : [],
    });
  }
}
