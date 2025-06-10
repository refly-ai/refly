import { Injectable } from '@nestjs/common';
import { LangfuseListener } from './langfuse-listener';

@Injectable()
export class LangfuseService {
  private instance: LangfuseListener;

  constructor(publicKey: string, secretKey: string, baseUrl?: string) {
    this.instance = new LangfuseListener({
      publicKey,
      secretKey,
      baseUrl,
    });
  }

  /**
   * Create a new trace for monitoring
   */
  createTrace(userId: string, metadata: Record<string, any>) {
    return this.instance.createTrace({
      userId,
      metadata,
    });
  }

  /**
   * Get the underlying Langfuse listener instance
   */
  getInstance(): LangfuseListener {
    return this.instance;
  }

  /**
   * Flush and cleanup resources
   */
  async flush(): Promise<void> {
    await this.instance.flush();
  }
}
