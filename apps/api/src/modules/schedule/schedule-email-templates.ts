/**
 * Email templates for schedule notifications
 * Designed to be user-friendly, aesthetically pleasing, and premium.
 */

// Common styles for consistency and premium look
const STYLES = {
  body: "margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #F4F6F8; line-height: 1.6; color: #1C2024;",
  container:
    'width: 100%; max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; border: 1px solid #E4E5E7; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05); overflow: hidden;',
  header: 'padding: 32px 32px 0 32px; text-align: left;',
  logo: 'font-size: 20px; font-weight: 700; color: #000000; text-decoration: none;', // Placeholder for logo if needed
  content: 'padding: 32px;',
  greeting: 'font-size: 18px; font-weight: 600; color: #1C2024; margin-bottom: 24px;',
  paragraph: 'font-size: 15px; color: #3A4248; margin-bottom: 16px; line-height: 1.6;',
  list: 'font-size: 15px; color: #3A4248; margin-bottom: 24px; padding-left: 20px;',
  listItem: 'margin-bottom: 8px;',
  sectionTitle:
    'font-size: 14px; font-weight: 600; text-transform: uppercase; color: #6C7278; letter-spacing: 0.05em; margin-bottom: 12px; margin-top: 32px;',
  card: 'background-color: #F9FAFB; border: 1px solid #EFF1F3; border-radius: 8px; padding: 16px; margin-bottom: 24px;',
  cardRow: 'display: flex; justify-content: space-between; margin-bottom: 8px;',
  cardLabel: 'font-size: 13px; color: #6C7278;',
  cardValue: 'font-size: 13px; font-weight: 500; color: #1C2024; margin-left: auto;',
  buttonContainer: 'margin-top: 32px; text-align: left;',
  button:
    'display: inline-block; background-color: #0e9f77; color: #ffffff; padding: 12px 24px; border-radius: 6px; font-size: 14px; font-weight: 600; text-decoration: none; transition: background-color 0.2s;',
  footer:
    'padding: 24px 32px; background-color: #F9FAFB; border-top: 1px solid #EFF1F3; text-align: center;',
  footerText: 'font-size: 12px; color: #8C9196; margin-bottom: 8px;',
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
        <title>${subject}</title>
      </head>
      <body style="${STYLES.body}">
        <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #F4F6F8; padding: 40px 0;">
          <tr>
            <td align="center" style="padding: 40px 0;">
              <div style="${STYLES.container}">
                <!-- Content -->
                <div style="${STYLES.content}">
                  ${content}
                </div>
                <!-- Footer -->
                <div style="${STYLES.footer}">
                  <p style="${STYLES.footerText}">— The Refly.AI Team</p>
                  <p style="${STYLES.footerText}">
                    &copy; ${new Date().getFullYear()} Refly.AI. All rights reserved.
                  </p>
                </div>
              </div>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;
}

export interface ScheduleEmailCommonData {
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
      Your scheduled workflow <strong>“${data.scheduleName}”</strong> has been temporarily paused because you’ve reached the maximum number of active schedules allowed for your current plan.
    </p>
    
    <div style="${STYLES.card}">
       <table role="presentation" style="width: 100%;">
        <tr>
          <td style="${STYLES.cardLabel}">Your Plan Limit</td>
          <td align="right" style="${STYLES.cardValue}">${data.limit} active schedules</td>
        </tr>
        <tr>
          <td style="${STYLES.cardLabel}">Current Active</td>
          <td align="right" style="${STYLES.cardValue}">${data.currentCount} active schedules</td>
        </tr>
      </table>
    </div>

    <p style="${STYLES.paragraph}">
      As a result, this schedule has been stopped and will not run until the issue is resolved.
    </p>

    <div style="${STYLES.sectionTitle}">What you can do</div>
    <ul style="${STYLES.list}">
      <li style="${STYLES.listItem}">Disable or delete an existing schedule to free up a slot</li>
      <li style="${STYLES.listItem}">Upgrade your plan to unlock more scheduled workflows</li>
    </ul>

    <p style="${STYLES.paragraph}">
      Once your active schedule count is within your plan's limit, this schedule will automatically resume.
    </p>

    <div style="${STYLES.buttonContainer}">
      <a href="${data.schedulesLink}" style="${STYLES.button}">Manage My Schedules</a>
    </div>
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
  const subject = 'Your scheduled workflow couldn’t run due to insufficient credits';
  const html = wrapEmail(
    subject,
    `
    <h1 style="${STYLES.greeting}">Hi ${data.userName},</h1>
    <p style="${STYLES.paragraph}">
      Your scheduled workflow <strong>"${data.scheduleName}"</strong> was unable to run because your account doesn't have enough credits.
    </p>

    <div style="${STYLES.card}">
      <table role="presentation" style="width: 100%;">
        <tr>
          <td style="${STYLES.cardLabel}">What happened</td>
          <td align="right" style="${STYLES.cardValue}">The workflow requires credits to execute</td>
        </tr>
        <tr>
          <td style="${STYLES.cardLabel}">Current Balance</td>
          <td align="right" style="${STYLES.cardValue}">${data.currentBalance} credits</td>
        </tr>
        ${
          data.nextRunTime
            ? `<tr>
          <td style="${STYLES.cardLabel}">Next Scheduled Run</td>
          <td align="right" style="${STYLES.cardValue}">${data.nextRunTime}</td>
        </tr>`
            : ''
        }
      </table>
    </div>

    <p style="${STYLES.paragraph}">
      This schedule has been temporarily paused and will not run until your credits are replenished. Once your credit balance is restored, the schedule will automatically resume and continue running as planned.
    </p>

    <div style="${STYLES.buttonContainer}">
      <a href="${data.schedulesLink}" style="${STYLES.button}">View Workflow</a>
    </div>
  `,
  );
  return { subject, html };
}

// 3. Success
export interface ScheduleSuccessData extends ScheduleEmailCommonData {
  runTime: string;
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
      Great news! Your scheduled workflow <strong>“${data.scheduleName}”</strong> ran successfully.
    </p>

    <div style="${STYLES.card}">
      <table role="presentation" style="width: 100%;">
        <tr>
          <td style="${STYLES.cardLabel}">Status</td>
          <td align="right" style="${STYLES.cardValue}"><span style="color: #12B76A;">Succeeded</span></td>
        </tr>
        <tr>
          <td style="${STYLES.cardLabel}">Run Time</td>
          <td align="right" style="${STYLES.cardValue}">${data.runTime}</td>
        </tr>
        <tr>
          <td style="${STYLES.cardLabel}">Next Run</td>
          <td align="right" style="${STYLES.cardValue}">${data.nextRunTime}</td>
        </tr>
      </table>
    </div>

    <p style="${STYLES.paragraph}">
      You can view the full run details and results below.
    </p>

    <div style="${STYLES.buttonContainer}">
      <a href="${data.runDetailsLink}" style="${STYLES.button}">View Run Details</a>
    </div>
  `,
  );
  return { subject, html };
}

// 4. Failure
export interface ScheduleFailedData extends ScheduleEmailCommonData {
  runTime: string;
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
      Your scheduled workflow <strong>“${data.scheduleName}”</strong> failed during its most recent run.
    </p>

    <div style="${STYLES.card}">
      <table role="presentation" style="width: 100%;">
        <tr>
          <td style="${STYLES.cardLabel}">Status</td>
          <td align="right" style="${STYLES.cardValue}"><span style="color: #F04438;">Failed</span></td>
        </tr>
        <tr>
          <td style="${STYLES.cardLabel}">Run Time</td>
          <td align="right" style="${STYLES.cardValue}">${data.runTime}</td>
        </tr>
         <tr>
          <td style="${STYLES.cardLabel}">Next Run</td>
          <td align="right" style="${STYLES.cardValue}">${data.nextRunTime}</td>
        </tr>
      </table>
    </div>

    <p style="${STYLES.paragraph}">
      The schedule itself is still active and will attempt to run again at the next scheduled time.
    </p>

    <div style="${STYLES.buttonContainer}">
      <a href="${data.runDetailsLink}" style="${STYLES.button}">Troubleshoot Issue</a>
    </div>
  `,
  );
  return { subject, html };
}
