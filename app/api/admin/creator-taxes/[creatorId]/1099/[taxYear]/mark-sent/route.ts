import { NextRequest, NextResponse } from 'next/server'
import { verifySession } from '@/lib/auth/session'
import { getUserIdFromSession } from '@/lib/auth/session-utils'
import { prisma } from '@/lib/db/prisma'

export const dynamic = 'force-dynamic'

// POST /api/admin/creator-taxes/[creatorId]/1099/[taxYear]/mark-sent - Mark 1099 as sent
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ creatorId: string; taxYear: string }> }
) {
  try {
    const session = await verifySession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = getUserIdFromSession(session)
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is admin
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { isAdmin: true },
    })

    if (!user || !user.isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { creatorId, taxYear: taxYearStr } = await params
    const taxYear = parseInt(taxYearStr)

    // Get tax info
    const taxInfo = await prisma.creatorTaxInfo.findUnique({
      where: { creatorId },
    })

    if (!taxInfo) {
      return NextResponse.json({ error: 'Creator tax info not found' }, { status: 404 })
    }

    // Get 1099 form
    const form1099 = await prisma.taxForm1099.findFirst({
      where: {
        creatorTaxInfoId: taxInfo.id,
        taxYear,
      },
    })

    if (!form1099) {
      return NextResponse.json({ error: '1099 form not found' }, { status: 404 })
    }

    // Update status
    const updated = await prisma.taxForm1099.update({
      where: { id: form1099.id },
      data: {
        status: 'SENT',
        sentToCreator: true,
        sentAt: new Date(),
      },
    })

    return NextResponse.json({
      success: true,
      form1099: {
        id: updated.id,
        status: updated.status,
        sentToCreator: updated.sentToCreator,
        sentAt: updated.sentAt,
      },
    })
  } catch (error: any) {
    console.error('Failed to mark 1099 as sent:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update 1099 status' },
      { status: 500 }
    )
  }
}
