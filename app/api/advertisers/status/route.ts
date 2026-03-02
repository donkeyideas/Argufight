import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'

// GET /api/advertisers/status?email=...
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const email = searchParams.get('email')

    if (!email) {
      return NextResponse.json(
        { error: 'Email parameter is required' },
        { status: 400 }
      )
    }

    const advertiser = await prisma.advertiser.findUnique({
      where: { contactEmail: email.toLowerCase() },
      select: {
        id: true,
        companyName: true,
        status: true,
        rejectionReason: true,
        createdAt: true,
        approvedAt: true,
      },
    })

    if (!advertiser) {
      return NextResponse.json(
        { error: 'Application not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ advertiser })
  } catch (error: any) {
    console.error('Failed to check advertiser status:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to check status' },
      { status: 500 }
    )
  }
}

