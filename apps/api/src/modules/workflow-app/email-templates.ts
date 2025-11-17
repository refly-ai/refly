/**
 * Email templates for workflow app notifications
 */

export interface WorkflowAppReviewEmailTemplate {
  subject: string;
  body: {
    mainMessage: string;
    templateLinkLabel: string;
    discordMessage: string;
    discordLink: string;
  };
}

/**
 * Email template for workflow app review submission
 */
export const WORKFLOW_APP_REVIEW_EMAIL_TEMPLATE: WorkflowAppReviewEmailTemplate = {
  subject: 'Template Submitted for Review',
  body: {
    mainMessage:
      'Your template "{{template_name}}" has been submitted for review. We will complete the review within 24 hours.',
    templateLinkLabel: 'Template：',
    discordMessage: 'Join our Discord to track your review status and connect with other creators.',
    discordLink: 'Discord：https://discord.com/invite/bWjffrb89h',
  },
};

/**
 * Generate HTML email content for workflow app review notification
 * @param templateName - Name of the template
 * @param templateLink - Link to the template
 * @returns HTML string for email
 */
export function generateWorkflowAppReviewEmailHTML(
  templateName: string,
  templateLink: string,
): string {
  const template = WORKFLOW_APP_REVIEW_EMAIL_TEMPLATE;
  const mainMessage = template.body.mainMessage.replace('{{template_name}}', templateName);

  return `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="X-UA-Compatible" content="IE=edge">
        <title>${template.subject}</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5; line-height: 1.6; color: #1c1f23;">
        <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f5f5f5; padding: 20px 0;">
          <tr>
            <td align="center" style="padding: 20px 0;">
              <table role="presentation" style="width: 100%; max-width: 600px; background-color: #ffffff; border-radius: 8px; border-collapse: collapse; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);">
                <tr>
                  <td style="padding: 32px 32px 24px 32px;">
                    <p style="margin: 0 0 24px 0; font-size: 16px; color: #1c1f23;">${mainMessage}</p>
                    <p style="margin: 0 0 16px 0; font-size: 14px; color: #1c1f23;">
                      ${template.body.templateLinkLabel}
                      <a href="${templateLink}" style="color: #155EEF; text-decoration: none; word-break: break-all;">${templateLink}</a>
                    </p>
                    <p style="margin: 0 0 8px 0; font-size: 14px; color: #1c1f23;">${template.body.discordMessage}</p>
                    <p style="margin: 0; font-size: 14px; color: #1c1f23;">
                      ${template.body.discordLink}
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;
}
