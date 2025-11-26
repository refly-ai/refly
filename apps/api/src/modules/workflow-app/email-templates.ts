/**
 * Email templates for workflow app notifications
 */

export interface WorkflowAppReviewEmailTemplate {
  subject: string;
  body: {
    greeting: string;
    thanksMessage: string;
    reviewMessage: string;
    templateLinkLabel: string;
    discordMessage: string;
    discordLink: string;
    closingThanks: string;
    closingMessage: string;
  };
}

/**
 * Email template for workflow app review submission
 */
export const WORKFLOW_APP_REVIEW_EMAIL_TEMPLATE: WorkflowAppReviewEmailTemplate = {
  subject: 'Your template "{{template_name}}" is under review',
  body: {
    greeting: 'Hi Creator,',
    thanksMessage: 'Thanks for submitting your template "{{template_name}}" to Refly.ai! 🎉',
    reviewMessage:
      "Our team has received your submission and the review process has officially begun. We typically complete the review. You'll receive another email once the review is done.",
    templateLinkLabel: 'Template link:',
    discordMessage:
      "If you'd like to track your review status or get feedback from other creators, feel free to join our Discord community — it's the fastest place to stay updated.",
    discordLink: 'Join Discord: https://discord.com/invite/YVuYFjFvRC',
    closingThanks: 'Thanks again for contributing to the Refly community.',
    closingMessage: "We can't wait to see what you've built!",
  },
};

/**
 * Generate HTML email content for workflow app review notification
 * @param templateName - Name of the template
 * @param templateLink - Link to the template
 * @param note - Optional note/remark to include in the email
 * @returns HTML string for email
 */
export function generateWorkflowAppReviewEmailHTML(
  templateName: string,
  templateLink: string,
  note?: string,
): string {
  const template = WORKFLOW_APP_REVIEW_EMAIL_TEMPLATE;
  const subject = template.subject.replace('{{template_name}}', templateName);
  const greeting = template.body.greeting;
  const thanksMessage = template.body.thanksMessage.replace('{{template_name}}', templateName);
  const reviewMessage = template.body.reviewMessage;
  const templateLinkLabel = template.body.templateLinkLabel;
  const discordMessage = template.body.discordMessage;
  const discordLink = template.body.discordLink;
  const closingThanks = template.body.closingThanks;
  const closingMessage = template.body.closingMessage;

  return `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="X-UA-Compatible" content="IE=edge">
        <title>${subject}</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5; line-height: 1.6; color: #1c1f23;">
        <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f5f5f5; padding: 20px 0;">
          <tr>
            <td align="center" style="padding: 20px 0;">
              <table role="presentation" style="width: 100%; max-width: 600px; background-color: #ffffff; border-radius: 8px; border-collapse: collapse; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);">
                <tr>
                  <td style="padding: 32px 32px 24px 32px;">
                    <p style="margin: 0 0 16px 0; font-size: 16px; color: #1c1f23;">${greeting}</p>
                    <p style="margin: 0 0 16px 0; font-size: 16px; color: #1c1f23;">${thanksMessage}</p>
                    <p style="margin: 0 0 16px 0; font-size: 16px; color: #1c1f23;">${reviewMessage}</p>
                    <p style="margin: 0 0 16px 0; font-size: 14px; color: #1c1f23;">
                      ${templateLinkLabel}
                      <a href="${templateLink}" style="color: #155EEF; text-decoration: none; word-break: break-all;">${templateLink}</a>
                    </p>
                    ${note ? `<p style="margin: 0 0 16px 0; font-size: 14px; color: #1c1f23;">${note}</p>` : ''}
                    <p style="margin: 0 0 16px 0; font-size: 14px; color: #1c1f23;">${discordMessage}</p>
                    <p style="margin: 0 0 16px 0; font-size: 14px; color: #1c1f23;">${discordLink}</p>
                    <p style="margin: 0 0 16px 0; font-size: 14px; color: #1c1f23;">${closingThanks}</p>
                    <p style="margin: 0; font-size: 14px; color: #1c1f23;">${closingMessage}</p>
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
