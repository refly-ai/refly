import { z } from 'zod';
import { AgentBaseTool, AgentBaseToolset, AgentToolConstructor, ToolCallResult } from '../base';
import { ToolsetDefinition } from '@refly/openapi-schema';
import { google } from 'googleapis';
import { ToolParams } from '@langchain/core/tools';
import MailComposer = require('nodemailer/lib/mail-composer');
import { convert } from 'html-to-text';

export const GmailToolsetDefinition: ToolsetDefinition = {
  key: 'gmail',
  domain: 'https://mail.google.com',
  labelDict: {
    en: 'Gmail',
    'zh-CN': 'Gmail',
  },
  descriptionDict: {
    en: 'Access and manage Gmail emails. Send, receive, organize emails and manage labels.',
    'zh-CN': '访问和管理 Gmail 邮件。发送、接收、整理邮件和管理标签。',
  },
  tools: [
    {
      name: 'send_email',
      descriptionDict: {
        en: 'Send an email from your Gmail account.',
        'zh-CN': '从您的 Gmail 账户发送邮件。',
      },
    },
    {
      name: 'find_email',
      descriptionDict: {
        en: 'Find emails using Gmail search query.',
        'zh-CN': '使用 Gmail 搜索查询查找邮件。',
      },
    },
    {
      name: 'create_draft',
      descriptionDict: {
        en: 'Create a draft email in Gmail.',
        'zh-CN': '在 Gmail 中创建草稿邮件。',
      },
    },
    {
      name: 'add_label_to_email',
      descriptionDict: {
        en: 'Add a label to an email.',
        'zh-CN': '为邮件添加标签。',
      },
    },
    {
      name: 'remove_label_from_email',
      descriptionDict: {
        en: 'Remove a label from an email.',
        'zh-CN': '从邮件中移除标签。',
      },
    },
    {
      name: 'archive_email',
      descriptionDict: {
        en: 'Archive an email (remove from inbox).',
        'zh-CN': '归档邮件（从收件箱中移除）。',
      },
    },
    {
      name: 'delete_email',
      descriptionDict: {
        en: 'Delete an email permanently.',
        'zh-CN': '永久删除邮件。',
      },
    },
    {
      name: 'download_attachment',
      descriptionDict: {
        en: 'Download an attachment from an email.',
        'zh-CN': '从邮件中下载附件。',
      },
    },
    {
      name: 'create_label',
      descriptionDict: {
        en: 'Create a new label in Gmail.',
        'zh-CN': '在 Gmail 中创建新标签。',
      },
    },
    {
      name: 'list_labels',
      descriptionDict: {
        en: 'List all labels in Gmail.',
        'zh-CN': '列出 Gmail 中的所有标签。',
      },
    },
    {
      name: 'list_send_as_aliases',
      descriptionDict: {
        en: 'List all send-as aliases in Gmail.',
        'zh-CN': '列出 Gmail 中的所有发送别名。',
      },
    },
    {
      name: 'update_primary_signature',
      descriptionDict: {
        en: 'Update the primary signature in Gmail.',
        'zh-CN': '更新 Gmail 中的主要签名。',
      },
    },
  ],
  requiresAuth: true,
  authPatterns: [
    {
      type: 'oauth',
      provider: 'google',
      scope: ['https://mail.google.com/'],
    },
  ],
  configItems: [
    {
      key: 'redirectUri',
      inputMode: 'text',
      labelDict: {
        en: 'Redirect URI',
        'zh-CN': '重定向 URI',
      },
      descriptionDict: {
        en: 'The OAuth 2.0 redirect URI configured in Google Cloud Console',
        'zh-CN': '在 Google Cloud Console 中配置的 OAuth 2.0 重定向 URI',
      },
      defaultValue: 'http://localhost:3000/oauth2callback',
    },
  ],
};

// Automatic assemble clientId, clientSecret, refreshToken, accessToken if authType is oauth
export interface GmailParams extends ToolParams {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  accessToken: string;
  redirectUri?: string;
}

// Helper function to create authenticated Gmail service
function createGmailService(params: GmailParams) {
  const oauth2Client = new google.auth.OAuth2(
    params.clientId,
    params.clientSecret,
    params.redirectUri ?? 'http://localhost:3000/oauth2callback',
  );

  oauth2Client.setCredentials({
    refresh_token: params.refreshToken,
  });

  return google.gmail({ version: 'v1', auth: oauth2Client });
}

// Helper function to encode message for sending
function encodeMessage(message: Buffer): string {
  return message.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Helper function to decode base64url encoded data
function decodeBase64Url(data: string): string {
  const base64 = data.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(base64, 'base64').toString('utf-8');
}

// Helper function to extract email headers
function extractHeader(headers: any[], name: string): string | undefined {
  const header = headers?.find((h) => h.name?.toLowerCase() === name.toLowerCase());
  return header?.value;
}

export class GmailSendEmail extends AgentBaseTool<GmailParams> {
  name = 'send_email';
  toolsetKey = GmailToolsetDefinition.key;

  schema = z.object({
    to: z.array(z.string()).describe('Array of recipient email addresses'),
    cc: z.array(z.string()).optional().describe('Array of CC email addresses'),
    bcc: z.array(z.string()).optional().describe('Array of BCC email addresses'),
    subject: z.string().describe('Email subject'),
    body: z.string().describe('Email body content'),
    bodyType: z
      .enum(['html', 'plaintext'])
      .optional()
      .default('plaintext')
      .describe('Type of email body'),
    fromName: z.string().optional().describe('Sender name (optional)'),
    fromEmail: z.string().optional().describe('Sender email address (optional)'),
    replyTo: z.string().optional().describe('Reply-to email address (optional)'),
    inReplyTo: z.string().optional().describe('Message ID to reply to (optional)'),
    attachments: z
      .array(
        z.object({
          filename: z.string(),
          content: z.string(),
          mimeType: z.string().optional(),
        }),
      )
      .optional()
      .describe('Array of attachments'),
  });

  description = 'Send an email from your Gmail account.';

  protected params: GmailParams;

  constructor(params: GmailParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    try {
      const gmailService = createGmailService(this.params);

      // Build email options
      const mailOptions: any = {
        from:
          input.fromName && input.fromEmail
            ? `${input.fromName} <${input.fromEmail}>`
            : input.fromEmail || this.params.clientId, // fallback to authenticated user
        to: input.to.join(', '),
        subject: input.subject,
      };

      // Add optional fields
      if (input.cc?.length) {
        mailOptions.cc = input.cc.join(', ');
      }
      if (input.bcc?.length) {
        mailOptions.bcc = input.bcc.join(', ');
      }
      if (input.replyTo) {
        mailOptions.replyTo = input.replyTo;
      }
      if (input.inReplyTo) {
        mailOptions.inReplyTo = input.inReplyTo;
      }

      // Set body content based on type
      if (input.bodyType === 'html') {
        mailOptions.html = input.body;
      } else {
        mailOptions.text = input.body;
      }

      // Add attachments if provided
      if (input.attachments?.length) {
        mailOptions.attachments = input.attachments.map((attachment) => ({
          filename: attachment.filename,
          content: Buffer.from(attachment.content, 'base64'),
          contentType: attachment.mimeType,
        }));
      }

      // Create and send email
      const mailComposer = new MailComposer(mailOptions);
      const message = await mailComposer.compile().build();
      const encodedMessage = encodeMessage(message);

      const response = await gmailService.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: encodedMessage,
        },
      });

      const result = {
        message: 'Email sent successfully',
        messageId: response.data.id,
        threadId: response.data.threadId,
        labelIds: response.data.labelIds,
      };

      return {
        status: 'success',
        data: result,
        summary: `Successfully sent email with subject: "${input.subject}"`,
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Error sending email',
        summary:
          error instanceof Error ? error.message : 'Unknown error occurred while sending email',
      };
    }
  }
}

export class GmailFindEmail extends AgentBaseTool<GmailParams> {
  name = 'find_email';
  toolsetKey = GmailToolsetDefinition.key;

  schema = z.object({
    q: z
      .string()
      .describe(
        'Gmail search query (e.g., "from:someone@example.com", "subject:important", "is:unread")',
      ),
    maxResults: z.number().optional().default(10).describe('Maximum number of messages to return'),
    includeSpamTrash: z
      .boolean()
      .optional()
      .default(false)
      .describe('Include messages from SPAM and TRASH'),
    labelIds: z.array(z.string()).optional().describe('Only return messages with these label IDs'),
  });

  description = 'Find emails using Gmail search query.';

  protected params: GmailParams;

  constructor(params: GmailParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    try {
      const gmailService = createGmailService(this.params);

      // Search for messages
      const searchResponse = await gmailService.users.messages.list({
        userId: 'me',
        q: input.q,
        maxResults: input.maxResults,
        includeSpamTrash: input.includeSpamTrash,
        labelIds: input.labelIds,
      });

      const messages = searchResponse.data.messages || [];
      const messageIds = messages.map((msg: any) => msg.id).filter(Boolean) as string[];

      // Get full message details for each found message
      const fullMessages = await Promise.all(
        messageIds.map(async (messageId) => {
          const messageResponse = await gmailService.users.messages.get({
            userId: 'me',
            id: messageId,
          });
          return messageResponse.data;
        }),
      );

      // Process messages to extract useful information
      const processedMessages = fullMessages.map((message: any) => {
        const headers = message.payload?.headers || [];
        const subject = extractHeader(headers, 'Subject') || '';
        const from = extractHeader(headers, 'From') || '';
        const to = extractHeader(headers, 'To') || '';
        const date = extractHeader(headers, 'Date') || '';

        // Extract text content from message payload
        let textContent = '';
        if (message.payload?.body?.data) {
          textContent = decodeBase64Url(message.payload.body.data);
        } else if (message.payload?.parts) {
          // Handle multipart messages
          const textPart = message.payload.parts.find(
            (part: any) => part.mimeType === 'text/plain' || part.mimeType === 'text/html',
          );
          if (textPart?.body?.data) {
            textContent = decodeBase64Url(textPart.body.data);
            if (textPart.mimeType === 'text/html') {
              textContent = convert(textContent);
            }
          }
        }

        return {
          id: message.id,
          threadId: message.threadId,
          subject,
          from,
          to,
          date,
          snippet: message.snippet,
          textContent: textContent.substring(0, 1000), // Limit content length
          labelIds: message.labelIds || [],
          hasAttachments:
            message.payload?.parts?.some((part: any) => part.body?.attachmentId) || false,
        };
      });

      const result = {
        message: 'Emails found successfully',
        query: input.q,
        totalResults: processedMessages.length,
        messages: processedMessages,
      };

      return {
        status: 'success',
        data: result,
        summary: `Found ${processedMessages.length} emails matching query: "${input.q}"`,
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Error finding emails',
        summary:
          error instanceof Error ? error.message : 'Unknown error occurred while finding emails',
      };
    }
  }
}

export class GmailCreateDraft extends AgentBaseTool<GmailParams> {
  name = 'create_draft';
  toolsetKey = GmailToolsetDefinition.key;

  schema = z.object({
    to: z.array(z.string()).describe('Array of recipient email addresses'),
    cc: z.array(z.string()).optional().describe('Array of CC email addresses'),
    bcc: z.array(z.string()).optional().describe('Array of BCC email addresses'),
    subject: z.string().describe('Email subject'),
    body: z.string().describe('Email body content'),
    bodyType: z
      .enum(['html', 'plaintext'])
      .optional()
      .default('plaintext')
      .describe('Type of email body'),
    fromName: z.string().optional().describe('Sender name (optional)'),
    fromEmail: z.string().optional().describe('Sender email address (optional)'),
    replyTo: z.string().optional().describe('Reply-to email address (optional)'),
    inReplyTo: z.string().optional().describe('Message ID to reply to (optional)'),
    attachments: z
      .array(
        z.object({
          filename: z.string(),
          content: z.string(),
          mimeType: z.string().optional(),
        }),
      )
      .optional()
      .describe('Array of attachments'),
  });

  description = 'Create a draft email in Gmail.';

  protected params: GmailParams;

  constructor(params: GmailParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    try {
      const gmailService = createGmailService(this.params);

      // Build email options
      const mailOptions: any = {
        from:
          input.fromName && input.fromEmail
            ? `${input.fromName} <${input.fromEmail}>`
            : input.fromEmail || this.params.clientId,
        to: input.to.join(', '),
        subject: input.subject,
      };

      // Add optional fields
      if (input.cc?.length) {
        mailOptions.cc = input.cc.join(', ');
      }
      if (input.bcc?.length) {
        mailOptions.bcc = input.bcc.join(', ');
      }
      if (input.replyTo) {
        mailOptions.replyTo = input.replyTo;
      }
      if (input.inReplyTo) {
        mailOptions.inReplyTo = input.inReplyTo;
      }

      // Set body content based on type
      if (input.bodyType === 'html') {
        mailOptions.html = input.body;
      } else {
        mailOptions.text = input.body;
      }

      // Add attachments if provided
      if (input.attachments?.length) {
        mailOptions.attachments = input.attachments.map((attachment) => ({
          filename: attachment.filename,
          content: Buffer.from(attachment.content, 'base64'),
          contentType: attachment.mimeType,
        }));
      }

      // Create draft email
      const mailComposer = new MailComposer(mailOptions);
      const message = await mailComposer.compile().build();

      const response = await gmailService.users.drafts.create({
        userId: 'me',
        requestBody: {
          message: {
            raw: message.toString('base64'),
          },
        },
      });

      const result = {
        message: 'Draft created successfully',
        draftId: response.data.id,
        messageId: response.data.message?.id,
        threadId: response.data.message?.threadId,
      };

      return {
        status: 'success',
        data: result,
        summary: `Successfully created draft email with subject: "${input.subject}"`,
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Error creating draft',
        summary:
          error instanceof Error ? error.message : 'Unknown error occurred while creating draft',
      };
    }
  }
}

export class GmailListLabels extends AgentBaseTool<GmailParams> {
  name = 'list_labels';
  toolsetKey = GmailToolsetDefinition.key;

  schema = z.object({});

  description = 'List all labels in Gmail.';

  protected params: GmailParams;

  constructor(params: GmailParams) {
    super(params);
    this.params = params;
  }

  async _call(_input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    try {
      const gmailService = createGmailService(this.params);

      const response = await gmailService.users.labels.list({
        userId: 'me',
      });

      const labels = response.data.labels || [];

      const result = {
        message: 'Labels retrieved successfully',
        labels: labels.map((label: any) => ({
          id: label.id,
          name: label.name,
          type: label.type,
          color: label.color,
          messagesTotal: label.messagesTotal,
          messagesUnread: label.messagesUnread,
          threadsTotal: label.threadsTotal,
          threadsUnread: label.threadsUnread,
        })),
        totalCount: labels.length,
      };

      return {
        status: 'success',
        data: result,
        summary: `Successfully retrieved ${labels.length} labels`,
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Error listing labels',
        summary:
          error instanceof Error ? error.message : 'Unknown error occurred while listing labels',
      };
    }
  }
}

export class GmailAddLabelToEmail extends AgentBaseTool<GmailParams> {
  name = 'add_label_to_email';
  toolsetKey = GmailToolsetDefinition.key;

  schema = z.object({
    messageId: z.string().describe('The ID of the message to add label to'),
    labelId: z.string().describe('The ID of the label to add'),
  });

  description = 'Add a label to an email.';

  protected params: GmailParams;

  constructor(params: GmailParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    try {
      const gmailService = createGmailService(this.params);

      const response = await gmailService.users.messages.modify({
        userId: 'me',
        id: input.messageId,
        requestBody: {
          addLabelIds: [input.labelId],
        },
      });

      const result = {
        message: 'Label added successfully',
        messageId: input.messageId,
        addedLabelId: input.labelId,
        labelIds: response.data.labelIds,
      };

      return {
        status: 'success',
        data: result,
        summary: 'Successfully added label to email',
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Error adding label to email',
        summary:
          error instanceof Error
            ? error.message
            : 'Unknown error occurred while adding label to email',
      };
    }
  }
}

export class GmailArchiveEmail extends AgentBaseTool<GmailParams> {
  name = 'archive_email';
  toolsetKey = GmailToolsetDefinition.key;

  schema = z.object({
    messageId: z.string().describe('The ID of the message to archive'),
  });

  description = 'Archive an email (remove from inbox).';

  protected params: GmailParams;

  constructor(params: GmailParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    try {
      const gmailService = createGmailService(this.params);

      const response = await gmailService.users.messages.modify({
        userId: 'me',
        id: input.messageId,
        requestBody: {
          removeLabelIds: ['INBOX'],
        },
      });

      const result = {
        message: 'Email archived successfully',
        messageId: input.messageId,
        labelIds: response.data.labelIds,
      };

      return {
        status: 'success',
        data: result,
        summary: 'Successfully archived email',
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Error archiving email',
        summary:
          error instanceof Error ? error.message : 'Unknown error occurred while archiving email',
      };
    }
  }
}

export class GmailRemoveLabelFromEmail extends AgentBaseTool<GmailParams> {
  name = 'remove_label_from_email';
  toolsetKey = GmailToolsetDefinition.key;

  schema = z.object({
    messageId: z.string().describe('The ID of the message to remove label from'),
    removeLabelIds: z.array(z.string()).describe('Array of label IDs to remove'),
  });

  description = 'Remove a label from an email.';

  protected params: GmailParams;

  constructor(params: GmailParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    try {
      const gmailService = createGmailService(this.params);

      const response = await gmailService.users.messages.modify({
        userId: 'me',
        id: input.messageId,
        requestBody: {
          removeLabelIds: input.removeLabelIds,
        },
      });

      const result = {
        message: 'Labels removed successfully',
        messageId: input.messageId,
        removedLabelIds: input.removeLabelIds,
        labelIds: response.data.labelIds,
      };

      return {
        status: 'success',
        data: result,
        summary: `Successfully removed ${input.removeLabelIds.length} label(s) from email`,
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Error removing label from email',
        summary:
          error instanceof Error
            ? error.message
            : 'Unknown error occurred while removing label from email',
      };
    }
  }
}

export class GmailDeleteEmail extends AgentBaseTool<GmailParams> {
  name = 'delete_email';
  toolsetKey = GmailToolsetDefinition.key;

  schema = z.object({
    messageId: z.string().describe('The ID of the message to delete'),
  });

  description = 'Delete an email permanently.';

  protected params: GmailParams;

  constructor(params: GmailParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    try {
      const gmailService = createGmailService(this.params);

      await gmailService.users.messages.trash({
        userId: 'me',
        id: input.messageId,
      });

      const result = {
        message: 'Email deleted successfully',
        messageId: input.messageId,
      };

      return {
        status: 'success',
        data: result,
        summary: `Successfully deleted email (ID: ${input.messageId})`,
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Error deleting email',
        summary:
          error instanceof Error ? error.message : 'Unknown error occurred while deleting email',
      };
    }
  }
}

export class GmailDownloadAttachment extends AgentBaseTool<GmailParams> {
  name = 'download_attachment';
  toolsetKey = GmailToolsetDefinition.key;

  schema = z.object({
    messageId: z.string().describe('The ID of the message containing the attachment'),
    attachmentId: z.string().describe('The ID of the attachment to download'),
    filename: z.string().optional().describe('Optional filename for the downloaded attachment'),
  });

  description = 'Download an attachment from an email.';

  protected params: GmailParams;

  constructor(params: GmailParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    try {
      const gmailService = createGmailService(this.params);

      const attachment = await gmailService.users.messages.attachments.get({
        userId: 'me',
        messageId: input.messageId,
        id: input.attachmentId,
      });

      const buffer = Buffer.from(attachment.data.data ?? '', 'base64');

      const result = {
        message: 'Attachment downloaded successfully',
        messageId: input.messageId,
        attachmentId: input.attachmentId,
        filename: input.filename,
        data: buffer.toString('base64'),
        size: attachment.data.size,
      };

      return {
        status: 'success',
        data: result,
        summary: 'Successfully downloaded attachment from email',
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Error downloading attachment',
        summary:
          error instanceof Error
            ? error.message
            : 'Unknown error occurred while downloading attachment',
      };
    }
  }
}

export class GmailCreateLabel extends AgentBaseTool<GmailParams> {
  name = 'create_label';
  toolsetKey = GmailToolsetDefinition.key;

  schema = z.object({
    name: z.string().describe('The display name of the label'),
    textColor: z.string().optional().describe('The text color of the label'),
    backgroundColor: z.string().optional().describe('The background color of the label'),
    messageListVisibility: z
      .enum(['show', 'hide'])
      .optional()
      .describe('The visibility of messages with this label in the message list'),
    labelListVisibility: z
      .enum(['labelShow', 'labelShowIfUnread', 'labelHide'])
      .optional()
      .describe('The visibility of the label in the label list'),
  });

  description = 'Create a new label in Gmail.';

  protected params: GmailParams;

  constructor(params: GmailParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    try {
      const gmailService = createGmailService(this.params);

      const requestBody: any = {
        name: input.name,
      };

      if (input.messageListVisibility) {
        requestBody.messageListVisibility = input.messageListVisibility;
      }
      if (input.labelListVisibility) {
        requestBody.labelListVisibility = input.labelListVisibility;
      }
      if (input.textColor || input.backgroundColor) {
        requestBody.color = {};
        if (input.textColor) {
          requestBody.color.textColor = input.textColor;
        }
        if (input.backgroundColor) {
          requestBody.color.backgroundColor = input.backgroundColor;
        }
      }

      const response = await gmailService.users.labels.create({
        userId: 'me',
        requestBody,
      });

      const result = {
        message: 'Label created successfully',
        label: {
          id: response.data.id,
          name: response.data.name,
          type: response.data.type,
          color: response.data.color,
          messageListVisibility: response.data.messageListVisibility,
          labelListVisibility: response.data.labelListVisibility,
        },
      };

      return {
        status: 'success',
        data: result,
        summary: `Successfully created label: ${input.name}`,
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Error creating label',
        summary:
          error instanceof Error ? error.message : 'Unknown error occurred while creating label',
      };
    }
  }
}

export class GmailListSendAsAliases extends AgentBaseTool<GmailParams> {
  name = 'list_send_as_aliases';
  toolsetKey = GmailToolsetDefinition.key;

  schema = z.object({});

  description = 'List all send-as aliases in Gmail.';

  protected params: GmailParams;

  constructor(params: GmailParams) {
    super(params);
    this.params = params;
  }

  async _call(_input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    try {
      const gmailService = createGmailService(this.params);

      const response = await gmailService.users.settings.sendAs.list({
        userId: 'me',
      });

      const sendAs = response.data.sendAs || [];

      const result = {
        message: 'Send-as aliases retrieved successfully',
        sendAs: sendAs.map((alias: any) => ({
          sendAsEmail: alias.sendAsEmail,
          displayName: alias.displayName,
          replyToAddress: alias.replyToAddress,
          signature: alias.signature,
          isPrimary: alias.isPrimary,
          isDefault: alias.isDefault,
          treatAsAlias: alias.treatAsAlias,
          verificationStatus: alias.verificationStatus,
        })),
        totalCount: sendAs.length,
      };

      return {
        status: 'success',
        data: result,
        summary: `Successfully retrieved ${sendAs.length} send-as aliases`,
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Error listing send-as aliases',
        summary:
          error instanceof Error
            ? error.message
            : 'Unknown error occurred while listing send-as aliases',
      };
    }
  }
}

export class GmailUpdatePrimarySignature extends AgentBaseTool<GmailParams> {
  name = 'update_primary_signature';
  toolsetKey = GmailToolsetDefinition.key;

  schema = z.object({
    signature: z.string().describe('The new signature content'),
  });

  description = 'Update the primary signature in Gmail.';

  protected params: GmailParams;

  constructor(params: GmailParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    try {
      const gmailService = createGmailService(this.params);

      // First get the primary send-as alias
      const sendAsResponse = await gmailService.users.settings.sendAs.list({
        userId: 'me',
      });

      const primaryAlias = sendAsResponse.data.sendAs?.find((alias: any) => alias.isPrimary);
      if (!primaryAlias?.sendAsEmail) {
        throw new Error('No primary send-as alias found');
      }

      // Update the signature
      await gmailService.users.settings.sendAs.update({
        userId: 'me',
        sendAsEmail: primaryAlias.sendAsEmail,
        requestBody: {
          signature: input.signature,
        },
      });

      const result = {
        message: 'Primary signature updated successfully',
        sendAsEmail: primaryAlias.sendAsEmail,
        signature: input.signature,
      };

      return {
        status: 'success',
        data: result,
        summary: `Successfully updated signature for ${primaryAlias.sendAsEmail}`,
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Error updating primary signature',
        summary:
          error instanceof Error
            ? error.message
            : 'Unknown error occurred while updating primary signature',
      };
    }
  }
}

export class GmailToolset extends AgentBaseToolset<GmailParams> {
  toolsetKey = GmailToolsetDefinition.key;
  tools = [
    GmailSendEmail,
    GmailFindEmail,
    GmailCreateDraft,
    GmailAddLabelToEmail,
    GmailRemoveLabelFromEmail,
    GmailArchiveEmail,
    GmailDeleteEmail,
    GmailDownloadAttachment,
    GmailCreateLabel,
    GmailListLabels,
    GmailListSendAsAliases,
    GmailUpdatePrimarySignature,
  ] satisfies readonly AgentToolConstructor<GmailParams>[];
}
