import { NextRequest, NextResponse } from 'next/server'
import { verifySession } from '@/lib/auth/session'
import { getUserIdFromSession } from '@/lib/auth/session-utils'
import { prisma } from '@/lib/db/prisma'

// GET /api/advertiser/settings - Get advertiser settings
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

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const advertiser = await prisma.advertiser.findUnique({
      where: { contactEmail: user.email },
      select: {
        id: true,
        companyName: true,
        contactEmail: true,
        contactName: true,
        website: true,
        industry: true,
        businessEIN: true,
        paymentReady: true,
        stripeAccountId: true,
        status: true,
      },
    })

    console.log('[API /advertiser/settings] GET - Advertiser data:', {
      id: advertiser?.id,
      email: advertiser?.contactEmail,
      stripeAccountId: advertiser?.stripeAccountId,
      paymentReady: advertiser?.paymentReady,
      status: advertiser?.status,
    })

    if (!advertiser) {
      return NextResponse.json({ error: 'Advertiser account not found' }, { status: 404 })
    }

    if (advertiser.status !== 'APPROVED') {
      return NextResponse.json(
        { error: 'Advertiser account not approved' },
        { status: 403 }
      )
    }

    return NextResponse.json({ advertiser })
  } catch (error: any) {
    console.error('Failed to fetch advertiser settings:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch settings' },
      { status: 500 }
    )
  }
}

// PUT /api/advertiser/settings - Update advertiser settings
export async function PUT(request: NextRequest) {
  try {
    const session = await verifySession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = getUserIdFromSession(session)
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const advertiser = await prisma.advertiser.findUnique({
      where: { contactEmail: user.email },
    })

    if (!advertiser) {
      return NextResponse.json({ error: 'Advertiser account not found' }, { status: 404 })
    }

    if (advertiser.status !== 'APPROVED') {
      return NextResponse.json(
        { error: 'Advertiser account not approved' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { companyName, contactName, website, industry, businessEIN } = body

    // Validation
    if (!companyName || !website || !industry) {
      return NextResponse.json(
        { error: 'Company name, website, and industry are required' },
        { status: 400 }
      )
    }

    // Update advertiser
    const updated = await prisma.advertiser.update({
      where: { id: advertiser.id },
      data: {
        companyName: companyName.trim(),
        contactName: contactName?.trim() || advertiser.contactName,
        website: website.trim(),
        industry: industry.trim(),
        businessEIN: businessEIN?.trim() || null,
      },
    })

    return NextResponse.json({ advertiser: updated })
  } catch (error: any) {
    console.error('Failed to update advertiser settings:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update settings' },
      { status: 500 }
    )
  }
}

