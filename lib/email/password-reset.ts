import { createResendClient, getResendFromEmail } from './resend'
import { logApiUsage } from '@/lib/ai/api-tracking'

/**
 * Send password reset email
 */
export async function sendPasswordResetEmail(
  userEmail: string,
  resetToken: string
): Promise<boolean> {
  try {
    console.log('[Password Reset Email] Starting email send to:', userEmail)
    const resend = await createResendClient()
    if (!resend) {
      console.error('[Password Reset Email] Resend client not available - API key may be missing or invalid')
      await logApiUsage({
        provider: 'resend',
        endpoint: 'emails.send',
        success: false,
        errorMessage: 'Resend API key not configured',
        metadata: { type: 'password_reset', to: userEmail, error: true },
      })
      return false
    }
    console.log('[Password Reset Email] Resend client created, attempting to send email')

    // Determine app URL - force localhost in development
    let appUrl = process.env.NEXT_PUBLIC_APP_URL
    
    // If NEXT_PUBLIC_APP_URL is not set, or if we're running locally, use localhost
    if (!appUrl || appUrl.includes('localhost') || appUrl.includes('127.0.0.1')) {
      appUrl = 'http://localhost:3000'
    } else if (process.env.NODE_ENV === 'development') {
      appUrl = 'http://localhost:3000'
    }
    
    // If still not set, default to production
    if (!appUrl) {
      appUrl = 'https://www.argufight.com'
    }
    
    const resetPasswordUrl = `${appUrl}/reset-password?token=${resetToken}`
    const loginUrl = `${appUrl}/login`
    
    console.log('[Password Reset Email] NODE_ENV:', process.env.NODE_ENV)
    console.log('[Password Reset Email] NEXT_PUBLIC_APP_URL:', process.env.NEXT_PUBLIC_APP_URL)
    console.log('[Password Reset Email] Using app URL:', appUrl)
    console.log('[Password Reset Email] Reset password URL:', resetPasswordUrl)

    const fromEmail = await getResendFromEmail()
    console.log('[Password Reset Email] Using from email:', fromEmail)

    console.log('[Password Reset Email] Sending email:', {
      from: fromEmail,
      to: userEmail,
      resetUrl: resetPasswordUrl,
    })

    const result = await resend.emails.send({
      from: fromEmail,
      to: userEmail,
      subject: 'Reset Your Password - Argu Fight',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Reset Your Password</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0;">Reset Your Password</h1>
          </div>
          
          <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
            <p>Hello,</p>
            
            <p>We received a request to reset your password for your Argu Fight account.</p>
            
            <p>Click the button below to reset your password:</p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetPasswordUrl}" style="display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                Reset Password
              </a>
            </div>
            
            <p style="font-size: 14px; color: #666;">
              Or copy and paste this link into your browser:<br>
              <a href="${resetPasswordUrl}" style="color: #667eea; word-break: break-all;">${resetPasswordUrl}</a>
            </p>
            
            <p style="font-size: 14px; color: #666;">
              <strong>This link will expire in 1 hour.</strong>
            </p>
            
            <p style="font-size: 14px; color: #666;">
              If you didn't request a password reset, you can safely ignore this email. Your password will not be changed.
            </p>
            
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
      console.error('[Password Reset Email] Failed to send email:', {
        error: result.error,
        message: errorMessage,
        statusCode: result.error.statusCode,
        name: result.error.name,
        to: userEmail,
      })
      await logApiUsage({
        provider: 'resend',
        endpoint: 'emails.send',
        success: false,
        errorMessage: errorMessage,
        metadata: { 
          type: 'password_reset', 
          to: userEmail,
          error: true,
          errorDetails: result.error,
        },
      })
      return false
    }

    await logApiUsage({
      provider: 'resend',
      endpoint: 'emails.send',
      success: true,
      metadata: { 
        type: 'password_reset', 
        to: userEmail,
      },
    })

    console.log(`[Password Reset Email] ✅ Email sent successfully to ${userEmail}`)
    console.log(`[Password Reset Email] Email ID: ${result.data?.id || 'N/A'}`)
    return true
  } catch (error: any) {
    console.error('[Password Reset Email] Error:', error)
    return false
  }
}
