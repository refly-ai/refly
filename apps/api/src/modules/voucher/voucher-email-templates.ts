/**
 * Email templates for voucher notifications
 */

export interface VoucherEmailData {
  userName: string;
  discountPercent: number;
  discountValue: string; // e.g., "$8" for 40% off of $20/month
  discountedPrice: string; // e.g., "$12"
  inviteLink: string;
  expirationDays: number;
}

/**
 * Generate English email content for voucher notification
 */
export function generateVoucherEmailEN(data: VoucherEmailData): { subject: string; html: string } {
  const subject = "🎉 You've Earned an Exclusive Refly Discount!";

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>You've Earned an Exclusive Discount!</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f5f5f5;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 24px; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(14, 159, 119, 0.15);">

          <!-- Hero Section -->
          <tr>
            <td style="background: linear-gradient(135deg, #0E9F77 0%, #10b981 50%, #34d399 100%); padding: 48px 40px; text-align: center;">
              <!-- Logo -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 0 auto 24px;">
                <tr>
                  <td style="background-color: rgba(255,255,255,0.2); border-radius: 16px; padding: 12px;">
                    <img src="https://api.refly.ai/v1/drive/file/public/df-eian010yz7r0p7s9t3eh588l" alt="Refly" width="48" height="48" style="display: block;" />
                  </td>
                </tr>
              </table>

              <!-- Badge -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 0 auto 16px;">
                <tr>
                  <td style="background-color: rgba(255,255,255,0.2); border-radius: 50px; padding: 10px 20px;">
                    <span style="color: #ffffff; font-size: 14px; font-weight: 500;">Creator Reward Unlocked</span>
                  </td>
                </tr>
              </table>

              <!-- Title -->
              <h1 style="margin: 0; color: #ffffff; font-size: 32px; font-weight: 700; line-height: 1.2;">
                You've Earned an<br>Exclusive Discount!
              </h1>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding: 48px 40px;">

              <!-- Greeting -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom: 32px;">
                <tr>
                  <td style="text-align: center;">
                    <p style="margin: 0 0 8px; font-size: 20px; color: #1a1a1a;">
                      Hey <span style="font-weight: 600; color: #0E9F77;">${data.userName}</span>!
                    </p>
                    <p style="margin: 0; font-size: 16px; color: #666666; line-height: 1.6; max-width: 440px; margin: 0 auto;">
                      Thank you for publishing your template on Refly.ai! As a token of our appreciation, here's an exclusive discount just for you.
                    </p>
                  </td>
                </tr>
              </table>

              <!-- Discount Card -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f8fafb; border-radius: 16px; border: 1px solid #e5e7eb; margin-bottom: 32px;">
                <tr>
                  <td style="padding: 32px; text-align: center;">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 0 auto 16px;">
                      <tr>
                        <td style="background-color: #d1fae5; border-radius: 50%; padding: 12px;">
                          <span style="font-size: 20px;">🎁</span>
                        </td>
                      </tr>
                    </table>

                    <p style="margin: 0 0 8px; font-size: 12px; color: #888888; text-transform: uppercase; letter-spacing: 1px;">Your Discount</p>
                    <p style="margin: 0 0 24px; font-size: 56px; font-weight: 700; color: #0E9F77;">${data.discountPercent}% OFF</p>

                    <!-- Info Grid -->
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                      <tr>
                        <td width="50%" style="padding: 0 8px;">
                          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #ffffff; border-radius: 12px; border: 1px solid #e5e7eb;">
                            <tr>
                              <td style="padding: 16px; text-align: center;">
                                <span style="font-size: 18px; display: block; margin-bottom: 8px;">⏱️</span>
                                <p style="margin: 0 0 4px; font-size: 11px; color: #888888;">Valid For</p>
                                <p style="margin: 0; font-size: 14px; font-weight: 600; color: #1a1a1a;">${data.expirationDays} Days</p>
                              </td>
                            </tr>
                          </table>
                        </td>
                        <td width="50%" style="padding: 0 8px;">
                          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #ffffff; border-radius: 12px; border: 1px solid #e5e7eb;">
                            <tr>
                              <td style="padding: 16px; text-align: center;">
                                <span style="font-size: 18px; display: block; margin-bottom: 8px;">✅</span>
                                <p style="margin: 0 0 4px; font-size: 11px; color: #888888;">Eligibility</p>
                                <p style="margin: 0; font-size: 14px; font-weight: 600; color: #1a1a1a;">Free Users</p>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>

                    <p style="margin: 24px 0 0; font-size: 14px; color: #666666;">
                      Your discount will be automatically applied at Stripe checkout — get full access for just <span style="font-weight: 700; color: #0E9F77;">${data.discountedPrice}/month</span>
                    </p>
                  </td>
                </tr>
              </table>

              <!-- Share Section -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background: linear-gradient(135deg, rgba(14,159,119,0.1) 0%, rgba(14,159,119,0.05) 100%); border-radius: 16px; border: 1px solid rgba(14,159,119,0.2); margin-bottom: 32px;">
                <tr>
                  <td style="padding: 24px;">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                      <tr>
                        <td width="56" valign="top">
                          <div style="background-color: rgba(14,159,119,0.2); border-radius: 12px; padding: 12px; display: inline-block;">
                            <span style="font-size: 24px;">👥</span>
                          </div>
                        </td>
                        <td style="padding-left: 16px;">
                          <h3 style="margin: 0 0 4px; font-size: 16px; font-weight: 600; color: #1a1a1a;">Share the Love</h3>
                          <p style="margin: 0 0 12px; font-size: 14px; color: #666666;">Your friends can also enjoy this discount!</p>
                          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #ffffff; border-radius: 12px; border: 1px solid #e5e7eb;">
                            <tr>
                              <td style="padding: 12px 16px;">
                                <a href="${data.inviteLink}" style="color: #0E9F77; font-size: 14px; font-weight: 500; text-decoration: none; word-break: break-all;">${data.inviteLink}</a>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Community Section -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="border-top: 1px solid #e5e7eb;">
                <tr>
                  <td style="text-align: center; padding-top: 32px;">
                    <h3 style="margin: 0 0 8px; font-size: 16px; font-weight: 600; color: #1a1a1a;">Join Our Creator Community</h3>
                    <p style="margin: 0 0 20px; font-size: 14px; color: #666666;">
                      Connect with fellow creators for feedback, inspiration, and best practices.
                    </p>

                    <!-- Two columns: WeChat + Discord -->
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                      <tr>
                        <!-- WeChat QR Code -->
                        <td width="50%" style="padding: 0 8px; vertical-align: top;">
                          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f8fafb; border-radius: 12px; border: 1px solid #e5e7eb; height: 200px;">
                            <tr>
                              <td style="padding: 20px; text-align: center; vertical-align: middle;">
                                <p style="margin: 0 0 12px; font-size: 14px; font-weight: 600; color: #1a1a1a;">Follow on WeChat</p>
                                <img src="https://api.refly.ai/v1/drive/file/public/df-h2el23mfac4kyk0r6wintfu7" alt="Refly.ai WeChat" width="100" height="100" style="display: block; margin: 0 auto; border-radius: 8px;" />
                                <p style="margin: 12px 0 0; font-size: 12px; color: #888888;">Scan for latest updates</p>
                              </td>
                            </tr>
                          </table>
                        </td>
                        <!-- Discord -->
                        <td width="50%" style="padding: 0 8px; vertical-align: top;">
                          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f8fafb; border-radius: 12px; border: 1px solid #e5e7eb; height: 200px;">
                            <tr>
                              <td style="padding: 20px; text-align: center; vertical-align: middle;">
                                <p style="margin: 0 0 12px; font-size: 14px; font-weight: 600; color: #1a1a1a;">Join Discord</p>
                                <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 0 auto;">
                                  <tr>
                                    <td style="background-color: #5865f2; border-radius: 12px;">
                                      <a href="https://discord.com/invite/YVuYFjFvRC" style="display: inline-block; padding: 14px 24px; color: #ffffff; font-size: 14px; font-weight: 600; text-decoration: none;">
                                        💬 Join Community
                                      </a>
                                    </td>
                                  </tr>
                                </table>
                                <p style="margin: 12px 0 0; font-size: 12px; color: #888888;">Chat with global creators</p>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Footer Message -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="border-top: 1px solid #e5e7eb; margin-top: 32px;">
                <tr>
                  <td style="text-align: center; padding-top: 32px;">
                    <p style="margin: 0; font-size: 16px; font-weight: 500; color: #1a1a1a;">Happy Creating!</p>
                    <p style="margin: 8px 0 0; font-size: 18px; font-weight: 700; color: #0E9F77;">The Refly.ai Team</p>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Footer Bar -->
          <tr>
            <td style="background-color: #f8fafb; padding: 24px 40px; border-top: 1px solid #e5e7eb;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td style="text-align: center;">
                    <p style="margin: 0 0 8px; font-size: 14px; color: #666666;">
                      <span style="color: #0E9F77; font-weight: 600;">Refly.ai</span> Marketplace
                    </p>
                    <p style="margin: 0; font-size: 12px; color: #888888;">
                      You received this because you published a template on Refly.ai.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, html };
}

/**
 * Generate Chinese email content for voucher notification
 */
export function generateVoucherEmailZH(data: VoucherEmailData): { subject: string; html: string } {
  const subject = '🎉 恭喜！您获得了 Refly.ai 专属折扣';

  const html = `<!DOCTYPE html>
<html lang="zh">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>您获得了专属折扣！</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'PingFang SC', 'Microsoft YaHei', sans-serif;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f5f5f5;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 24px; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(14, 159, 119, 0.15);">

          <!-- Hero Section -->
          <tr>
            <td style="background: linear-gradient(135deg, #0E9F77 0%, #10b981 50%, #34d399 100%); padding: 48px 40px; text-align: center;">
              <!-- Logo -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 0 auto 24px;">
                <tr>
                  <td style="background-color: rgba(255,255,255,0.2); border-radius: 16px; padding: 12px;">
                    <img src="https://api.refly.ai/v1/drive/file/public/df-eian010yz7r0p7s9t3eh588l" alt="Refly.ai" width="48" height="48" style="display: block;" />
                  </td>
                </tr>
              </table>

              <!-- Badge -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 0 auto 16px;">
                <tr>
                  <td style="background-color: rgba(255,255,255,0.2); border-radius: 50px; padding: 10px 20px;">
                    <span style="color: #ffffff; font-size: 14px; font-weight: 500;">创作者奖励已解锁</span>
                  </td>
                </tr>
              </table>

              <!-- Title -->
              <h1 style="margin: 0; color: #ffffff; font-size: 32px; font-weight: 700; line-height: 1.2;">
                恭喜获得<br>专属折扣！
              </h1>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding: 48px 40px;">

              <!-- Greeting -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom: 32px;">
                <tr>
                  <td style="text-align: center;">
                    <p style="margin: 0 0 8px; font-size: 20px; color: #1a1a1a;">
                      <span style="font-weight: 600; color: #0E9F77;">${data.userName}</span>，您好！
                    </p>
                    <p style="margin: 0; font-size: 16px; color: #666666; line-height: 1.6; max-width: 440px; margin: 0 auto;">
                      感谢您在 Refly.ai 上发布模板！为表感谢，这是专属于您的折扣奖励。
                    </p>
                  </td>
                </tr>
              </table>

              <!-- Discount Card -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f8fafb; border-radius: 16px; border: 1px solid #e5e7eb; margin-bottom: 32px;">
                <tr>
                  <td style="padding: 32px; text-align: center;">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 0 auto 16px;">
                      <tr>
                        <td style="background-color: #d1fae5; border-radius: 50%; padding: 12px;">
                          <span style="font-size: 20px;">🎁</span>
                        </td>
                      </tr>
                    </table>

                    <p style="margin: 0 0 8px; font-size: 12px; color: #888888; text-transform: uppercase; letter-spacing: 1px;">您的折扣</p>
                    <p style="margin: 0 0 24px; font-size: 56px; font-weight: 700; color: #0E9F77;">${data.discountPercent}% OFF</p>

                    <!-- Info Grid -->
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                      <tr>
                        <td width="50%" style="padding: 0 8px;">
                          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #ffffff; border-radius: 12px; border: 1px solid #e5e7eb;">
                            <tr>
                              <td style="padding: 16px; text-align: center;">
                                <span style="font-size: 18px; display: block; margin-bottom: 8px;">⏱️</span>
                                <p style="margin: 0 0 4px; font-size: 11px; color: #888888;">有效期</p>
                                <p style="margin: 0; font-size: 14px; font-weight: 600; color: #1a1a1a;">${data.expirationDays} 天</p>
                              </td>
                            </tr>
                          </table>
                        </td>
                        <td width="50%" style="padding: 0 8px;">
                          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #ffffff; border-radius: 12px; border: 1px solid #e5e7eb;">
                            <tr>
                              <td style="padding: 16px; text-align: center;">
                                <span style="font-size: 18px; display: block; margin-bottom: 8px;">✅</span>
                                <p style="margin: 0 0 4px; font-size: 11px; color: #888888;">适用范围</p>
                                <p style="margin: 0; font-size: 14px; font-weight: 600; color: #1a1a1a;">免费用户</p>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>

                    <p style="margin: 24px 0 0; font-size: 14px; color: #666666;">
                      折扣将在 Stripe 结账时自动应用 — 仅需 <span style="font-weight: 700; color: #0E9F77;">${data.discountedPrice}/月</span> 即可获得完整功能
                    </p>
                  </td>
                </tr>
              </table>

              <!-- Share Section -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background: linear-gradient(135deg, rgba(14,159,119,0.1) 0%, rgba(14,159,119,0.05) 100%); border-radius: 16px; border: 1px solid rgba(14,159,119,0.2); margin-bottom: 32px;">
                <tr>
                  <td style="padding: 24px;">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                      <tr>
                        <td width="56" valign="top">
                          <div style="background-color: rgba(14,159,119,0.2); border-radius: 12px; padding: 12px; display: inline-block;">
                            <span style="font-size: 24px;">👥</span>
                          </div>
                        </td>
                        <td style="padding-left: 16px;">
                          <h3 style="margin: 0 0 4px; font-size: 16px; font-weight: 600; color: #1a1a1a;">分享给朋友</h3>
                          <p style="margin: 0 0 12px; font-size: 14px; color: #666666;">您的朋友也可以享受这个折扣！</p>
                          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #ffffff; border-radius: 12px; border: 1px solid #e5e7eb;">
                            <tr>
                              <td style="padding: 12px 16px;">
                                <a href="${data.inviteLink}" style="color: #0E9F77; font-size: 14px; font-weight: 500; text-decoration: none; word-break: break-all;">${data.inviteLink}</a>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Community Section -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="border-top: 1px solid #e5e7eb;">
                <tr>
                  <td style="text-align: center; padding-top: 32px;">
                    <h3 style="margin: 0 0 8px; font-size: 16px; font-weight: 600; color: #1a1a1a;">加入创作者社区</h3>
                    <p style="margin: 0 0 20px; font-size: 14px; color: #666666;">
                      与其他创作者交流，获取反馈、灵感和最佳实践。
                    </p>

                    <!-- Two columns: WeChat + Discord -->
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                      <tr>
                        <!-- WeChat QR Code -->
                        <td width="50%" style="padding: 0 8px; vertical-align: top;">
                          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f8fafb; border-radius: 12px; border: 1px solid #e5e7eb; height: 200px;">
                            <tr>
                              <td style="padding: 20px; text-align: center; vertical-align: middle;">
                                <p style="margin: 0 0 12px; font-size: 14px; font-weight: 600; color: #1a1a1a;">关注微信公众号</p>
                                <img src="https://api.refly.ai/v1/drive/file/public/df-h2el23mfac4kyk0r6wintfu7" alt="Refly.ai 微信公众号" width="100" height="100" style="display: block; margin: 0 auto; border-radius: 8px;" />
                                <p style="margin: 12px 0 0; font-size: 12px; color: #888888;">扫码关注获取最新动态</p>
                              </td>
                            </tr>
                          </table>
                        </td>
                        <!-- Discord -->
                        <td width="50%" style="padding: 0 8px; vertical-align: top;">
                          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f8fafb; border-radius: 12px; border: 1px solid #e5e7eb; height: 200px;">
                            <tr>
                              <td style="padding: 20px; text-align: center; vertical-align: middle;">
                                <p style="margin: 0 0 12px; font-size: 14px; font-weight: 600; color: #1a1a1a;">加入 Discord</p>
                                <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 0 auto;">
                                  <tr>
                                    <td style="background-color: #5865f2; border-radius: 12px;">
                                      <a href="https://discord.com/invite/YVuYFjFvRC" style="display: inline-block; padding: 14px 24px; color: #ffffff; font-size: 14px; font-weight: 600; text-decoration: none;">
                                        💬 加入社区
                                      </a>
                                    </td>
                                  </tr>
                                </table>
                                <p style="margin: 12px 0 0; font-size: 12px; color: #888888;">与全球创作者交流</p>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Footer Message -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="border-top: 1px solid #e5e7eb; margin-top: 32px;">
                <tr>
                  <td style="text-align: center; padding-top: 32px;">
                    <p style="margin: 0; font-size: 16px; font-weight: 500; color: #1a1a1a;">祝您创作愉快！</p>
                    <p style="margin: 8px 0 0; font-size: 18px; font-weight: 700; color: #0E9F77;">Refly.ai 团队</p>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Footer Bar -->
          <tr>
            <td style="background-color: #f8fafb; padding: 24px 40px; border-top: 1px solid #e5e7eb;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td style="text-align: center;">
                    <p style="margin: 0 0 8px; font-size: 14px; color: #666666;">
                      <span style="color: #0E9F77; font-weight: 600;">Refly.ai</span> 模板市场
                    </p>
                    <p style="margin: 0; font-size: 12px; color: #888888;">
                      您收到此邮件是因为您在 Refly.ai 上发布了模板。
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, html };
}

/**
 * Generate email content based on user's locale
 */
export function generateVoucherEmail(
  data: VoucherEmailData,
  locale?: string,
): { subject: string; html: string } {
  // Check if locale is Chinese (zh, zh-CN, zh-Hans, zh-TW, zh-Hant, etc.)
  const isChineseLocale = locale?.toLowerCase().startsWith('zh');

  if (isChineseLocale) {
    return generateVoucherEmailZH(data);
  }

  return generateVoucherEmailEN(data);
}

/**
 * Calculate discount values based on discount percent
 * Assuming base price is $20/month
 */
export function calculateDiscountValues(discountPercent: number): {
  discountValue: string;
  discountedPrice: string;
} {
  const basePrice = 20; // $20/month
  const discountAmount = (basePrice * discountPercent) / 100;
  const discountedPrice = basePrice - discountAmount;

  return {
    discountValue: `$${discountAmount.toFixed(0)}`,
    discountedPrice: `$${discountedPrice.toFixed(0)}`,
  };
}
