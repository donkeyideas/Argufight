import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/auth/session-utils'
import { prisma } from '@/lib/db/prisma'
import { sendAdvertiserRejectionEmail } from '@/lib/email/advertiser-notifications'

export const dynamic = 'force-dynamic'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await verifyAdmin()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const { reason } = body

    if (!reason) {
      return NextResponse.json(
        { error: 'Rejection reason is required' },
        { status: 400 }
      )
    }

    const advertiser = await prisma.advertiser.update({
      where: { id },
      data: {
        status: 'REJECTED',
        rejectionReason: reason,
        approvedBy: userId,
      },
    })

    // Send rejection email
    try {
      console.log(`[Reject Advertiser] Attempting to send rejection email to: ${advertiser.contactEmail}`)
      const emailSent = await sendAdvertiserRejectionEmail(
        advertiser.contactEmail,
        advertiser.contactName,
        advertiser.companyName,
        reason
      )
      if (emailSent) {
        console.log(`[Reject Advertiser] ✅ Rejection email sent successfully to: ${advertiser.contactEmail}`)
      } else {
        console.warn(`[Reject Advertiser] ⚠️  Rejection email failed to send to: ${advertiser.contactEmail}`)
      }
    } catch (emailError: any) {
      console.error('[Reject Advertiser] ❌ Failed to send rejection email:', {
        error: emailError.message,
        stack: emailError.stack,
        to: advertiser.contactEmail,
      })
      // Don't fail the rejection if email fails
    }

    return NextResponse.json({ success: true, advertiser })
  } catch (error: any) {
    console.error('Failed to reject advertiser:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to reject advertiser' },
      { status: 500 }
    )
  }
}

