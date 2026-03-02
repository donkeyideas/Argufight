import { NextRequest, NextResponse } from 'next/server'
import { verifySession } from '@/lib/auth/session'
import { getUserIdFromSession } from '@/lib/auth/session-utils'
import { prisma } from '@/lib/db/prisma'
import { generate1099PDF } from '@/lib/taxes/generate1099'
import { put } from '@vercel/blob'

export const dynamic = 'force-dynamic'

// POST /api/admin/creator-taxes/bulk-generate-1099 - Generate 1099 forms for all qualifying creators
export async function POST(request: NextRequest) {
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

    const body = await request.json()
    const taxYear = body.taxYear || new Date().getFullYear() - 1

    if (isNaN(taxYear)) {
      return NextResponse.json({ error: 'Invalid tax year' }, { status: 400 })
    }

    // Find all creators who qualify for 1099 generation
    const qualifyingCreators = await prisma.creatorTaxInfo.findMany({
      where: {
        w9Submitted: true,
      },
      include: {
        creator: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
        taxForms1099: {
          where: {
            taxYear,
          },
        },
      },
    })

    const results = {
      total: 0,
      generated: 0,
      skipped: 0,
      errors: [] as Array<{ creatorId: string; error: string }>,
    }

    for (const taxInfo of qualifyingCreators) {
      results.total++

      try {
        // Check if 1099 already exists
        const existingForm = taxInfo.taxForms1099.find(f => f.taxYear === taxYear)
        if (existingForm) {
          results.skipped++
          continue
        }

        // Check earnings for the year
        const yearlyEarnings = taxInfo.yearlyEarnings as Record<string, number> || {}
        const totalCompensation = yearlyEarnings[taxYear.toString()] || 0

        if (totalCompensation < 600) {
          results.skipped++
          continue
        }

        // Generate PDF
        const pdfBuffer = await generate1099PDF({
          taxInfo,
          taxYear,
          totalCompensation,
        })

        // Upload to blob storage
        const blob = await put(`1099/${taxInfo.creatorId}/${taxYear}/1099-NEC.pdf`, pdfBuffer, {
          access: 'public',
          contentType: 'application/pdf',
        })

        // Create 1099 record
        await prisma.taxForm1099.create({
          data: {
            creatorTaxInfoId: taxInfo.id,
            taxYear,
            totalCompensation,
            status: 'GENERATED',
            pdfUrl: blob.url,
            generatedAt: new Date(),
          },
        })

        results.generated++
      } catch (error: any) {
        results.errors.push({
          creatorId: taxInfo.creatorId,
          error: error.message || 'Unknown error',
        })
      }
    }

    return NextResponse.json({
      success: true,
      taxYear,
      results,
    })
  } catch (error: any) {
    console.error('Failed to bulk generate 1099s:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to bulk generate 1099 forms' },
      { status: 500 }
    )
  }
}
