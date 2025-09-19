import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Attachment, Resend } from 'resend';
import { SendEmailRequest, User } from '@refly/openapi-schema';
import { PrismaService } from '../common/prisma.service';
import { ParamsError } from '@refly/errors';
import { MiscService } from '../misc/misc.service';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);
  private readonly resend: Resend;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly miscService: MiscService,
  ) {
    this.resend = new Resend(this.configService.get('email.resendApiKey'));
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

    const res = await this.resend.emails.send({
      from: sender,
      to: receiver,
      subject,
      html,
      attachments,
    });

    this.logger.log(`Email sent successfully to ${receiver}`);

    if (res.error) {
      throw new Error(res.error?.message);
    }

    this.logger.log(`Email sent to successfully in ${new Date().getTime() - now.getTime()}ms`);
  }
}
