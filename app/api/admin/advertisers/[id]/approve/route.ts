import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/auth/session-utils'
import { prisma } from '@/lib/db/prisma'
import { sendAdvertiserApprovalEmail } from '@/lib/email/advertiser-notifications'
import { hashPassword } from '@/lib/auth/password'
import { generateResetToken } from '@/lib/auth/password-reset-tokens'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  console.log('[API /admin/advertisers/[id]/approve] ===== ROUTE CALLED =====')
  try {
    const userId = await verifyAdmin()
    if (!userId) {
      console.log('[API /admin/advertisers/[id]/approve] Unauthorized - no userId')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    console.log('[API /admin/advertisers/[id]/approve] Approving advertiser ID:', id)

    const advertiser = await prisma.advertiser.update({
      where: { id },
      data: {
        status: 'APPROVED',
        approvedAt: new Date(),
        approvedBy: userId,
      },
    })
    console.log('[API /admin/advertisers/[id]/approve] Advertiser updated:', {
      id: advertiser.id,
      companyName: advertiser.companyName,
      status: advertiser.status,
      contactEmail: advertiser.contactEmail,
    })

    // Check if user account exists for this advertiser
    let user = await prisma.user.findUnique({
      where: { email: advertiser.contactEmail.toLowerCase() },
    })

    let userCreated = false
    let passwordResetToken: string | null = null

    // If no user account exists, create one
    if (!user) {
      try {
        // Generate a temporary password (user will need to reset it via password reset link)
        const tempPassword = crypto.randomBytes(12).toString('base64').slice(0, 12)
        const passwordHash = await hashPassword(tempPassword)

        // Create username from email (ensure uniqueness)
        let username = advertiser.contactEmail.split('@')[0]
        let usernameExists = await prisma.user.findUnique({ where: { username } })
        let counter = 1
        while (usernameExists) {
          username = `${advertiser.contactEmail.split('@')[0]}${counter}`
          usernameExists = await prisma.user.findUnique({ where: { username } })
          counter++
        }

        user = await prisma.user.create({
          data: {
            email: advertiser.contactEmail.toLowerCase(),
            username: username,
            passwordHash: passwordHash,
            // Create FREE subscription for new user
            subscription: {
              create: {
                tier: 'FREE',
                status: 'ACTIVE',
              },
            },
            // Create appeal limit for new user
            appealLimit: {
              create: {
                monthlyLimit: 4,
                currentCount: 0,
              },
            },
          },
        })

        // Generate password reset token for new user (7 days expiry)
        passwordResetToken = await generateResetToken(advertiser.contactEmail.toLowerCase(), 7 * 24) // 7 days

        userCreated = true
        console.log(`✅ Created user account for approved advertiser: ${advertiser.contactEmail}`)
        console.log(`✅ Generated password reset token for new user`)
      } catch (userError: any) {
        console.error('Failed to create user account (non-blocking):', userError)
        // Don't fail the approval if user creation fails - they can create account manually
      }
    } else {
      console.log(`✅ User account already exists for advertiser: ${advertiser.contactEmail}`)
    }

    // Send approval email
    try {
      console.log(`[Approve Advertiser] Attempting to send approval email to: ${advertiser.contactEmail}`)
      const emailSent = await sendAdvertiserApprovalEmail(
        advertiser.contactEmail,
        advertiser.contactName,
        advertiser.companyName,
        userCreated, // Pass flag if user was just created
        passwordResetToken // Pass reset token if user was just created
      )
      if (emailSent) {
        console.log(`[Approve Advertiser] ✅ Approval email sent successfully to: ${advertiser.contactEmail}`)
      } else {
        console.warn(`[Approve Advertiser] ⚠️  Approval email failed to send to: ${advertiser.contactEmail}`)
      }
    } catch (emailError: any) {
      console.error('[Approve Advertiser] ❌ Failed to send approval email:', {
        error: emailError.message,
        stack: emailError.stack,
        to: advertiser.contactEmail,
      })
      // Don't fail the approval if email fails
    }

    console.log('[API /admin/advertisers/[id]/approve] ✅ Approval successful, returning response')
    return NextResponse.json({ 
      success: true, 
      advertiser: {
        id: advertiser.id,
        companyName: advertiser.companyName,
        status: advertiser.status,
        contactEmail: advertiser.contactEmail,
      },
      userCreated,
    })
  } catch (error: any) {
    console.error('[API /admin/advertisers/[id]/approve] ❌ Error:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
    })
    return NextResponse.json(
      { error: error.message || 'Failed to approve advertiser' },
      { status: 500 }
    )
  }
}

