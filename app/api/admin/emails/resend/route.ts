import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/auth/session-utils'
import { prisma } from '@/lib/db/prisma'
import { sendAdvertiserApprovalEmail, sendAdvertiserRejectionEmail } from '@/lib/email/advertiser-notifications'
import { logApiUsage } from '@/lib/ai/api-tracking'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const userId = await verifyAdmin()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { recordId, emailType, to, metadata } = body

    if (!emailType || !to) {
      return NextResponse.json(
        { error: 'Email type and recipient are required' },
        { status: 400 }
      )
    }

    // Get the original record to understand context
    const originalRecord = await prisma.apiUsage.findUnique({
      where: { id: recordId },
    })

    if (!originalRecord) {
      return NextResponse.json(
        { error: 'Original email record not found' },
        { status: 404 }
      )
    }

    let emailSent = false

    // Normalize email type for comparison (handle both formats)
    const normalizedType = emailType.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
    console.log('[API /admin/emails/resend] Email type:', emailType, '→ normalized:', normalizedType)

    // Resend based on email type
    if (normalizedType === 'advertiser_approval' || normalizedType.includes('approval')) {
      console.log('[API /admin/emails/resend] Sending approval email to:', to)
      
      // Try to get advertiser data from database if metadata is missing
      let contactName = metadata?.contactName
      let companyName = metadata?.company || metadata?.companyName
      
      if (!contactName || !companyName) {
        console.log('[API /admin/emails/resend] Missing metadata, fetching from database...')
        try {
          const advertiser = await prisma.advertiser.findUnique({
            where: { contactEmail: to },
            select: { contactName: true, companyName: true },
          })
          if (advertiser) {
            contactName = contactName || advertiser.contactName
            companyName = companyName || advertiser.companyName
            console.log('[API /admin/emails/resend] Found advertiser:', { contactName, companyName })
          }
        } catch (dbError) {
          console.error('[API /admin/emails/resend] Failed to fetch advertiser from DB:', dbError)
        }
      }
      
      emailSent = await sendAdvertiserApprovalEmail(
        to,
        contactName || 'Advertiser',
        companyName || 'Company',
        metadata?.userCreated || false
      )
    } else if (normalizedType === 'advertiser_rejection' || normalizedType.includes('rejection')) {
      console.log('[API /admin/emails/resend] Sending rejection email to:', to)
      
      // Try to get advertiser data from database if metadata is missing
      let contactName = metadata?.contactName
      let companyName = metadata?.company || metadata?.companyName
      
      if (!contactName || !companyName) {
        console.log('[API /admin/emails/resend] Missing metadata, fetching from database...')
        try {
          const advertiser = await prisma.advertiser.findUnique({
            where: { contactEmail: to },
            select: { contactName: true, companyName: true },
          })
          if (advertiser) {
            contactName = contactName || advertiser.contactName
            companyName = companyName || advertiser.companyName
            console.log('[API /admin/emails/resend] Found advertiser:', { contactName, companyName })
          }
        } catch (dbError) {
          console.error('[API /admin/emails/resend] Failed to fetch advertiser from DB:', dbError)
        }
      }
      
      emailSent = await sendAdvertiserRejectionEmail(
        to,
        contactName || 'Advertiser',
        companyName || 'Company',
        metadata?.reason || 'Application did not meet requirements'
      )
    } else if (normalizedType === 'advertiser_application_confirmation' || normalizedType.includes('application_confirmation')) {
      console.log('[API /admin/emails/resend] Sending application confirmation email to:', to)
      // Resend application confirmation
      try {
        // Try to get advertiser data from database if metadata is missing
        let contactName = metadata?.contactName
        let companyName = metadata?.company || metadata?.companyName
        
        if (!contactName || !companyName) {
          console.log('[API /admin/emails/resend] Missing metadata, fetching from database...')
          try {
            const advertiser = await prisma.advertiser.findUnique({
              where: { contactEmail: to },
              select: { contactName: true, companyName: true },
            })
            if (advertiser) {
              contactName = contactName || advertiser.contactName
              companyName = companyName || advertiser.companyName
              console.log('[API /admin/emails/resend] Found advertiser:', { contactName, companyName })
            }
          } catch (dbError) {
            console.error('[API /admin/emails/resend] Failed to fetch advertiser from DB:', dbError)
          }
        }
        
        const resendModule = await import('@/lib/email/resend')
        const resend = await resendModule.createResendClient()
        if (!resend) {
          console.error('[API /admin/emails/resend] Failed to create Resend client')
          return NextResponse.json(
            { error: 'Failed to create Resend client. Check API key configuration.' },
            { status: 500 }
          )
        }
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.argufight.com'
        const fromEmail = await resendModule.getResendFromEmail()
        console.log('[API /admin/emails/resend] Using from email:', fromEmail)
        const result = await resend.emails.send({
          from: fromEmail,
          to: to,
          subject: 'Advertiser Application Received',
          html: `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
            </head>
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                <h1 style="color: white; margin: 0;">Application Received!</h1>
              </div>
              <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
                <p>Hi ${contactName || 'there'},</p>
                <p>Thank you for submitting your advertiser application${companyName ? ` for <strong>${companyName}</strong>` : ''}.</p>
                <p>We're reviewing your application and will get back to you within <strong>24-48 hours</strong>.</p>
                <p>You'll receive an email notification once your application has been reviewed. Check your inbox (and spam folder) for updates.</p>
                <p style="margin-top: 30px;">Best regards,<br>The Argu Fight Team</p>
              </div>
            </body>
            </html>
          `,
        })
        if (result.error) {
          console.error('[API /admin/emails/resend] Email send error:', result.error)
          await logApiUsage({
            provider: 'resend',
            endpoint: 'emails.send',
            success: false,
            errorMessage: result.error.message || 'Failed to send email',
            metadata: { 
              type: 'advertiser_application_confirmation_resend', 
              to, 
              originalRecordId: recordId,
              error: result.error 
            },
          })
          return NextResponse.json(
            { error: `Failed to send email: ${result.error.message || 'Unknown error'}` },
            { status: 500 }
          )
        }
        emailSent = true
        await logApiUsage({
          provider: 'resend',
          endpoint: 'emails.send',
          success: true,
          metadata: {
            type: 'advertiser_application_confirmation_resend',
            to,
            contactName: contactName || metadata?.contactName,
            company: companyName || metadata?.company || metadata?.companyName,
            originalRecordId: recordId 
          },
        })
        console.log('[API /admin/emails/resend] Application confirmation email sent successfully')
      } catch (emailError: any) {
        console.error('[API /admin/emails/resend] Error sending application confirmation:', emailError)
        return NextResponse.json(
          { error: `Failed to send email: ${emailError.message || 'Unknown error'}` },
          { status: 500 }
        )
      }
    } else {
      console.error('[API /admin/emails/resend] Unsupported email type:', emailType, 'normalized:', normalizedType)
      return NextResponse.json(
        { error: `Email type "${emailType}" is not supported for resending. Supported types: advertiser_approval, advertiser_rejection, advertiser_application_confirmation` },
        { status: 400 }
      )
    }

    console.log('[API /admin/emails/resend] Email sent result:', emailSent)

    if (emailSent) {
      return NextResponse.json({ 
        success: true,
        message: 'Email resent successfully',
      })
    } else {
      // This should not happen if all email types are handled above
      console.error('[API /admin/emails/resend] Email sent returned false but no error was thrown')
      return NextResponse.json(
        { error: 'Failed to resend email. Email function returned false. Check server logs for details.' },
        { status: 500 }
      )
    }
  } catch (error: any) {
    console.error('[API /admin/emails/resend] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to resend email' },
      { status: 500 }
    )
  }
}
