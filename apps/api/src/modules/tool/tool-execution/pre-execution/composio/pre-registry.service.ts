import { Injectable } from '@nestjs/common';
import type { IToolPreHandler } from './pre.interface';
import { ComposioToolPreHandlerService } from './composio-pre.service';

/**
 * Registry for pre-execution handlers
 * Uses a single generic handler for all Composio tools
 */
@Injectable()
export class PreHandlerRegistryService {
  constructor(private readonly composioPreHandler: ComposioToolPreHandlerService) {}

  /**
   * Get pre-handler for a specific toolset/tool combination
   */
  getHandler(_toolsetKey: string, _toolName: string): IToolPreHandler {
    // Use generic Composio handler for all tools
    return this.composioPreHandler;
  }
}
