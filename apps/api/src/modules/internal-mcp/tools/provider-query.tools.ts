import { Injectable, Logger } from '@nestjs/common';
import { Tool, Context } from '@rekog/mcp-nest';
import { z } from 'zod';
import { Request } from 'express';
import { InternalMcpService } from '../internal-mcp.service';
import { User as UserModel } from '../../../generated/client';
import { ProviderService } from '../../provider/provider.service';
import { MediaGenerationModelConfig } from '@refly/openapi-schema';
import { safeParseJSON } from '@refly/utils';

@Injectable()
export class ProviderQueryTools {
  private readonly logger = new Logger(ProviderQueryTools.name);

  constructor(
    private readonly providerService: ProviderService,
    private readonly internalMcpService: InternalMcpService,
  ) {}

  /**
   * Get available media generation models with their capabilities
   */
  @Tool({
    name: 'get_media_generation_models',
    description:
      'Get all available media generation models with their specific capabilities (image, video, audio generation). This tool is recommended to use before generate_media to discover available models, their capabilities, and supported media types. This helps you choose the most appropriate model and provider for your specific media generation needs.',
    parameters: z.object({
      mediaType: z
        .enum(['image', 'video', 'audio'])
        .optional()
        .describe('Filter models by media type capability (optional)'),
      enabled: z
        .boolean()
        .optional()
        .describe('Filter models by enabled status (optional, defaults to true)'),
    }),
  })
  async getMediaGenerationModels(
    params: {
      mediaType?: 'image' | 'video' | 'audio';
      enabled?: boolean;
    },
    _context: Context,
    request: Request,
  ) {
    try {
      const user = request.user as UserModel;

      if (!user?.uid) {
        this.logger.error('User not found in request, MCP tool authentication may have failed');
        return {
          content: [{ type: 'text', text: 'Error: User authentication failed' }],
        };
      }

      this.logger.log(
        `Tool 'get_media_generation_models' called by user ${user.uid}, params: ${JSON.stringify(params)}`,
      );

      const providerItems = await this.providerService.listProviderItems(user, {
        category: 'mediaGeneration',
        enabled: params.enabled ?? true,
      });

      const mediaModels = providerItems
        .map((item) => {
          let config: MediaGenerationModelConfig = {
            modelId: '',
            modelName: '',
            capabilities: {},
            description: '',
          };
          try {
            config = safeParseJSON(item.config || '{}');
          } catch (error) {
            this.logger.warn(`Failed to parse config for item ${item.itemId}: ${error?.message}`);
            return null;
          }

          // Filter by media type if specified
          if (params.mediaType && !config.capabilities?.[params.mediaType]) {
            return null;
          }

          return {
            itemId: item.itemId,
            modelId: config.modelId,
            name: item.name,
            providerKey: item.provider?.providerKey,
            enabled: item.enabled,
            description: config.description || '',
            provider: {
              providerId: item.provider?.providerId,
              providerKey: item.provider?.providerKey,
              name: item.provider?.name,
            },
            config: {
              modelId: config.modelId,
              modelName: config.modelName,
            },
            supportedMediaTypes: Object.keys(config.capabilities || {}),
          };
        })
        .filter(Boolean);

      return this.internalMcpService.formatSuccessResponse({
        mediaModels,
        total: mediaModels.length,
        filteredByMediaType: params.mediaType,
      });
    } catch (error) {
      this.logger.error(`Error in get_media_generation_models: ${error?.message || error}`);
      return this.internalMcpService.formatErrorResponse(error);
    }
  }
}
