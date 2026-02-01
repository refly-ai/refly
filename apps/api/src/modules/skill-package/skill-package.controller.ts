/**
 * Skill Package Controller - REST API endpoints.
 */

import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  NotFoundException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { SkillPackageService } from './skill-package.service';
import { SkillInstallationService } from './skill-installation.service';
import {
  CreateSkillPackageDto,
  UpdateSkillPackageDto,
  SkillPackageFilterDto,
  SearchSkillsDto,
  AddWorkflowDto,
  UpdateDependenciesDto,
  DownloadSkillDto,
  InstallSkillDto,
  InstallationFilterDto,
  UninstallOptionsDto,
  UpdateInstallationDto,
  RunSkillDto,
  PaginatedResult,
  SkillPackageResponse,
  SkillWorkflowResponse,
  SkillInstallationResponse,
  SkillExecutionResult,
  CreateSkillPackageCliDto,
  CreateSkillPackageCliResponse,
} from './skill-package.dto';
import { SKILL_CLI_ERROR_CODES, throwCliError, mapErrorToCliCode } from './skill-package.errors';

@Controller('v1/skill-packages')
@UseGuards(JwtAuthGuard)
export class SkillPackageController {
  constructor(
    private readonly skillPackageService: SkillPackageService,
    private readonly skillInstallationService: SkillInstallationService,
  ) {}

  // ===== Package CRUD =====

  @Post()
  async createSkillPackage(
    @Req() req: any,
    @Body() input: CreateSkillPackageDto,
  ): Promise<SkillPackageResponse> {
    return this.skillPackageService.createSkillPackage(req.user, input);
  }

  @Get()
  async listSkillPackages(
    @Req() req: any,
    @Query() filter: SkillPackageFilterDto,
  ): Promise<PaginatedResult<SkillPackageResponse>> {
    return this.skillPackageService.listSkillPackages(req.user, filter);
  }

  @Get(':skillId')
  async getSkillPackage(
    @Req() req: any,
    @Param('skillId') skillId: string,
    @Query('includeWorkflows') includeWorkflows?: string,
    @Query('shareId') shareId?: string,
  ): Promise<SkillPackageResponse> {
    const result = await this.skillPackageService.getSkillPackage(skillId, {
      includeWorkflows: includeWorkflows === 'true',
      userId: req.user?.uid,
      shareId,
    });

    if (!result) {
      throw new NotFoundException(`Skill package not found: ${skillId}`);
    }

    return result;
  }

  @Patch(':skillId')
  async updateSkillPackage(
    @Req() req: any,
    @Param('skillId') skillId: string,
    @Body() input: UpdateSkillPackageDto,
  ): Promise<SkillPackageResponse> {
    return this.skillPackageService.updateSkillPackage(req.user, skillId, input);
  }

  // DELETE endpoint removed - use uninstall instead
  // @Delete(':skillId')
  // async deleteSkillPackage(@Req() req: any, @Param('skillId') skillId: string): Promise<void> {
  //   return this.skillPackageService.deleteSkillPackage(req.user, skillId);
  // }

  // ===== Workflow Management =====

  @Post(':skillId/workflows')
  async addWorkflow(
    @Req() req: any,
    @Param('skillId') skillId: string,
    @Body() input: AddWorkflowDto,
  ): Promise<SkillWorkflowResponse> {
    return this.skillPackageService.addWorkflowToSkill(req.user, skillId, input);
  }

  @Patch(':skillId/workflows/:skillWorkflowId/dependencies')
  async updateDependencies(
    @Req() req: any,
    @Param('skillWorkflowId') skillWorkflowId: string,
    @Body() input: UpdateDependenciesDto,
  ): Promise<void> {
    return this.skillPackageService.updateWorkflowDependencies(
      req.user,
      skillWorkflowId,
      input.dependencies,
    );
  }

  @Delete(':skillId/workflows/:skillWorkflowId')
  async removeWorkflow(
    @Req() req: any,
    @Param('skillWorkflowId') skillWorkflowId: string,
  ): Promise<void> {
    return this.skillPackageService.removeWorkflowFromSkill(req.user, skillWorkflowId);
  }

  // ===== Publishing =====

  @Post(':skillId/publish')
  async publishSkill(
    @Req() req: any,
    @Param('skillId') skillId: string,
  ): Promise<SkillPackageResponse> {
    return this.skillPackageService.publishSkillPackage(req.user, skillId);
  }

  @Post(':skillId/unpublish')
  async unpublishSkill(@Req() req: any, @Param('skillId') skillId: string): Promise<void> {
    return this.skillPackageService.unpublishSkillPackage(req.user, skillId);
  }

  // ===== Discovery =====

  @Get('public/search')
  async searchPublicSkills(
    @Query() query: SearchSkillsDto,
  ): Promise<PaginatedResult<SkillPackageResponse>> {
    return this.skillPackageService.searchPublicSkills(query);
  }

  @Get('public/share/:shareId')
  async getPublicSkill(@Param('shareId') shareId: string): Promise<SkillPackageResponse> {
    const result = await this.skillPackageService.getSkillByShareId(shareId);
    if (!result) {
      throw new NotFoundException(`Skill not found with shareId: ${shareId}`);
    }
    return result;
  }
}

@Controller('v1/skill-installations')
@UseGuards(JwtAuthGuard)
export class SkillInstallationController {
  constructor(private readonly skillInstallationService: SkillInstallationService) {}

  // ===== Installation =====

  @Post()
  async downloadSkill(
    @Req() req: any,
    @Body() input: DownloadSkillDto,
  ): Promise<SkillInstallationResponse> {
    return this.skillInstallationService.downloadSkill(req.user, input.skillId, input.shareId);
  }

  @Post('install')
  async installSkill(
    @Req() req: any,
    @Body() input: InstallSkillDto,
  ): Promise<SkillInstallationResponse> {
    return this.skillInstallationService.installSkill(req.user, input);
  }

  @Post(':installationId/initialize')
  async initializeSkill(
    @Req() req: any,
    @Param('installationId') installationId: string,
  ): Promise<SkillInstallationResponse> {
    return this.skillInstallationService.initializeSkill(req.user, installationId);
  }

  @Post(':installationId/upgrade')
  async upgradeSkill(
    @Req() req: any,
    @Param('installationId') installationId: string,
  ): Promise<SkillInstallationResponse> {
    return this.skillInstallationService.upgradeSkill(req.user, installationId);
  }

  @Patch(':installationId')
  async updateInstallation(
    @Req() req: any,
    @Param('installationId') installationId: string,
    @Body() input: UpdateInstallationDto,
  ): Promise<SkillInstallationResponse> {
    return this.skillInstallationService.updateInstallation(req.user, installationId, input);
  }

  @Delete(':installationId')
  async uninstallSkill(
    @Req() req: any,
    @Param('installationId') installationId: string,
    @Query() options: UninstallOptionsDto,
  ): Promise<void> {
    return this.skillInstallationService.uninstallSkill(req.user, installationId, options);
  }

  // ===== Queries =====

  @Get()
  async listInstallations(
    @Req() req: any,
    @Query() filter: InstallationFilterDto,
  ): Promise<PaginatedResult<SkillInstallationResponse>> {
    return this.skillInstallationService.getUserInstallations(req.user, filter);
  }

  @Get(':installationId')
  async getInstallation(
    @Param('installationId') installationId: string,
  ): Promise<SkillInstallationResponse> {
    const result = await this.skillInstallationService.getInstallation(installationId);
    if (!result) {
      throw new NotFoundException(`Installation not found: ${installationId}`);
    }
    return result;
  }

  // ===== Execution =====

  @Post(':installationId/run')
  async runSkill(
    @Req() req: any,
    @Param('installationId') installationId: string,
    @Body() input: RunSkillDto,
  ): Promise<SkillExecutionResult> {
    return this.skillInstallationService.runInstalledSkill(req.user, installationId, input);
  }

  @Post(':installationId/stop')
  async stopSkill(
    @Req() req: any,
    @Param('installationId') installationId: string,
  ): Promise<{
    message: string;
    installationId: string;
    stoppedExecutions: Array<{
      executionId: string;
      workflowsAborted: number;
    }>;
  }> {
    return this.skillInstallationService.stopRunningExecutions(req.user, installationId);
  }
}

/**
 * CLI-specific Skill Package Controller
 * These endpoints are designed for the Refly CLI and use standardized CLI error format.
 */
@ApiTags('CLI Skill Packages')
@ApiBearerAuth()
@Controller('v1/cli/skill-packages')
@UseGuards(JwtAuthGuard)
export class SkillPackageCliController {
  private readonly logger = new Logger(SkillPackageCliController.name);

  constructor(private readonly skillPackageService: SkillPackageService) {}

  /**
   * Create a skill package with optional workflow binding/generation
   * POST /v1/cli/skill-packages
   *
   * Supports multiple modes:
   * - Auto-generate workflow from description + triggers (default)
   * - Bind existing workflow(s) via workflowId/workflowIds
   * - Create workflow from spec via workflowSpec
   * - Generate workflow from natural language via workflowQuery
   * - Create skill metadata only via noWorkflow flag
   */
  @ApiOperation({ summary: 'Create skill package with workflow' })
  @ApiResponse({ status: 201, description: 'Skill package created successfully' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 404, description: 'Workflow not found' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  @Post()
  async createSkillPackageWithWorkflow(
    @Req() req: any,
    @Body() input: CreateSkillPackageCliDto,
  ): Promise<{ ok: true; type: string; version: string; payload: CreateSkillPackageCliResponse }> {
    this.logger.log(`Creating skill package "${input.name}" for user ${req.user?.uid}`);

    try {
      // Validate required fields
      if (!input.name?.trim()) {
        throwCliError(
          SKILL_CLI_ERROR_CODES.VALIDATION_ERROR,
          'Skill name is required',
          'Provide a name using --name <name>',
        );
      }

      const result = await this.skillPackageService.createSkillPackageWithWorkflow(req.user, input);

      this.logger.log(`Created skill package: ${result.skillId}`);

      return {
        ok: true,
        type: 'skill.create',
        version: '1.0',
        payload: result,
      };
    } catch (error) {
      // If it's already a CLI error (HttpException), rethrow it
      if ((error as any).response?.ok === false) {
        throw error;
      }

      // Map generic errors to CLI error codes
      const { code, status, hint } = mapErrorToCliCode(error as Error);
      this.logger.error(`Failed to create skill package: ${(error as Error).message}`);

      throwCliError(code, (error as Error).message, hint, status);
    }
  }

  /**
   * Get a skill package by ID (CLI format)
   * GET /v1/cli/skill-packages/:skillId
   */
  @ApiOperation({ summary: 'Get skill package by ID' })
  @ApiResponse({ status: 200, description: 'Skill package found' })
  @ApiResponse({ status: 404, description: 'Skill not found' })
  @Get(':skillId')
  async getSkillPackage(
    @Req() req: any,
    @Param('skillId') skillId: string,
  ): Promise<{ ok: true; type: string; version: string; payload: SkillPackageResponse }> {
    this.logger.log(`Getting skill package ${skillId} for user ${req.user?.uid}`);

    try {
      const result = await this.skillPackageService.getSkillPackage(skillId, {
        includeWorkflows: true,
        userId: req.user?.uid,
      });

      if (!result) {
        throwCliError(
          SKILL_CLI_ERROR_CODES.SKILL_NOT_FOUND,
          `Skill package not found: ${skillId}`,
          'Check the skill ID and try again',
          HttpStatus.NOT_FOUND,
        );
      }

      return {
        ok: true,
        type: 'skill.get',
        version: '1.0',
        payload: result,
      };
    } catch (error) {
      if ((error as any).response?.ok === false) {
        throw error;
      }

      const { code, status, hint } = mapErrorToCliCode(error as Error);
      this.logger.error(`Failed to get skill package: ${(error as Error).message}`);
      throwCliError(code, (error as Error).message, hint, status);
    }
  }

  // DELETE endpoint removed - use uninstall instead
  // /**
  //  * Delete a skill package (CLI format)
  //  * DELETE /v1/cli/skill-packages/:skillId
  //  */
  // @ApiOperation({ summary: 'Delete skill package' })
  // @ApiResponse({ status: 200, description: 'Skill package deleted' })
  // @ApiResponse({ status: 404, description: 'Skill not found' })
  // @Delete(':skillId')
  // async deleteSkillPackage(
  //   @Req() req: any,
  //   @Param('skillId') skillId: string,
  // ): Promise<{ ok: true; type: string; version: string; payload: { deleted: boolean } }> {
  //   this.logger.log(`Deleting skill package ${skillId} for user ${req.user?.uid}`);
  //
  //   try {
  //     await this.skillPackageService.deleteSkillPackage(req.user, skillId);
  //
  //     return {
  //       ok: true,
  //       type: 'skill.delete',
  //       version: '1.0',
  //       payload: { deleted: true },
  //     };
  //   } catch (error) {
  //     if ((error as any).response?.ok === false) {
  //       throw error;
  //     }
  //
  //     const { code, status, hint } = mapErrorToCliCode(error as Error);
  //     this.logger.error(`Failed to delete skill package: ${(error as Error).message}`);
  //     throwCliError(code, (error as Error).message, hint, status);
  //   }
  // }
}
