/**
 * PTC SDK Service
 * Manages SDK definition reading and injection for Programmatic Tool Calling (PTC) mode
 */

import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PinoLogger } from 'nestjs-pino';
import type { GenericToolset } from '@refly/openapi-schema';
import type { PtcContext } from '@refly/skill-template';
import { ObjectStorageService, OSS_INTERNAL } from '../../common/object-storage';
import { streamToBuffer } from '../../../utils';
import { Config } from '../../config/config.decorator';

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

  async buildPtcContext(toolsets: GenericToolset[]): Promise<PtcContext> {
    const toolsetInfos = toolsets.map((toolset) => ({
      id: toolset.id,
      name: toolset.name,
      key: toolset.toolset?.key || toolset.id,
    }));

    const codes = await Promise.all(
      toolsetInfos.map((info) =>
        this.getToolsetSdk(info).then((code) => ({
          toolsetKey: info.key,
          path: code.path,
          content: code.content,
        })),
      ),
    );
    const docs = await Promise.all(
      toolsetInfos.map((info) =>
        this.getToolsetSdkDoc(info).then((doc) => ({
          toolsetKey: info.key,
          path: doc.path,
          content: doc.content,
        })),
      ),
    );

    return {
      toolsets: toolsetInfos,
      sdk: {
        pathPrefix: this.getSdkPathPrefix(),
        codes,
        docs,
      },
    };
  }

  private async getToolsetSdk(toolsetInfo: { id: string; name: string; key: string }): Promise<{
    path: string;
    content: string;
  }> {
    const path = this.getToolsetSdkCodePath(toolsetInfo.key);
    const content = (await this.readSdkDefinitionFromS3(path)) ?? '';
    return {
      path,
      content,
    };
  }

  private async getToolsetSdkDoc(toolsetInfo: { id: string; name: string; key: string }): Promise<{
    path: string;
    content: string;
  }> {
    const path = this.getToolsetSdkDocPath(toolsetInfo.key);
    const content = (await this.readSdkDefinitionFromS3(path)) ?? '';
    return {
      path,
      content,
    };
  }

  private getSdkPathPrefix(): string {
    const hash = this.s3LibHash;
    const normalizedPrefix = this.s3LibPathPrefix.replace(/\/+$/, '');
    return `${normalizedPrefix}/${hash}`;
  }

  private getToolsetSdkCodePath(toolsetKey: string): string {
    const pathPrefix = this.getSdkPathPrefix();
    return `${pathPrefix}/refly_tools/${toolsetKey}.py`;
  }

  private getToolsetSdkDocPath(toolsetKey: string): string {
    const pathPrefix = this.getSdkPathPrefix();
    return `${pathPrefix}/refly_tools/docs/${toolsetKey}.md`;
  }

  /**
   * Read SDK definition file from S3 storage
   * @param sdkDefinitionPath - S3 path to SDK definition file
   * @returns SDK definition content or null if read fails
   */
  private async readSdkDefinitionFromS3(sdkDefinitionPath: string): Promise<string | null> {
    try {
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
