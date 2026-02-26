/**
 * Handlers Module
 *
 * Encapsulates all handler services for tool execution:
 * - Core: HandlerService, ToolWrapperFactoryService
 * - Pre-handlers: DynamicPreHandlerService, ComposioPreHandlerService
 * - Post-handlers: DynamicPostHandlerService, RegularToolPostHandlerService, ComposioToolPostHandlerService
 */

import { Module } from '@nestjs/common';
import { BillingModule } from '../billing/billing.module';
import { DriveModule } from '../../drive/drive.module';
import { MiscModule } from '../../misc/misc.module';
import { CommonModule } from '../../common/common.module';
import { ResourceHandler } from '../resource.service';

// Core handlers
import { HandlerService } from './core/handler.service';
import { ToolWrapperFactoryService } from './core/wrapper.service';

// Pre-handlers
import { DynamicPreHandlerService } from './pre/dynamic-pre.service';
import { ComposioToolPreHandlerService } from './pre/composio-pre.service';
import { PreHandlerRegistryService } from './pre/pre-registry.service';

// Post-handlers
import { DynamicPostHandlerService } from './post/dynamic-post.service';
import { RegularToolPostHandlerService } from './post/regular-post.service';
import { ComposioToolPostHandlerService } from './post/composio-post.service';

@Module({
  imports: [CommonModule, BillingModule, DriveModule, MiscModule],
  providers: [
    // Resource handler (needed by post-handlers)
    ResourceHandler,

    // Core handlers
    HandlerService,
    ToolWrapperFactoryService,

    // Pre-handlers
    DynamicPreHandlerService,
    ComposioToolPreHandlerService,
    PreHandlerRegistryService,

    // Post-handlers
    DynamicPostHandlerService,
    RegularToolPostHandlerService,
    ComposioToolPostHandlerService,
  ],
  exports: [
    // Export resource handler (used by other modules)
    ResourceHandler,

    // Export core handlers
    HandlerService,
    ToolWrapperFactoryService,

    // Export pre-handlers
    DynamicPreHandlerService,
    ComposioToolPreHandlerService,
    PreHandlerRegistryService,

    // Export post-handlers
    DynamicPostHandlerService,
    RegularToolPostHandlerService,
    ComposioToolPostHandlerService,
  ],
})
export class HandlersModule {}
