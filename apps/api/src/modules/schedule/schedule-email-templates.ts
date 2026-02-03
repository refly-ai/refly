/**
 * Email templates for schedule notifications
 * Designed to be user-friendly, aesthetically pleasing, and premium.
 */

/**
 * Format date/time to 12-hour format: MM/DD/YYYY, HH:MM AM/PM
 * Example: "01/04/2026, 06:35 PM"
 *
 * @param dateTime - Date object or ISO date string to format
 * @param timezone - IANA timezone string (e.g., 'Asia/Shanghai', 'America/New_York')
 *                   Defaults to 'Asia/Shanghai' if not provided
 */
export function formatDateTime(dateTime: string | Date, timezone = 'Asia/Shanghai'): string {
  const date = typeof dateTime === 'string' ? new Date(dateTime) : dateTime;

  try {
    // Use Intl.DateTimeFormat for timezone-aware formatting
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });

    const parts = formatter.formatToParts(date);
    const getPart = (type: string) => parts.find((p) => p.type === type)?.value || '';

    const month = getPart('month');
    const day = getPart('day');
    const year = getPart('year');
    const hour = getPart('hour');
    const minute = getPart('minute');
    const dayPeriod = getPart('dayPeriod').toUpperCase();

    return `${month}/${day}/${year}, ${hour}:${minute} ${dayPeriod}`;
  } catch {
    // Fallback to local time if timezone is invalid
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const year = date.getFullYear();

    let hours = date.getHours();
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';

    hours = hours % 12;
    hours = hours ? hours : 12;
    const hoursStr = String(hours).padStart(2, '0');

    return `${month}/${day}/${year}, ${hoursStr}:${minutes} ${ampm}`;
  }
}

// Common styles for consistency and premium look
const STYLES = {
  body: "margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #F4F6F8; line-height: 1.6; color: #1C2024;",
  container:
    'width: 100%; max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; border: 1px solid #E4E5E7; box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08); overflow: hidden;',
  header: 'padding: 32px 32px 0 32px; text-align: left;',
  logo: 'font-size: 20px; font-weight: 700; color: #000000; text-decoration: none;', // Placeholder for logo if needed
  content: 'padding: 40px 32px; text-align: left;',
  greeting:
    'font-size: 20px; font-weight: 600; color: #1C2024; margin: 0 0 24px 0; text-align: left;',
  paragraph:
    'font-size: 15px; color: #3A4248; margin: 0 0 20px 0; line-height: 1.6; text-align: left;',
  list: 'font-size: 15px; color: #3A4248; margin: 0 0 24px 0; padding-left: 24px; text-align: left; list-style-type: disc;',
  listItem: 'margin-bottom: 12px; line-height: 1.6; text-align: left;',
  sectionTitle:
    'font-size: 13px; font-weight: 700; text-transform: uppercase; color: #6C7278; letter-spacing: 0.08em; margin: 32px 0 16px 0; text-align: left;',
  card: 'background-color: #F9FAFB; border: 1px solid #EFF1F3; border-radius: 8px; padding: 20px; margin-bottom: 24px;',
  cardRow: 'display: flex; justify-content: space-between; margin-bottom: 8px;',
  cardLabel: 'font-size: 13px; color: #6C7278;',
  cardValue: 'font-size: 13px; font-weight: 500; color: #1C2024; margin-left: auto;',
  buttonContainer: 'margin-top: 36px; text-align: center;',
  button:
    'display: inline-block; background: linear-gradient(135deg, #0e9f77 0%, #0c8a67 100%); color: #ffffff; padding: 14px 32px; border-radius: 8px; font-size: 15px; font-weight: 600; text-decoration: none; box-shadow: 0 2px 8px rgba(14, 159, 119, 0.25); transition: all 0.2s ease;',
  buttonHoverHint:
    'mso-hide: all; font-size: 11px; color: #8C9196; margin-top: 8px; text-align: center;',
  footer:
    'padding: 28px 32px; background-color: #F9FAFB; border-top: 1px solid #EFF1F3; text-align: center;',
  footerText: 'font-size: 12px; color: #8C9196; margin: 0 0 6px 0; line-height: 1.5;',
  footerLink: 'color: #8C9196; text-decoration: underline;',
};

// Helper to generate the full HTML wrapper
function wrapEmail(subject: string, content: string): string {
  return `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="X-UA-Compatible" content="IE=edge">
        <meta name="x-apple-disable-message-reformatting">
        <title>${subject}</title>
        <style type="text/css">
          @media only screen and (max-width: 600px) {
            .container {
              width: 100% !important;
              max-width: 100% !important;
            }
            .content {
              padding: 24px 20px !important;
            }
            .button {
              padding: 12px 24px !important;
              font-size: 14px !important;
            }
          }
        </style>
      </head>
      <body style="${STYLES.body}">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width: 100%; border-collapse: collapse; background-color: #F4F6F8;">
          <tr>
            <td align="center" style="padding: 40px 20px;">
              <!--[if mso | IE]>
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="600">
                <tr>
                  <td style="width: 600px;">
              <![endif]-->
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" class="container" style="${STYLES.container}">
                <!-- Content -->
                <tr>
                  <td class="content" style="${STYLES.content}">
                    ${content}
                  </td>
                </tr>
                <!-- Footer -->
                <tr>
                  <td style="${STYLES.footer}">
                    <p style="${STYLES.footerText}">— The Refly.AI Team</p>
                    <p style="${STYLES.footerText}">
                      &copy; ${new Date().getFullYear()} Refly.AI. All rights reserved.
                    </p>
                  </td>
                </tr>
              </table>
              <!--[if mso | IE]>
                  </td>
                </tr>
              </table>
              <![endif]-->
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;
}

interface ScheduleEmailCommonData {
  userName: string;
  scheduleName: string;
  schedulesLink: string;
}

// 1. Limit Exceeded
export interface LimitExceededData extends ScheduleEmailCommonData {
  limit: number;
  currentCount: number;
}

export function generateLimitExceededEmail(data: LimitExceededData): {
  subject: string;
  html: string;
} {
  const subject = 'Your scheduled workflow has been paused';
  const html = wrapEmail(
    subject,
    `
    <h1 style="${STYLES.greeting}">Hi ${data.userName},</h1>
    <p style="${STYLES.paragraph}">
      Your scheduled workflow <strong>"${data.scheduleName}"</strong> has been paused because you've reached the maximum number of active schedules allowed for your current plan.
    </p>

    <div style="${STYLES.sectionTitle}">What happened</div>
    <ul style="${STYLES.list}">
      <li style="${STYLES.listItem}">Your plan allows up to ${data.limit} active scheduled workflows</li>
      <li style="${STYLES.listItem}">You currently have ${data.currentCount} active schedules</li>
    </ul>

    <p style="${STYLES.paragraph}">
      As a result, this schedule has been temporarily stopped and will not run until the issue is resolved.
    </p>

    <div style="${STYLES.sectionTitle}">What you can do</div>
    <ul style="${STYLES.list}">
      <li style="${STYLES.listItem}">Disable or delete an existing schedule from your Schedules page</li>
      <li style="${STYLES.listItem}">Or upgrade your plan to unlock more scheduled workflows</li>
    </ul>

    <p style="${STYLES.paragraph}">
      Once the number of active schedules is back within your plan limit, this schedule will automatically resume.
    </p>

    <p style="${STYLES.paragraph}">
      View and manage your schedules:
    </p>

    <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%; margin-top: 36px;">
      <tr>
        <td align="center">
          <a href="${data.schedulesLink}" style="${STYLES.button}" target="_blank">View Schedule Workflow</a>
        </td>
      </tr>
    </table>
  `,
  );
  return { subject, html };
}

// 2. Insufficient Credits
export interface InsufficientCreditsData extends ScheduleEmailCommonData {
  nextRunTime?: string; // Formatted date string
  currentBalance: number;
}

export function generateInsufficientCreditsEmail(data: InsufficientCreditsData): {
  subject: string;
  html: string;
} {
  const subject = "Your scheduled workflow couldn't run due to insufficient credits";
  const html = wrapEmail(
    subject,
    `
    <h1 style="${STYLES.greeting}">Hi ${data.userName},</h1>
    <p style="${STYLES.paragraph}">
      Your scheduled workflow <strong>"${data.scheduleName}"</strong> was unable to run because your account doesn't have enough credits.
    </p>

    <div style="${STYLES.sectionTitle}">What happened</div>
    <ul style="${STYLES.list}">
      <li style="${STYLES.listItem}">The workflow requires credits to execute</li>
      <li style="${STYLES.listItem}">Your current credit balance is insufficient</li>
      <li style="${STYLES.listItem}">Next Scheduled Run: ${data.nextRunTime || 'N/A'} (This will only trigger if credits are available)</li>
    </ul>

    <p style="${STYLES.paragraph}">
      This schedule has been temporarily paused and will not run until your credits are replenished.
    </p>

    <p style="${STYLES.paragraph}">
      Once your credit balance is restored, the schedule will automatically resume and continue running as planned.
    </p>

    <p style="${STYLES.paragraph}">
      View and manage your schedules:
    </p>

    <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%; margin-top: 36px;">
      <tr>
        <td align="center">
          <a href="${data.schedulesLink}" style="${STYLES.button}" target="_blank">View Run Detail</a>
        </td>
      </tr>
    </table>
  `,
  );
  return { subject, html };
}

// 3. Success
export interface ScheduleSuccessData extends ScheduleEmailCommonData {
  scheduledAt: string;
  nextRunTime: string;
  runDetailsLink: string;
}

export function generateScheduleSuccessEmail(data: ScheduleSuccessData): {
  subject: string;
  html: string;
} {
  const subject = 'Scheduled workflow Succeeded successfully';
  const html = wrapEmail(
    subject,
    `
    <h1 style="${STYLES.greeting}">Hi ${data.userName},</h1>
    <p style="${STYLES.paragraph}">
      Your scheduled workflow <strong>"${data.scheduleName}"</strong> ran successfully.
    </p>

    <div style="${STYLES.sectionTitle}">Run details</div>
    <ul style="${STYLES.list}">
      <li style="${STYLES.listItem}">Status: <span style="color: #12B76A;">Succeeded</span></li>
      <li style="${STYLES.listItem}">Run time: ${data.scheduledAt}</li>
      <li style="${STYLES.listItem}">Next scheduled run: ${data.nextRunTime}</li>
    </ul>

    <p style="${STYLES.paragraph}">
      You can view the full run details and results here:
    </p>

    <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%; margin-top: 36px;">
      <tr>
        <td align="center">
          <a href="${data.runDetailsLink}" style="${STYLES.button}" target="_blank">View Run Detail</a>
        </td>
      </tr>
    </table>
  `,
  );
  return { subject, html };
}

// 4. Failure
export interface ScheduleFailedData extends ScheduleEmailCommonData {
  scheduledAt: string;
  nextRunTime: string;
  runDetailsLink: string;
}

export function generateScheduleFailedEmail(data: ScheduleFailedData): {
  subject: string;
  html: string;
} {
  const subject = 'Scheduled workflow failed to run';
  const html = wrapEmail(
    subject,
    `
    <h1 style="${STYLES.greeting}">Hi ${data.userName},</h1>
    <p style="${STYLES.paragraph}">
      Your scheduled workflow <strong>"${data.scheduleName}"</strong> failed during its most recent run.
    </p>

    <div style="${STYLES.sectionTitle}">Run details</div>
    <ul style="${STYLES.list}">
      <li style="${STYLES.listItem}">Status: <span style="color: #F04438;">Failed</span></li>
      <li style="${STYLES.listItem}">Run time: ${data.scheduledAt}</li>
      <li style="${STYLES.listItem}">Next scheduled run: ${data.nextRunTime}</li>
    </ul>

    <p style="${STYLES.paragraph}">
      The schedule itself is still active and will attempt to run again at the next scheduled time.
    </p>

    <p style="${STYLES.paragraph}">
      You can review the failure details and troubleshoot the workflow here:
    </p>

    <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%; margin-top: 36px;">
      <tr>
        <td align="center">
          <a href="${data.runDetailsLink}" style="${STYLES.button}" target="_blank">View Run Detail</a>
        </td>
      </tr>
    </table>
  `,
  );
  return { subject, html };
}
