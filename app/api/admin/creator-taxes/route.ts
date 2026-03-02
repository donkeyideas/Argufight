import { NextRequest, NextResponse } from 'next/server'
import { verifySession } from '@/lib/auth/session'
import { getUserIdFromSession } from '@/lib/auth/session-utils'
import { prisma } from '@/lib/db/prisma'


// GET /api/admin/creator-taxes - Get all creator tax information
export async function GET(request: NextRequest) {
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

    // Get all creator tax info
    const taxInfos = await prisma.creatorTaxInfo.findMany({
      include: {
        creator: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
        taxForms1099: {
          orderBy: { taxYear: 'desc' },
        },
      },
      orderBy: {
        creator: {
          username: 'asc',
        },
      },
    })

    return NextResponse.json({
      creators: taxInfos.map((info) => ({
        id: info.id,
        creatorId: info.creatorId,
        creator: info.creator,
        legalName: info.legalName,
        businessName: info.businessName,
        taxIdType: info.taxIdType,
        w9Submitted: info.w9Submitted,
        w9SubmittedAt: info.w9SubmittedAt,
        yearlyEarnings: info.yearlyEarnings,
        taxForms1099: info.taxForms1099.map((form) => ({
          id: form.id,
          taxYear: form.taxYear,
          totalCompensation: Number(form.totalCompensation),
          status: form.status,
          pdfUrl: form.pdfUrl,
          generatedAt: form.generatedAt,
          sentToCreator: form.sentToCreator,
          sentAt: form.sentAt,
          filedWithIRS: form.filedWithIRS,
          filedAt: form.filedAt,
        })),
      })),
    })
  } catch (error: any) {
    console.error('Failed to fetch creator tax info:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch creator tax information' },
      { status: 500 }
    )
  }
}
