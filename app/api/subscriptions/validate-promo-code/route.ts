import { NextRequest, NextResponse } from 'next/server'
import { verifySession } from '@/lib/auth/session'
import { prisma } from '@/lib/db/prisma'

export async function POST(request: NextRequest) {
  try {
    const session = await verifySession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { code, tier, billingCycle } = body

    if (!code || !tier || !billingCycle) {
      return NextResponse.json(
        { error: 'code, tier, and billingCycle are required' },
        { status: 400 }
      )
    }

    const promoCode = await prisma.promoCode.findUnique({
      where: { code: code.toUpperCase() },
    })

    if (!promoCode || !promoCode.isActive) {
      return NextResponse.json({
        valid: false,
        error: 'Promo code not found or inactive',
      })
    }

    // Check if expired
    if (promoCode.validUntil && new Date() > promoCode.validUntil) {
      return NextResponse.json({
        valid: false,
        error: 'Promo code has expired',
      })
    }

    // Check if not yet valid
    if (new Date() < promoCode.validFrom) {
      return NextResponse.json({
        valid: false,
        error: 'Promo code is not yet valid',
      })
    }

    // Check if max uses exceeded
    if (promoCode.maxUses && promoCode.currentUses >= promoCode.maxUses) {
      return NextResponse.json({
        valid: false,
        error: 'Promo code has reached maximum uses',
      })
    }

    // Check applicability
    if (promoCode.applicableTo !== 'BOTH' && promoCode.applicableTo !== tier) {
      return NextResponse.json({
        valid: false,
        error: 'Promo code is not applicable to this tier',
      })
    }

    // Check billing cycles
    if (promoCode.billingCycles) {
      const cycles = JSON.parse(promoCode.billingCycles)
      if (!cycles.includes(billingCycle)) {
        return NextResponse.json({
          valid: false,
          error: 'Promo code is not applicable to this billing cycle',
        })
      }
    }

    // Calculate discount
    const basePrice = billingCycle === 'MONTHLY' ? 9.99 : 89.0
    let discountAmount = 0
    if (promoCode.discountType === 'PERCENTAGE') {
      discountAmount = (basePrice * Number(promoCode.discountValue)) / 100
    } else {
      discountAmount = Number(promoCode.discountValue)
    }

    const finalPrice = Math.max(0, basePrice - discountAmount)

    return NextResponse.json({
      valid: true,
      discountAmount,
      finalPrice,
      discountType: promoCode.discountType,
      discountValue: Number(promoCode.discountValue),
    })
  } catch (error: any) {
    console.error('Failed to validate promo code:', error)
    return NextResponse.json(
      { valid: false, error: error.message || 'Failed to validate promo code' },
      { status: 500 }
    )
  }
}

