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
  const subject = "🎉 Congrats! You've Received an Exclusive Refly Discount";

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Refly Discount</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 24px;">🎉 Congratulations!</h1>
  </div>

  <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px;">
    <p style="font-size: 16px;">Hi ${data.userName},</p>

    <p style="font-size: 16px;">Thank you for publishing your template on Refly! You've unlocked an exclusive discount reward 🎁 — our way of appreciating your contribution of high-quality templates to the Marketplace.</p>

    <div style="background: white; border-radius: 10px; padding: 20px; margin: 20px 0; border-left: 4px solid #667eea;">
      <h2 style="color: #667eea; margin-top: 0;">⭐ Your Exclusive Discount</h2>
      <ul style="list-style: none; padding: 0; margin: 0;">
        <li style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Discount Amount:</strong> ${data.discountValue} (${data.discountPercent}% off)</li>
        <li style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Valid For:</strong> ${data.expirationDays} days</li>
        <li style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Eligibility:</strong> This discount is available only to Free users</li>
        <li style="padding: 8px 0;"><strong>How to Use:</strong> Enter your discount code on the Stripe checkout page to enjoy the discounted price — get full access for just <strong>${data.discountedPrice}/month</strong></li>
      </ul>
    </div>

    <p style="font-size: 16px;">You can also share this discount with your friends:</p>
    <p style="text-align: center; margin: 20px 0;">
      <a href="${data.inviteLink}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 25px; font-weight: bold;">👉 Share Invite Link</a>
    </p>

    <div style="background: #f0f9ff; border-radius: 10px; padding: 20px; margin: 20px 0;">
      <h3 style="color: #0369a1; margin-top: 0;">💬 Join Our Creator Community</h3>
      <p style="margin-bottom: 10px;">Want feedback, inspiration, or workflow best practices from other creators? Come join our Discord community — we'd love to have you there!</p>
      <p style="margin: 0;">
        <a href="https://discord.com/invite/YVuYFjFvRC" style="color: #667eea; font-weight: bold;">👉 Join Discord</a>
      </p>
    </div>

    <p style="font-size: 16px;">If you have any questions or need assistance, feel free to reach out to the Refly team anytime.</p>

    <p style="font-size: 16px;">Happy creating!</p>
    <p style="font-size: 16px; font-weight: bold;">Refly Team</p>
  </div>

  <div style="text-align: center; padding: 20px; color: #666; font-size: 12px;">
    <p>© ${new Date().getFullYear()} Refly. All rights reserved.</p>
  </div>
</body>
</html>
  `.trim();

  return { subject, html };
}

/**
 * Generate Chinese email content for voucher notification
 */
export function generateVoucherEmailZH(data: VoucherEmailData): { subject: string; html: string } {
  const subject = '🎉 恭喜！您获得了 Refly 专属折扣';

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>您的 Refly 折扣</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'PingFang SC', 'Microsoft YaHei', sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 24px;">🎉 恭喜！</h1>
  </div>

  <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px;">
    <p style="font-size: 16px;">${data.userName}，您好！</p>

    <p style="font-size: 16px;">感谢您在 Refly 上发布模板！您已解锁专属折扣奖励 🎁 — 这是我们对您为模板市场贡献优质模板的感谢。</p>

    <div style="background: white; border-radius: 10px; padding: 20px; margin: 20px 0; border-left: 4px solid #667eea;">
      <h2 style="color: #667eea; margin-top: 0;">⭐ 您的专属折扣</h2>
      <ul style="list-style: none; padding: 0; margin: 0;">
        <li style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>折扣金额：</strong>${data.discountValue}（${data.discountPercent}% 折扣）</li>
        <li style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>有效期：</strong>${data.expirationDays} 天</li>
        <li style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>适用范围：</strong>此折扣仅适用于免费用户</li>
        <li style="padding: 8px 0;"><strong>使用方式：</strong>在 Stripe 结账页面输入您的折扣码即可享受优惠价格 — 仅需 <strong>${data.discountedPrice}/月</strong> 即可获得完整功能</li>
      </ul>
    </div>

    <p style="font-size: 16px;">您也可以将此折扣分享给朋友：</p>
    <p style="text-align: center; margin: 20px 0;">
      <a href="${data.inviteLink}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 25px; font-weight: bold;">👉 分享邀请链接</a>
    </p>

    <div style="background: #f0f9ff; border-radius: 10px; padding: 20px; margin: 20px 0;">
      <h3 style="color: #0369a1; margin-top: 0;">💬 加入创作者社区</h3>
      <p style="margin-bottom: 10px;">想要获得反馈、灵感或其他创作者的工作流最佳实践？欢迎加入我们的 Discord 社区！</p>
      <p style="margin: 0;">
        <a href="https://discord.com/invite/YVuYFjFvRC" style="color: #667eea; font-weight: bold;">👉 加入 Discord</a>
      </p>
    </div>

    <p style="font-size: 16px;">如有任何问题或需要帮助，请随时联系 Refly 团队。</p>

    <p style="font-size: 16px;">祝您创作愉快！</p>
    <p style="font-size: 16px; font-weight: bold;">Refly 团队</p>
  </div>

  <div style="text-align: center; padding: 20px; color: #666; font-size: 12px;">
    <p>© ${new Date().getFullYear()} Refly. 保留所有权利。</p>
  </div>
</body>
</html>
  `.trim();

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
