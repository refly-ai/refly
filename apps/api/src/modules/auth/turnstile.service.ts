import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class TurnstileService {
  private logger = new Logger(TurnstileService.name);

  constructor(private configService: ConfigService) {}

  async verifyToken(token: string): Promise<boolean> {
    const enabled = this.configService.get<boolean>('auth.turnstile.enabled');

    if (!enabled) {
      this.logger.debug('Cloudflare Turnstile is disabled. Skipping verification.');
      return true;
    }

    const secretKey = this.configService.get<string>('auth.turnstile.secretKey');

    if (!secretKey) {
      this.logger.warn(
        'Cloudflare Turnstile is enabled but secret key is not configured. Skipping verification.',
      );
      return true;
    }

    if (!token) {
      this.logger.warn('Cloudflare Turnstile is enabled but no token provided.');
      return false;
    }

    try {
      const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          secret: secretKey,
          response: token,
        }),
      });

      const data = await response.json();
      return !!data.success;
    } catch (error) {
      this.logger.error(`Cloudflare Turnstile verification failed: ${error.message}`);
      return false;
    }
  }
}
