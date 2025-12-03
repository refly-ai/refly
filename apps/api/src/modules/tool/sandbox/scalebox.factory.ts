import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PinoLogger } from 'nestjs-pino';

import { guard } from '../../../utils/guard';
import { Config } from '../../config/config.decorator';
import { DEFAULT_WRAPPER_TYPE, WrapperType } from './scalebox.constants';
import { SandboxRequestParamsException } from './scalebox.exception';
import { ExecutionContext, OnLifecycleFailed } from './scalebox.dto';
import { ISandboxWrapper, SandboxMetadata } from './wrapper/base';
import { ExecutorWrapper } from './wrapper/executor';
import { InterpreterWrapper } from './wrapper/interpreter';

/**
 * Factory for creating sandbox wrapper instances
 * Supports switching between executor (refly-executor-slim) and interpreter (code-interpreter) implementations
 */
@Injectable()
export class SandboxWrapperFactory {
  @Config.string('sandbox.scalebox.wrapperType', DEFAULT_WRAPPER_TYPE)
  private readonly wrapperType!: WrapperType;

  @Config.string('sandbox.scalebox.templateName', '')
  private readonly templateName!: string;

  constructor(
    private readonly config: ConfigService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(SandboxWrapperFactory.name);
    void this.config; // Used by @Config decorators
  }

  /**
   * Create a new sandbox wrapper
   */
  async create(
    context: ExecutionContext,
    timeoutMs: number,
    onFailed?: OnLifecycleFailed,
  ): Promise<ISandboxWrapper> {
    const template = this.getTemplateName();

    this.logger.debug(
      { wrapperType: this.wrapperType, template, canvasId: context.canvasId },
      'Creating sandbox wrapper',
    );

    if (this.wrapperType === 'interpreter') {
      return InterpreterWrapper.create(this.logger, context, template, timeoutMs, onFailed);
    }

    return ExecutorWrapper.create(this.logger, context, template, timeoutMs, onFailed);
  }

  /**
   * Reconnect to an existing sandbox
   */
  async reconnect(
    context: ExecutionContext,
    metadata: SandboxMetadata,
    onFailed?: OnLifecycleFailed,
  ): Promise<ISandboxWrapper> {
    this.logger.debug(
      { wrapperType: this.wrapperType, sandboxId: metadata.sandboxId },
      'Reconnecting sandbox wrapper',
    );

    if (this.wrapperType === 'interpreter') {
      return InterpreterWrapper.reconnect(this.logger, context, metadata, onFailed);
    }

    return ExecutorWrapper.reconnect(this.logger, context, metadata, onFailed);
  }

  /**
   * Get the template name based on wrapper type
   * interpreter mode forces code-interpreter template
   * executor mode requires templateName to be configured
   */
  private getTemplateName(): string {
    if (this.wrapperType === 'interpreter') {
      return 'code-interpreter';
    }

    const template = guard
      .notEmpty(this.templateName)
      .orThrow(
        () =>
          new SandboxRequestParamsException(
            'getTemplateName',
            'SCALEBOX_TEMPLATE_NAME is required when wrapperType=executor. ' +
              'Please set the environment variable or switch to wrapperType=interpreter.',
          ),
      );

    guard
      .ensure(/^[a-z0-9-]+$/.test(template))
      .orThrow(
        () =>
          new SandboxRequestParamsException(
            'getTemplateName',
            `Invalid template name "${template}": only lowercase letters, numbers, and hyphens are allowed.`,
          ),
      );

    return template;
  }

  /**
   * Get current wrapper type (for logging/debugging)
   */
  getWrapperType(): WrapperType {
    return this.wrapperType;
  }

  /**
   * Get current template name (for idle queue partitioning)
   */
  getCurrentTemplateName(): string {
    return this.getTemplateName();
  }
}
