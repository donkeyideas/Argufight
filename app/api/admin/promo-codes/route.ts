import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/auth/session-utils'
import { prisma } from '@/lib/db/prisma'

export const dynamic = 'force-dynamic'

// GET /api/admin/promo-codes - Get all promo codes
export async function GET(request: NextRequest) {
  try {
    const userId = await verifyAdmin()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const promoCodes = await prisma.promoCode.findMany({
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ promoCodes })
  } catch (error: any) {
    console.error('Failed to fetch promo codes:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch promo codes' },
      { status: 500 }
    )
  }
}

// POST /api/admin/promo-codes - Create a new promo code
export async function POST(request: NextRequest) {
  try {
    const userId = await verifyAdmin()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      code,
      description,
      discountType,
      discountValue,
      maxUses,
      validFrom,
      validUntil,
      applicableTo,
      billingCycles,
    } = body

    if (!code || !discountType || !discountValue || !validFrom) {
      return NextResponse.json(
        { error: 'code, discountType, discountValue, and validFrom are required' },
        { status: 400 }
      )
    }

    if (!['PERCENTAGE', 'FIXED_AMOUNT'].includes(discountType)) {
      return NextResponse.json(
        { error: 'discountType must be PERCENTAGE or FIXED_AMOUNT' },
        { status: 400 }
      )
    }

    if (!['FREE', 'PRO', 'BOTH'].includes(applicableTo)) {
      return NextResponse.json(
        { error: 'applicableTo must be FREE, PRO, or BOTH' },
        { status: 400 }
      )
    }

    // Check if code already exists
    const existing = await prisma.promoCode.findUnique({
      where: { code: code.toUpperCase().trim() },
    })

    if (existing) {
      return NextResponse.json(
        { error: 'Promo code already exists' },
        { status: 400 }
      )
    }

    const promoCode = await prisma.promoCode.create({
      data: {
        code: code.toUpperCase().trim(),
        description: description?.trim() || null,
        discountType,
        discountValue: parseFloat(discountValue),
        maxUses: maxUses ? parseInt(maxUses) : null,
        validFrom: new Date(validFrom),
        validUntil: validUntil ? new Date(validUntil) : null,
        applicableTo,
        billingCycles: billingCycles || null,
        isActive: true,
        createdBy: userId,
      },
    })

    return NextResponse.json({ promoCode }, { status: 201 })
  } catch (error: any) {
    console.error('Failed to create promo code:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create promo code' },
      { status: 500 }
    )
  }
}

