import { createResendClient, getResendFromEmail } from './resend'
import { logApiUsage } from '@/lib/ai/api-tracking'

/**
 * Send subscription activation email to user
 */
export async function sendSubscriptionActivatedEmail(
  userEmail: string,
  username: string,
  tier: string,
  billingCycle: string | null,
  periodEnd: Date | null
): Promise<boolean> {
  try {
    const resend = await createResendClient()
    if (!resend) {
      console.warn('Resend client not available, skipping email notification')
      return false
    }

    const dashboardUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://www.argufight.com'}`
    const billingText = billingCycle === 'MONTHLY' ? 'monthly' : billingCycle === 'YEARLY' ? 'yearly' : ''
    const periodEndText = periodEnd ? new Date(periodEnd).toLocaleDateString() : ''

    const fromEmail = await getResendFromEmail()
    console.log('[Subscription Email] Using from email:', fromEmail)

    const result = await resend.emails.send({
      from: fromEmail,
      to: userEmail,
      subject: '🎉 Welcome to Argu Fight Pro!',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Welcome to Pro</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0;">🎉 Welcome to Pro!</h1>
          </div>
          
          <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
            <p>Hi ${username},</p>
            
            <p>Great news! Your <strong>Argu Fight Pro</strong> subscription is now active.</p>
            
            <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #667eea;">
              <h3 style="margin-top: 0; color: #667eea;">Your Subscription Details</h3>
              <p style="margin: 8px 0;"><strong>Plan:</strong> Pro ${billingText ? `(${billingText})` : ''}</p>
              ${periodEnd ? `<p style="margin: 8px 0;"><strong>Next billing date:</strong> ${periodEndText}</p>` : ''}
              <p style="margin: 8px 0;"><strong>Status:</strong> Active</p>
            </div>
            
            <p>You now have access to all Pro features including:</p>
            <ul>
              <li>Unlimited speed debates</li>
              <li>Priority matchmaking</li>
              <li>Advanced analytics and performance dashboard</li>
              <li>12 appeals per month (vs 4 for free users)</li>
              <li>Unlimited "That's The One" votes</li>
              <li>Tournament credits and early access</li>
              <li>Custom profile themes</li>
              <li>No ads</li>
            </ul>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${dashboardUrl}" style="display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                Go to Dashboard
              </a>
            </div>
            
            <p style="font-size: 14px; color: #666;">
              You can manage your subscription anytime in your <a href="${dashboardUrl}/settings/subscription" style="color: #667eea;">account settings</a>.
            </p>
            
            <p style="font-size: 14px; color: #666; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd;">
              ${billingCycle === 'MONTHLY' || billingCycle === 'YEARLY' 
                ? `Your subscription will automatically renew ${billingCycle === 'MONTHLY' ? 'monthly' : 'yearly'}. You can cancel anytime from your account settings.`
                : ''}
            </p>
            
            <p style="margin-top: 20px;">
              Best regards,<br>
              The Argu Fight Team
            </p>
          </div>
        </body>
        </html>
      `,
    })

    if (result.error) {
      console.error('Failed to send subscription activation email:', result.error)
      // Log failed email attempt
      await logApiUsage({
        provider: 'resend',
        endpoint: 'emails.send',
        success: false,
        errorMessage: result.error.message || 'Failed to send email',
        metadata: { type: 'subscription_activation', to: userEmail, error: true },
      })
      return false
    }

    // Log successful email
    await logApiUsage({
      provider: 'resend',
      endpoint: 'emails.send',
      success: true,
      metadata: { type: 'subscription_activation', to: userEmail },
    })

    console.log(`Subscription activation email sent to ${userEmail}`)
    return true
  } catch (error: any) {
    console.error('Error sending subscription activation email:', error)
    return false
  }
}

