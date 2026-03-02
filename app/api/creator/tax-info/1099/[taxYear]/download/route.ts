import { NextRequest, NextResponse } from 'next/server'
import { verifySessionWithDb } from '@/lib/auth/session-verify'
import { prisma } from '@/lib/db/prisma'
import { generate1099PDF } from '@/lib/taxes/generate1099'

// GET /api/creator/tax-info/1099/[taxYear]/download - Download 1099 PDF
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ taxYear: string }> }
) {
  try {
    const session = await verifySessionWithDb()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.userId
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { taxYear: taxYearStr } = await params
    const taxYear = parseInt(taxYearStr)
    if (isNaN(taxYear)) {
      return NextResponse.json({ error: 'Invalid tax year' }, { status: 400 })
    }

    // Get tax info
    const taxInfo = await prisma.creatorTaxInfo.findUnique({
      where: { creatorId: userId },
    })

    if (!taxInfo || !taxInfo.w9Submitted) {
      return NextResponse.json(
        { error: 'W-9 form not submitted' },
        { status: 400 }
      )
    }

    // Get 1099 form
    const form1099 = await prisma.taxForm1099.findFirst({
      where: {
        creatorTaxInfoId: taxInfo.id,
        taxYear,
      },
    })

    if (!form1099 || !form1099.pdfUrl) {
      return NextResponse.json(
        { error: '1099 form not found or not generated' },
        { status: 404 }
      )
    }

    // If PDF exists, return it
    // For now, we'll generate it on-demand if it doesn't exist
    // In production, you'd serve from storage (S3, etc.)
    
    // Generate PDF
    const pdfBuffer = await generate1099PDF({
      taxInfo,
      taxYear,
      totalCompensation: Number(form1099.totalCompensation),
    })

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="1099-NEC-${taxYear}.pdf"`,
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
