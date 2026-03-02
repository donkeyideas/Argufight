import { NextRequest, NextResponse } from 'next/server'
import { verifySessionWithDb } from '@/lib/auth/session-verify'
import { prisma } from '@/lib/db/prisma'

// POST /api/creator/tax-info/w9 - Submit W-9 form
export async function POST(request: NextRequest) {
  try {
    const session = await verifySessionWithDb()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.userId
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      legalName,
      businessName,
      taxIdType,
      taxId,
      businessType,
      addressLine1,
      addressLine2,
      city,
      state,
      zipCode,
      country,
    } = body

    // Validate required fields
    if (!legalName || !taxIdType || !taxId || !businessType || !addressLine1 || !city || !state || !zipCode) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Validate tax ID format
    const cleanTaxId = taxId.replace(/\D/g, '')
    if (taxIdType === 'SSN' && cleanTaxId.length !== 9) {
      return NextResponse.json(
        { error: 'Invalid SSN format' },
        { status: 400 }
      )
    }
    if (taxIdType === 'EIN' && cleanTaxId.length !== 9) {
      return NextResponse.json(
        { error: 'Invalid EIN format' },
        { status: 400 }
      )
    }

    // Get or create tax info
    let taxInfo = await prisma.creatorTaxInfo.findUnique({
      where: { creatorId: userId },
    })

    if (!taxInfo) {
      taxInfo = await prisma.creatorTaxInfo.create({
        data: {
          creatorId: userId,
          stripeAccountId: `temp_${userId}`,
          yearlyEarnings: {},
        },
      })
    }

    // Update tax info with W-9 data
    const updateData: any = {
      legalName,
      businessName: businessName || null,
      taxIdType,
      w9Submitted: true,
      w9SubmittedAt: new Date(),
      taxFormComplete: true,
    };

    // Only include address fields if they exist in the request
    if (addressLine1) updateData.addressLine1 = addressLine1;
    if (addressLine2) updateData.addressLine2 = addressLine2;
    if (city) updateData.city = city;
    if (state) updateData.state = state.toUpperCase();
    if (zipCode) updateData.zipCode = zipCode;
    if (country) updateData.country = country;

    const updated = await prisma.creatorTaxInfo.update({
      where: { id: taxInfo.id },
      data: updateData,
    })

    return NextResponse.json({
      success: true,
      message: 'W-9 form submitted successfully',
      taxInfo: {
        w9Submitted: updated.w9Submitted,
        w9SubmittedAt: updated.w9SubmittedAt,
        legalName: updated.legalName,
      },
    })
  } catch (error: any) {
    console.error('Failed to submit W-9:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to submit W-9 form' },
      { status: 500 }
    )
  }
}
