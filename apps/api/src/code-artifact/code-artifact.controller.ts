import { Controller, Post, Body, Get, Query, UseGuards } from '@nestjs/common';
import { CodeArtifactService } from './code-artifact.service';
import { UpsertCodeArtifactRequest, User } from '@refly-packages/openapi-schema';
import { buildSuccessResponse } from '@/utils';
import { codeArtifactPO2DTO } from '@/code-artifact/code-artifact.dto';
import { LoginedUser } from '@/utils/decorators/user.decorator';
import { JwtAuthGuard } from '@/auth/guard/jwt-auth.guard';

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
}
