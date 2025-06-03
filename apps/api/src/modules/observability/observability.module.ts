import { Module, Global, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { initializeObservability, shutdownObservability } from '@refly/observability';

@Global()
@Module({})
export class ObservabilityModule implements OnModuleInit, OnModuleDestroy {
  constructor(private readonly configService: ConfigService) {}

  async onModuleInit(): Promise<void> {
    // Initialize Langfuse with configuration from environment variables
    const langfuseConfig = {
      secretKey: this.configService.get<string>('LANGFUSE_SECRET_KEY'),
      publicKey: this.configService.get<string>('LANGFUSE_PUBLIC_KEY'),
      baseUrl: this.configService.get<string>('LANGFUSE_HOST', 'https://cloud.langfuse.com'),
      enabled: this.configService.get<boolean>('LANGFUSE_ENABLED', true),
      flushAt: this.configService.get<number>('LANGFUSE_FLUSH_AT', 15),
      flushInterval: this.configService.get<number>('LANGFUSE_FLUSH_INTERVAL', 1000),
      requestTimeout: this.configService.get<number>('LANGFUSE_REQUEST_TIMEOUT', 10000),
    };

    const securityConfig = {
      sensitiveKeys: this.configService
        .get<string>('LANGFUSE_SENSITIVE_KEYS', '')
        .split(',')
        .filter(Boolean),
      maxStringLength: this.configService.get<number>('LANGFUSE_MAX_STRING_LENGTH', 10000),
      enableDataMasking: this.configService.get<boolean>('LANGFUSE_ENABLE_DATA_MASKING', true),
    };

    // Log configuration for debugging (without sensitive keys)
    console.log('[ObservabilityModule] Langfuse Configuration:', {
      baseUrl: langfuseConfig.baseUrl,
      enabled: langfuseConfig.enabled,
      hasSecretKey: !!langfuseConfig.secretKey,
      hasPublicKey: !!langfuseConfig.publicKey,
      flushAt: langfuseConfig.flushAt,
      flushInterval: langfuseConfig.flushInterval,
      requestTimeout: langfuseConfig.requestTimeout,
    });

    initializeObservability(langfuseConfig, securityConfig);
  }

  async onModuleDestroy(): Promise<void> {
    await shutdownObservability();
  }
}
