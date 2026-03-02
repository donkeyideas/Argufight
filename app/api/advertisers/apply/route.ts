import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { isCreatorMarketplaceEnabled } from '@/lib/ads/config'
import { createResendClient } from '@/lib/email/resend'
import { logApiUsage } from '@/lib/ai/api-tracking'
import crypto from 'crypto'

// POST /api/advertisers/apply - Submit advertiser application
export async function POST(request: NextRequest) {
  try {
    // Check if creator marketplace is enabled
    const marketplaceEnabled = await isCreatorMarketplaceEnabled()
    if (!marketplaceEnabled) {
      return NextResponse.json(
        { error: 'Creator Marketplace is currently disabled' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { 
      companyName, 
      website, 
      industry, 
      contactName, 
      contactEmail, 
      contactPhone,
      businessEIN,
      companySize,
      monthlyAdBudget,
      marketingGoals,
    } = body

    // Validation
    if (!companyName || !website || !industry || !contactName || !contactEmail || !contactPhone) {
      return NextResponse.json(
        { error: 'All required fields must be provided' },
        { status: 400 }
      )
    }

    // Check if email already exists
    // Use select to only get fields that definitely exist
    const existing = await prisma.advertiser.findUnique({
      where: { contactEmail },
      select: {
        id: true,
        contactEmail: true,
        companyName: true,
        status: true,
      },
    })

    if (existing) {
      return NextResponse.json(
        { error: 'An application with this email already exists' },
        { status: 400 }
      )
    }

    // Create advertiser application
    // Build data object with only fields that definitely exist
    const advertiserData: any = {
      companyName: companyName.trim(),
      website: website.trim(),
      industry: industry.trim(),
      contactName: contactName.trim(),
      contactEmail: contactEmail.trim().toLowerCase(),
      businessEIN: businessEIN?.trim() || null,
      status: 'PENDING',
    }

    // Try to create with new fields first, but fall back if they don't exist
    let advertiser
    try {
      // Try with new fields
      advertiser = await prisma.advertiser.create({
        data: {
          ...advertiserData,
          contactPhone: contactPhone?.trim() || null,
          companySize: companySize?.trim() || null,
          monthlyAdBudget: monthlyAdBudget?.trim() || null,
          marketingGoals: marketingGoals?.trim() || null,
        },
      })
    } catch (error: any) {
      // Check if error is about missing columns
      const isColumnError = 
        error.message?.includes('contact_phone') || 
        error.message?.includes('company_size') || 
        error.message?.includes('monthly_ad_budget') || 
        error.message?.includes('marketing_goals') ||
        error.message?.includes('does not exist')
      
      if (isColumnError) {
        console.warn('[Advertiser Apply] New fields not available, creating without them. Run migration to enable all fields.')
        
        // Create without new fields
        advertiser = await prisma.advertiser.create({
          data: advertiserData,
        })
        
        return NextResponse.json(
          {
            success: true,
            advertiser: {
              id: advertiser.id,
              companyName: advertiser.companyName,
              status: advertiser.status,
            },
            warning: 'Application created, but some fields (phone, company size, budget, goals) were not saved. Please run database migration to enable all fields.',
          },
          { status: 201 }
        )
      } else {
        // Different error - re-throw
        console.error('[Advertiser Apply] Error creating advertiser:', error)
        return NextResponse.json(
          {
            error: error.message || 'Failed to create advertiser application',
          },
          { status: 500 }
        )
      }
    }
    
    // Send confirmation email to advertiser (non-blocking)
    try {
      const resend = await createResendClient()
      if (resend) {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.argufight.com'
        const { getResendFromEmail } = await import('@/lib/email/resend')
        const fromEmail = await getResendFromEmail()
        console.log('[Advertiser Apply] Using from email:', fromEmail)
        await resend.emails.send({
          from: fromEmail,
          to: contactEmail,
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
                <p>Hi ${contactName},</p>
                <p>Thank you for submitting your advertiser application for <strong>${companyName}</strong>.</p>
                <p>We're reviewing your application and will get back to you within <strong>24-48 hours</strong>.</p>
                <p>You'll receive an email notification once your application has been reviewed. Check your inbox (and spam folder) for updates.</p>
                <p style="margin-top: 30px;">Best regards,<br>The Argu Fight Team</p>
              </div>
            </body>
            </html>
          `,
        })
        await logApiUsage({
          provider: 'resend',
          endpoint: 'emails.send',
          success: true,
          metadata: {
            type: 'advertiser_application_confirmation',
            to: contactEmail,
            contactName: contactName,
            company: companyName,
          },
        })
        console.log('[Advertiser Apply] Confirmation email sent to:', contactEmail)
      }
    } catch (emailError: any) {
      console.error('[Advertiser Apply] Failed to send confirmation email:', emailError)
      // Don't fail the request if email fails
    }

    // Send notification email and in-app notifications to admins (non-blocking)
    try {
      const admins = await prisma.user.findMany({
        where: { isAdmin: true },
        select: { id: true, email: true },
      })

      if (admins.length > 0) {
        const adminEmails = admins.map(a => a.email).filter(Boolean) as string[]
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.argufight.com'

        // Create in-app notifications for all admins
        try {
          const notifications = admins.map(admin => ({
            id: crypto.randomUUID(),
            userId: admin.id,
            type: 'NEW_MESSAGE' as const, // Using existing notification type
            title: 'New Advertiser Application',
            message: `${companyName} (${industry}) has submitted an advertiser application. Contact: ${contactEmail}`,
            read: false,
          }))

          await prisma.notification.createMany({
            data: notifications,
          })
          console.log(`[Advertiser Apply] Created in-app notifications for ${admins.length} admin(s)`)
        } catch (notificationError: any) {
          console.error('[Advertiser Apply] Failed to create in-app notifications:', notificationError)
          // Don't fail if notifications fail
        }

        // Send email notification to admins
        try {
          const resend = await createResendClient()
          if (resend) {
            await resend.emails.send({
              from: 'Argu Fight <noreply@argufight.com>',
              to: adminEmails,
              subject: `New Advertiser Application: ${companyName}`,
              html: `
                <!DOCTYPE html>
                <html>
                <head>
                  <meta charset="utf-8">
                  <meta name="viewport" content="width=device-width, initial-scale=1.0">
                </head>
                <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
                  <div style="background: #f9f9f9; padding: 30px; border-radius: 10px;">
                    <h2 style="color: #667eea;">New Advertiser Application</h2>
                    <p><strong>Company:</strong> ${companyName}</p>
                    <p><strong>Industry:</strong> ${industry}</p>
                    <p><strong>Contact:</strong> ${contactName} (${contactEmail})</p>
                    ${contactPhone ? `<p><strong>Phone:</strong> ${contactPhone}</p>` : ''}
                    <p><strong>Website:</strong> <a href="${website}">${website}</a></p>
                    <div style="text-align: center; margin: 30px 0;">
                      <a href="${appUrl}/admin/advertisements?tab=advertisers" style="display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                        Review Application
                      </a>
                    </div>
                  </div>
                </body>
                </html>
              `,
            })
            await logApiUsage({
              provider: 'resend',
              endpoint: 'emails.send',
              success: true,
              metadata: { type: 'advertiser_application_notification', to: adminEmails.join(',') },
            })
            console.log('[Advertiser Apply] Notification email sent to admins')
          }
        } catch (emailError: any) {
          console.error('[Advertiser Apply] Failed to send admin notification email:', emailError)
          // Don't fail if email fails
        }
      }
    } catch (error: any) {
      console.error('[Advertiser Apply] Failed to send admin notifications:', error)
      // Don't fail the request if notifications fail
    }
    
    // Success with all fields
    return NextResponse.json(
      {
        success: true,
        advertiser: {
          id: advertiser.id,
          companyName: advertiser.companyName,
          status: advertiser.status,
        },
      },
      { status: 201 }
    )
  } catch (error: any) {
    console.error('Failed to create advertiser application:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to submit application' },
      { status: 500 }
    )
  }
}

