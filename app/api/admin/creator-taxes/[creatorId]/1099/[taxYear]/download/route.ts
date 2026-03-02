import { NextRequest, NextResponse } from 'next/server'
import { verifySession } from '@/lib/auth/session'
import { getUserIdFromSession } from '@/lib/auth/session-utils'
import { prisma } from '@/lib/db/prisma'
import { generate1099PDF } from '@/lib/taxes/generate1099'


// GET /api/admin/creator-taxes/[creatorId]/1099/[taxYear]/download - Download 1099 PDF
export async function GET(
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

    // Generate PDF (or fetch from storage if available)
    const pdfBuffer = await generate1099PDF({
      taxInfo,
      taxYear,
      totalCompensation: Number(form1099.totalCompensation),
    })

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="1099-NEC-${creatorId}-${taxYear}.pdf"`,
      },
    })
  } catch (error: any) {
    console.error('Failed to download 1099:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to download 1099 form' },
      { status: 500 }
    )
  }
}
