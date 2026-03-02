import { createResendClient, getResendFromEmail } from './resend'
import { logApiUsage } from '@/lib/ai/api-tracking'

/**
 * Send approval email to advertiser
 */
export async function sendAdvertiserApprovalEmail(
  advertiserEmail: string,
  advertiserName: string,
  companyName: string,
  accountJustCreated?: boolean,
  passwordResetToken?: string | null
): Promise<boolean> {
  try {
    console.log('[Advertiser Approval Email] Starting email send to:', advertiserEmail)
    const resend = await createResendClient()
    if (!resend) {
      console.error('[Advertiser Approval Email] Resend client not available - API key may be missing or invalid')
      // Log the failure
      await logApiUsage({
        provider: 'resend',
        endpoint: 'emails.send',
        success: false,
        errorMessage: 'Resend API key not configured',
        metadata: { type: 'advertiser_approval', to: advertiserEmail, error: true },
      })
      return false
    }
    console.log('[Advertiser Approval Email] Resend client created, attempting to send email')

    const dashboardUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://www.argufight.com'}/advertiser/dashboard`
    const loginUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://www.argufight.com'}/login`
    const forgotPasswordUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://www.argufight.com'}/forgot-password`
    const resetPasswordUrl = passwordResetToken 
      ? `${process.env.NEXT_PUBLIC_APP_URL || 'https://www.argufight.com'}/reset-password?token=${passwordResetToken}`
      : forgotPasswordUrl

    const fromEmail = await getResendFromEmail()
    console.log('[Advertiser Approval Email] Using from email:', fromEmail)

    const result = await resend.emails.send({
      from: fromEmail,
      to: advertiserEmail,
      subject: 'Your Advertiser Application Has Been Approved!',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Advertiser Application Approved</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0;">🎉 Application Approved!</h1>
          </div>
          
          <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
            <p>Hi ${advertiserName},</p>
            
            <p>Great news! Your advertiser application for <strong>${companyName}</strong> has been approved.</p>
            
            <p>You can now access your advertiser dashboard to:</p>
            <ul>
              <li>Create and manage advertising campaigns</li>
              <li>Connect your Stripe account for payments</li>
              <li>Discover and sponsor creators</li>
              <li>Track your campaign performance</li>
            </ul>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${dashboardUrl}" style="display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                Access Dashboard
              </a>
            </div>
            
            ${accountJustCreated ? `
              <div style="background: #e3f2fd; border-left: 4px solid #2196f3; padding: 15px; margin: 20px 0;">
                <p style="margin: 0; font-weight: bold;">Account Created</p>
                <p style="margin: 5px 0 0 0; font-size: 14px;">
                  We've created a user account for you. Please set your password using the link below:
                </p>
                <div style="text-align: center; margin: 15px 0;">
                  <a href="${resetPasswordUrl}" style="display: inline-block; background: #2196f3; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 14px;">
                    Set Your Password
                  </a>
                </div>
                <p style="margin: 10px 0 0 0; font-size: 12px; color: #666;">
                  Or use the <a href="${forgotPasswordUrl}" style="color: #2196f3;">Forgot Password</a> feature with your email: <strong>${advertiserEmail}</strong>
                </p>
              </div>
            ` : `
              <p style="font-size: 14px; color: #666;">
                If you haven't already, you'll need to <a href="${loginUrl}" style="color: #667eea;">sign in</a> using the email address you provided: <strong>${advertiserEmail}</strong>
              </p>
            `}
            
            <p style="font-size: 14px; color: #666; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd;">
              If you have any questions, please contact our support team.
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
      const errorMessage = result.error.message || 'Failed to send email'
      console.error('[Advertiser Approval Email] Failed to send email:', {
        error: result.error,
        message: errorMessage,
        statusCode: result.error.statusCode,
        name: result.error.name,
        to: advertiserEmail,
      })
      // Log failed email attempt with detailed error
      await logApiUsage({
        provider: 'resend',
        endpoint: 'emails.send',
        success: false,
        errorMessage: errorMessage,
        metadata: { 
          type: 'advertiser_approval', 
          to: advertiserEmail,
          contactName: advertiserName,
          company: companyName,
          error: true,
          errorDetails: result.error,
        },
      })
      return false
    }

    // Log successful email with full metadata
    await logApiUsage({
      provider: 'resend',
      endpoint: 'emails.send',
      success: true,
      metadata: { 
        type: 'advertiser_approval', 
        to: advertiserEmail,
        contactName: advertiserName,
        company: companyName,
        userCreated: accountJustCreated || false,
      },
    })

    console.log(`Approval email sent to ${advertiserEmail}`)
    return true
  } catch (error: any) {
    console.error('Error sending advertiser approval email:', error)
    return false
  }
}

/**
 * Send rejection email to advertiser
 */
export async function sendAdvertiserRejectionEmail(
  advertiserEmail: string,
  advertiserName: string,
  companyName: string,
  reason?: string
): Promise<boolean> {
  try {
    const resend = await createResendClient()
    if (!resend) {
      console.warn('Resend client not available, skipping email notification')
      return false
    }

    const fromEmail = await getResendFromEmail()
    console.log('[Advertiser Rejection Email] Using from email:', fromEmail)

    const result = await resend.emails.send({
      from: fromEmail,
      to: advertiserEmail,
      subject: 'Update on Your Advertiser Application',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Advertiser Application Update</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: #f9f9f9; padding: 30px; border-radius: 10px;">
            <p>Hi ${advertiserName},</p>
            
            <p>Thank you for your interest in advertising with Argu Fight.</p>
            
            <p>Unfortunately, we are unable to approve your advertiser application for <strong>${companyName}</strong> at this time.</p>
            
            ${reason ? `
              <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0;">
                <p style="margin: 0;"><strong>Reason:</strong> ${reason}</p>
              </div>
            ` : ''}
            
            <p>If you have any questions or would like to discuss this decision, please contact our support team.</p>
            
            <p style="margin-top: 30px;">
              Best regards,<br>
              The Argu Fight Team
            </p>
          </div>
        </body>
        </html>
      `,
    })

    if (result.error) {
      const errorMessage = result.error.message || 'Failed to send email'
      console.error('Failed to send advertiser rejection email:', {
        error: result.error,
        message: errorMessage,
        to: advertiserEmail,
      })
      // Log failed email attempt with detailed error
      await logApiUsage({
        provider: 'resend',
        endpoint: 'emails.send',
        success: false,
        errorMessage: errorMessage,
        metadata: { 
          type: 'advertiser_rejection', 
          to: advertiserEmail,
          contactName: advertiserName,
          company: companyName,
          reason: reason || '',
          error: true,
          errorDetails: result.error,
        },
      })
      return false
    }

    // Log successful email with full metadata
    await logApiUsage({
      provider: 'resend',
      endpoint: 'emails.send',
      success: true,
      metadata: { 
        type: 'advertiser_rejection', 
        to: advertiserEmail,
        contactName: advertiserName,
        company: companyName,
        reason: reason || '',
      },
    })

    console.log(`Rejection email sent to ${advertiserEmail}`)
    return true
  } catch (error: any) {
    console.error('Error sending advertiser rejection email:', error)
    return false
  }
}

