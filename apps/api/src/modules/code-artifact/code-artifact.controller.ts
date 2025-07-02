import {
  Controller,
  Post,
  Body,
  Get,
  Query,
  UseGuards,
  DefaultValuePipe,
  ParseIntPipe,
  ParseBoolPipe,
} from '@nestjs/common';
import { CodeArtifactService } from './code-artifact.service';
import { UpsertCodeArtifactRequest, User } from '@refly/openapi-schema';
import { buildSuccessResponse } from '../../utils';
import { codeArtifactPO2DTO } from '../code-artifact/code-artifact.dto';
import { LoginedUser } from '../../utils/decorators/user.decorator';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';

@Controller('v1/codeArtifact')
export class CodeArtifactController {
  constructor(private readonly codeArtifactService: CodeArtifactService) {}

  @UseGuards(JwtAuthGuard)
  @Post('new')
  async createCodeArtifact(@LoginedUser() user: User, @Body() body: UpsertCodeArtifactRequest) {
    const artifact = await this.codeArtifactService.createCodeArtifact(user, body);
    return buildSuccessResponse(codeArtifactPO2DTO(artifact));
  }

  @UseGuards(JwtAuthGuard)
  @Post('update')
  async updateCodeArtifact(@LoginedUser() user: User, @Body() body: UpsertCodeArtifactRequest) {
    const artifact = await this.codeArtifactService.updateCodeArtifact(user, body);
    return buildSuccessResponse(codeArtifactPO2DTO(artifact));
  }

  @UseGuards(JwtAuthGuard)
  @Get('detail')
  async getCodeArtifactDetail(@LoginedUser() user: User, @Query('artifactId') artifactId: string) {
    const detail = await this.codeArtifactService.getCodeArtifactDetail(user, artifactId);
    return buildSuccessResponse(codeArtifactPO2DTO(detail));
  }

  @UseGuards(JwtAuthGuard)
  @Get('list')
  async listCodeArtifacts(
    @LoginedUser() user: User,
    @Query('resultId') resultId: string,
    @Query('resultVersion', new DefaultValuePipe(0), ParseIntPipe) resultVersion: number,
    @Query('needContent', new DefaultValuePipe(false), ParseBoolPipe) needContent: boolean,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('pageSize', new DefaultValuePipe(10), ParseIntPipe) pageSize: number,
  ) {
    const artifacts = await this.codeArtifactService.listCodeArtifacts(user, {
      resultId,
      resultVersion,
      needContent,
      page,
      pageSize,
    });
    return buildSuccessResponse(artifacts.map(codeArtifactPO2DTO));
  }
}
