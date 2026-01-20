/**
 * PTC SDK Service
 * Manages SDK definition reading and injection for Programmatic Tool Calling (PTC) mode
 */

import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PinoLogger } from 'nestjs-pino';
import type { GenericToolset, User } from '@refly/openapi-schema';
import type { PtcConfig } from '@refly/skill-template';
import { ObjectStorageService, OSS_INTERNAL } from '../../common/object-storage';
import { streamToBuffer } from '../../../utils';
import { Config } from '../../config/config.decorator';

export interface ToolsetSdkInfo {
  toolsetId: string;
  toolsetKey: string;
  toolsetName: string;
  sdkDefinitionPath?: string;
  sdkDefinition?: string;
}

@Injectable()
export class PtcSdkService {
  @Config.string('sandbox.s3Lib.pathPrefix', '')
  private readonly s3LibPathPrefix: string;

  @Config.string('sandbox.s3Lib.hash', '')
  private readonly s3LibHash: string;

  constructor(
    @Inject(OSS_INTERNAL) private readonly internalOss: ObjectStorageService,
    private readonly config: ConfigService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(PtcSdkService.name);
    void this.config; // Suppress unused warning - used by @Config decorators
  }

  /**
   * Build PTC config with SDK definitions for given toolsets
   * @param user - Current user
   * @param toolsets - Toolsets to load SDK definitions for
   * @returns PTC config with SDK definitions
   */
  async buildPtcConfigWithSdkDefinitions(
    user: User,
    toolsets: GenericToolset[],
  ): Promise<PtcConfig> {
    this.logger.info(
      `[PTC SDK] Building PTC config with SDK definitions for toolsets: ${toolsets.map((t) => t.name).join(', ')}`,
    );

    const toolsetSdkInfos = await Promise.all(
      toolsets.map((toolset) => this.loadToolsetSdkDefinition(user, toolset)),
    );

    const ptcConfig: PtcConfig = {
      toolsets: toolsetSdkInfos.map((info) => ({
        id: info.toolsetId,
        name: info.toolsetName,
        key: info.toolsetKey,
        sdkDefinitionPath: info.sdkDefinitionPath,
        sdkDefinition: info.sdkDefinition,
      })),
    };

    const loadedCount = toolsetSdkInfos.filter((info) => info.sdkDefinition).length;
    this.logger.info(
      `[PTC SDK] Loaded ${loadedCount}/${toolsets.length} SDK definitions successfully`,
    );

    return ptcConfig;
  }

  /**
   * Load SDK definition for a single toolset
   * @param user - Current user
   * @param toolset - Toolset to load SDK definition for
   * @returns Toolset SDK info with definition content
   */
  private async loadToolsetSdkDefinition(
    _user: User,
    toolset: GenericToolset,
  ): Promise<ToolsetSdkInfo> {
    const toolsetInfo: ToolsetSdkInfo = {
      toolsetId: toolset.id,
      toolsetName: toolset.name,
      toolsetKey: toolset.toolset?.key || toolset.id,
    };

    try {
      // Get SDK definition path for this toolset
      const sdkDefinitionPath = this.getToolsetSdkPath(toolset);

      if (!sdkDefinitionPath) {
        this.logger.warn(
          `[PTC SDK] No SDK path found for toolset ${toolset.id} (${toolset.name}), skipping`,
        );
        return toolsetInfo;
      }

      this.logger.info(`[PTC SDK] Toolset ${toolset.name}: SDK path = ${sdkDefinitionPath}`);

      toolsetInfo.sdkDefinitionPath = sdkDefinitionPath;

      // Read SDK definition from S3
      const sdkDefinition = await this.readSdkDefinitionFromS3(sdkDefinitionPath);

      if (sdkDefinition) {
        toolsetInfo.sdkDefinition = sdkDefinition;
        this.logger.info(
          `[PTC SDK] Successfully loaded SDK definition for toolset ${toolset.id} (${toolset.name})`,
        );
      } else {
        this.logger.warn(
          `[PTC SDK] Failed to read SDK definition for toolset ${toolset.id} (${toolset.name})`,
        );
      }
    } catch (error) {
      this.logger.error(
        `[PTC SDK] Error loading SDK definition for toolset ${toolset.id}: ${error?.message}`,
      );
    }

    return toolsetInfo;
  }

  /**
   * Get SDK definition path for a toolset
   * @param toolset - Toolset to get SDK path for
   * @returns SDK definition path in S3, or null if not available
   */
  private getToolsetSdkPath(toolset: GenericToolset): string | null {
    try {
      const pathPrefix = this.s3LibPathPrefix;
      const hash = this.s3LibHash;

      // Normalize path prefix (remove trailing slashes)
      const normalizedPrefix = pathPrefix.replace(/\/+$/, '');

      const toolsetKey = toolset.toolset?.key;

      // Construct SDK path
      return `${normalizedPrefix}/${hash}/refly_tools/${toolsetKey}.py`;
    } catch (error) {
      this.logger.error(
        `[PTC SDK] Error getting SDK path for toolset ${toolset.id}: ${error?.message}`,
      );
      return null;
    }
  }

  /**
   * Read SDK definition file from S3 storage
   * @param sdkDefinitionPath - S3 path to SDK definition file
   * @returns SDK definition content or null if read fails
   */
  private async readSdkDefinitionFromS3(sdkDefinitionPath: string): Promise<string | null> {
    try {
      this.logger.debug(`[PTC SDK] Reading SDK definition from S3: ${sdkDefinitionPath}`);

      const stream = await this.internalOss.getObject(sdkDefinitionPath);
      if (!stream) {
        this.logger.warn(`[PTC SDK] SDK definition file not found in S3: ${sdkDefinitionPath}`);
        return null;
      }

      const buffer = await streamToBuffer(stream);
      const content = buffer.toString('utf-8');

      this.logger.info(
        `[PTC SDK] Successfully read SDK definition from S3: ${sdkDefinitionPath}, size: ${content.length} bytes`,
      );

      return content;
    } catch (error) {
      this.logger.error(
        `[PTC SDK] Failed to read SDK definition from S3: ${sdkDefinitionPath}, error: ${error?.message}`,
      );
      return null;
    }
  }
}
