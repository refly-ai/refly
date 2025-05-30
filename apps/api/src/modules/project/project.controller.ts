import {
  Controller,
  Get,
  Post,
  Query,
  UseGuards,
  Body,
  DefaultValuePipe,
  ParseIntPipe,
} from '@nestjs/common';
import { ProjectService } from './project.service';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { LoginedUser } from '../../utils/decorators/user.decorator';
import {
  BaseResponse,
  DeleteProjectItemsRequest,
  DeleteProjectRequest,
  GetProjectDetailResponse,
  ListOrder,
  ListProjectResponse,
  UpdateProjectItemsRequest,
  UpsertProjectRequest,
  UpsertProjectResponse,
  User,
} from '@refly/openapi-schema';
import { buildSuccessResponse } from '../../utils/response';
import { projectPO2DTO } from '../project/project.dto';

@Controller('v1/project')
export class ProjectController {
  constructor(private readonly projectService: ProjectService) {}

  @UseGuards(JwtAuthGuard)
  @Get('list')
  async listProjects(
    @LoginedUser() user: User,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('pageSize', new DefaultValuePipe(10), ParseIntPipe) pageSize: number,
    @Query('order') order: ListOrder,
  ): Promise<ListProjectResponse> {
    const projects = await this.projectService.listProjects(user, { page, pageSize, order });
    return buildSuccessResponse(projects.map(projectPO2DTO));
  }

  @UseGuards(JwtAuthGuard)
  @Get('detail')
  async getProjectDetail(
    @LoginedUser() user: User,
    @Query('projectId') projectId: string,
  ): Promise<GetProjectDetailResponse> {
    const project = await this.projectService.getProjectDetail(user, projectId);
    return buildSuccessResponse(projectPO2DTO(project));
  }

  @UseGuards(JwtAuthGuard)
  @Post('new')
  async createProject(
    @LoginedUser() user: User,
    @Body() body: UpsertProjectRequest,
  ): Promise<UpsertProjectResponse> {
    const project = await this.projectService.createProject(user, body);
    return buildSuccessResponse(projectPO2DTO(project));
  }

  @UseGuards(JwtAuthGuard)
  @Post('update')
  async updateProject(
    @LoginedUser() user: User,
    @Body() body: UpsertProjectRequest,
  ): Promise<UpsertProjectResponse> {
    const project = await this.projectService.updateProject(user, body);
    return buildSuccessResponse(projectPO2DTO(project));
  }

  @UseGuards(JwtAuthGuard)
  @Post('updateItems')
  async updateProjectItems(
    @LoginedUser() user: User,
    @Body() body: UpdateProjectItemsRequest,
  ): Promise<BaseResponse> {
    await this.projectService.updateProjectItems(user, body);
    return buildSuccessResponse();
  }

  @UseGuards(JwtAuthGuard)
  @Post('delete')
  async deleteProject(
    @LoginedUser() user: User,
    @Body() body: DeleteProjectRequest,
  ): Promise<BaseResponse> {
    await this.projectService.deleteProject(user, body);
    return buildSuccessResponse();
  }

  @UseGuards(JwtAuthGuard)
  @Post('deleteItems')
  async deleteProjectItems(
    @LoginedUser() user: User,
    @Body() body: DeleteProjectItemsRequest,
  ): Promise<BaseResponse> {
    await this.projectService.deleteProjectItems(user, body);
    return buildSuccessResponse();
  }
}
