import { NextRequest, NextResponse } from 'next/server'
import { verifySession } from '@/lib/auth/session'
import { getUserIdFromSession } from '@/lib/auth/session-utils'
import { prisma } from '@/lib/db/prisma'
import { generate1099PDF } from '@/lib/taxes/generate1099'
import { put } from '@vercel/blob'

export const dynamic = 'force-dynamic'

// POST /api/admin/creator-taxes/[creatorId]/1099/[taxYear]/generate - Generate 1099 form
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

    if (isNaN(taxYear)) {
      return NextResponse.json({ error: 'Invalid tax year' }, { status: 400 })
    }

    // Get tax info
    const taxInfo = await prisma.creatorTaxInfo.findUnique({
      where: { creatorId },
    })

    if (!taxInfo) {
      return NextResponse.json({ error: 'Creator tax info not found' }, { status: 404 })
    }

    if (!taxInfo.w9Submitted) {
      return NextResponse.json(
        { error: 'W-9 form not submitted by creator' },
        { status: 400 }
      )
    }

    // Check if 1099 already exists
    const existingForm = await prisma.taxForm1099.findFirst({
      where: {
        creatorTaxInfoId: taxInfo.id,
        taxYear,
      },
    })

    if (existingForm) {
      return NextResponse.json(
        { error: '1099 form already exists for this year' },
        { status: 400 }
      )
    }

    // Calculate total compensation for the year
    const yearlyEarnings = taxInfo.yearlyEarnings as Record<string, number> || {}
    const totalCompensation = yearlyEarnings[taxYear.toString()] || 0

    if (totalCompensation < 600) {
      return NextResponse.json(
        { error: 'Total compensation must be at least $600 to generate 1099' },
        { status: 400 }
      )
    }

    // Generate PDF
    const pdfBuffer = await generate1099PDF({
      taxInfo,
      taxYear,
      totalCompensation,
    })

    // Upload to blob storage (Vercel Blob)
    const blob = await put(`1099/${creatorId}/${taxYear}/1099-NEC.pdf`, pdfBuffer, {
      access: 'public',
      contentType: 'application/pdf',
    })

    // Create 1099 record
    const form1099 = await prisma.taxForm1099.create({
      data: {
        creatorTaxInfoId: taxInfo.id,
        taxYear,
        totalCompensation,
        status: 'GENERATED',
        pdfUrl: blob.url,
        generatedAt: new Date(),
      },
    })

    return NextResponse.json({
      success: true,
      form1099: {
        id: form1099.id,
        taxYear: form1099.taxYear,
        totalCompensation: Number(form1099.totalCompensation),
        status: form1099.status,
        pdfUrl: form1099.pdfUrl,
        generatedAt: form1099.generatedAt,
      },
    })
  } catch (error: any) {
    console.error('[Generate 1099 API] Error:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
    })
    return NextResponse.json(
      { error: error.message || 'Failed to generate 1099 form' },
      { status: 500 }
    )
  }
}
