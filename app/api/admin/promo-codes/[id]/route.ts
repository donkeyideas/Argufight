import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/auth/session-utils'
import { prisma } from '@/lib/db/prisma'

export const dynamic = 'force-dynamic'

// GET /api/admin/promo-codes/[id] - Get a specific promo code
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await verifyAdmin()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const promoCode = await prisma.promoCode.findUnique({
      where: { id },
    })

    if (!promoCode) {
      return NextResponse.json(
        { error: 'Promo code not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ promoCode })
  } catch (error: any) {
    console.error('Failed to fetch promo code:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch promo code' },
      { status: 500 }
    )
  }
}

// PATCH /api/admin/promo-codes/[id] - Update a promo code
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await verifyAdmin()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()

    // Check if promo code exists
    const existing = await prisma.promoCode.findUnique({
      where: { id },
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'Promo code not found' },
        { status: 404 }
      )
    }

    // If code is being changed, check for duplicates
    if (body.code && body.code.toUpperCase() !== existing.code) {
      const duplicate = await prisma.promoCode.findUnique({
        where: { code: body.code.toUpperCase().trim() },
      })

      if (duplicate) {
        return NextResponse.json(
          { error: 'Promo code already exists' },
          { status: 400 }
        )
      }
    }

    const updateData: any = {}

    if (body.code !== undefined) updateData.code = body.code.toUpperCase().trim()
    if (body.description !== undefined) updateData.description = body.description?.trim() || null
    if (body.discountType !== undefined) updateData.discountType = body.discountType
    if (body.discountValue !== undefined) updateData.discountValue = parseFloat(body.discountValue)
    if (body.maxUses !== undefined) updateData.maxUses = body.maxUses ? parseInt(body.maxUses) : null
    if (body.validFrom !== undefined) updateData.validFrom = new Date(body.validFrom)
    if (body.validUntil !== undefined) updateData.validUntil = body.validUntil ? new Date(body.validUntil) : null
    if (body.applicableTo !== undefined) updateData.applicableTo = body.applicableTo
    if (body.billingCycles !== undefined) updateData.billingCycles = body.billingCycles || null
    if (body.isActive !== undefined) updateData.isActive = body.isActive

    const promoCode = await prisma.promoCode.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json({ promoCode })
  } catch (error: any) {
    console.error('Failed to update promo code:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update promo code' },
      { status: 500 }
    )
  }
}

// DELETE /api/admin/promo-codes/[id] - Delete a promo code
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await verifyAdmin()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    // Check if promo code exists
    const existing = await prisma.promoCode.findUnique({
      where: { id },
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'Promo code not found' },
        { status: 404 }
      )
    }

    await prisma.promoCode.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Failed to delete promo code:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to delete promo code' },
      { status: 500 }
    )
  }
}

