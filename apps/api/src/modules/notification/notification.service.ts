import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Attachment, ErrorResponse, Resend } from 'resend';
import { SendEmailRequest, User } from '@refly/openapi-schema';
import { PrismaService } from '../common/prisma.service';
import { ParamsError } from '@refly/errors';
import { MiscService } from '../misc/misc.service';
import { guard } from '../../utils/guard';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);
  private readonly resend: Resend;
  private readonly maxRetries: number;
  private readonly baseDelayMs: number;
  private lastEmailSentAt = 0;
  private readonly minTimeBetweenEmailsMs: number;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly miscService: MiscService,
  ) {
    this.resend = new Resend(this.configService.get('email.resendApiKey'));
    this.maxRetries = this.configService.get<number>('email.maxRetries') ?? 3;
    this.baseDelayMs = this.configService.get<number>('email.baseDelayMs') ?? 500;
    this.minTimeBetweenEmailsMs =
      this.configService.get<number>('email.minTimeBetweenEmailsMs') ?? 500;
  }

  /**
   * Ensure minimum time between email sends to respect rate limits
   */
  private async enforceRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastEmail = now - this.lastEmailSentAt;

    if (timeSinceLastEmail < this.minTimeBetweenEmailsMs) {
      const delayNeeded = this.minTimeBetweenEmailsMs - timeSinceLastEmail;
      this.logger.debug(`Rate limiting: waiting ${delayNeeded}ms before sending next email`);
      await new Promise((resolve) => setTimeout(resolve, delayNeeded));
    }

    this.lastEmailSentAt = Date.now();
  }

  /**
   * Check if error is rate limit related
   */
  private isRateLimitError(error: ErrorResponse): boolean {
    return (
      error?.name === 'rate_limit_exceeded' ||
      error?.message?.toLowerCase().includes('rate') ||
      error?.message?.toLowerCase().includes('limit')
    );
  }

  /**
   * Send email with retry logic for rate limit errors using guard.retry
   * @param emailData - Email data to send
   * @returns Resend response
   */
  private async sendEmailWithRetry(emailData: {
    from: string;
    to: string;
    subject: string;
    html: string;
    attachments?: Attachment[];
  }): Promise<any> {
    return guard
      .retry(
        async () => {
          // Enforce rate limit before sending
          await this.enforceRateLimit();

          const res = await this.resend.emails.send(emailData);

          // Check for rate limit error in response
          if (res.error) {
            if (this.isRateLimitError(res.error)) {
              // Throw to trigger retry
              throw new Error(`Rate limit exceeded: ${res.error.message}`);
            }
            // Other errors should not be retried
            throw new Error(res.error.message);
          }

          return res;
        },
        {
          maxAttempts: this.maxRetries,
          initialDelay: this.baseDelayMs,
          maxDelay: this.baseDelayMs * 2 ** (this.maxRetries - 1),
          backoffFactor: 2,
          retryIf: (error: any) => this.isRateLimitError(error),
          onRetry: (error: any, attempt: number) => {
            this.logger.warn(
              `Rate limit error detected. Retrying... (attempt ${attempt}/${this.maxRetries}): ${error.message}`,
            );
          },
        },
      )
      .orThrow((error: any) => {
        this.logger.error(
          `Failed to send email after ${this.maxRetries} retries: ${error.message}`,
        );
        return new Error(`Failed to send email: ${error.message}`);
      });
  }

  /**
   * Validate if the given string is a valid email address
   * @param email - Email string to validate
   * @returns boolean indicating if email is valid
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  private async processAttachmentURL(url: string): Promise<Attachment> {
    const privateStaticEndpoint = this.configService
      .get('static.private.endpoint')
      ?.replace(/\/$/, '');
    const payloadMode = this.configService.get<'base64' | 'url'>('email.payloadMode');

    // For external URLs, always use path parameter
    if (!url.startsWith(privateStaticEndpoint)) {
      return {
        path: url,
        filename: url.split('/').pop() ?? 'attachment',
      };
    }

    const storageKey = url.replace(`${privateStaticEndpoint}/`, '');

    if (payloadMode === 'base64') {
      const file = await this.miscService.downloadFile({ storageKey, visibility: 'private' });
      const base64Content = file.toString('base64');

      return {
        content: base64Content,
        filename: url.split('/').pop() ?? 'attachment',
      };
    } else if (payloadMode === 'url') {
      const externalUrl = await this.miscService.generateTempPublicURL(storageKey, 60 * 60 * 24);
      return {
        path: externalUrl,
        filename: url.split('/').pop() ?? 'attachment',
      };
    } else {
      throw new Error('Invalid payload mode');
    }
  }

  async processURL(url: string): Promise<string> {
    const privateStaticEndpoint = this.configService
      .get('static.private.endpoint')
      ?.replace(/\/$/, '');
    const payloadMode = this.configService.get<'base64' | 'url'>('email.payloadMode');

    // For external URLs, always use path parameter
    if (!url.startsWith(privateStaticEndpoint)) {
      return url;
    }

    const storageKey = url.replace(`${privateStaticEndpoint}/`, '');

    if (payloadMode === 'base64') {
      const file = await this.miscService.downloadFile({ storageKey, visibility: 'private' });
      const base64Content = file.toString('base64');

      return base64Content;
    } else if (payloadMode === 'url') {
      const externalUrl = await this.miscService.generateTempPublicURL(storageKey, 60 * 60 * 24);
      return externalUrl;
    } else {
      throw new Error('Invalid payload mode');
    }
  }

  async batchProcessURL(urls: string[]): Promise<string[]> {
    const privateStaticEndpoint = this.configService
      .get('static.private.endpoint')
      ?.replace(/\/$/, '');
    const payloadMode = this.configService.get<'base64' | 'url'>('email.payloadMode');

    const processSingleURL = async (url: string): Promise<string> => {
      // For external URLs, always use path parameter
      if (!url.startsWith(privateStaticEndpoint)) {
        return url;
      }

      const storageKey = url.replace(`${privateStaticEndpoint}/`, '');

      if (payloadMode === 'base64') {
        const file = await this.miscService.downloadFile({ storageKey, visibility: 'private' });
        const base64Content = file.toString('base64');

        return base64Content;
      } else if (payloadMode === 'url') {
        const externalUrl = await this.miscService.generateTempPublicURL(storageKey, 60 * 60 * 24);
        return externalUrl;
      } else {
        throw new Error('Invalid payload mode');
      }
    };

    return Promise.all(urls.map(processSingleURL));
  }

  /**
   * Send email using Resend service
   * @param param - Email parameters
   * @returns BaseResponse
   */
  async sendEmail(param: SendEmailRequest, user?: User) {
    this.logger.log(`Sending email with param: ${JSON.stringify(param)}`);

    const now = new Date();
    const { to, subject, html, from, attachments: attachmentUrls } = param;
    const sender = from || this.configService.get('email.sender');

    if (!sender) {
      throw new ParamsError('Email sender is not configured');
    }

    let receiver = to;

    // Validate email address and fallback to user email if invalid
    if (receiver && !this.isValidEmail(receiver)) {
      this.logger.warn(`Invalid email address provided: ${receiver}, falling back to user email`);
      receiver = user?.email;
    }

    // Fallback to user email if not provided or invalid
    if (!receiver && user?.email) {
      receiver = user.email;
    }

    // Final fallback: fetch user email from database
    if (!receiver && user?.uid) {
      const userPo = await this.prisma.user.findUnique({
        select: { email: true },
        where: { uid: user.uid },
      });
      if (userPo?.email) {
        receiver = userPo.email;
      }
    }

    if (!receiver) {
      throw new ParamsError('No valid receiver email specified');
    }

    this.logger.log(`Prepare to send email to ${receiver}`);

    let attachments: Attachment[] = [];
    if (attachmentUrls) {
      attachments = await Promise.all(attachmentUrls.map((url) => this.processAttachmentURL(url)));
    }

    await this.sendEmailWithRetry({
      from: sender,
      to: receiver,
      subject,
      html,
      attachments,
    });

    this.logger.log(
      `Email sent successfully to ${receiver} in ${new Date().getTime() - now.getTime()}ms`,
    );
  }
}
