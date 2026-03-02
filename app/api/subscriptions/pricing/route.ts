import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { verifyAdmin } from '@/lib/auth/session-utils'

// GET /api/subscriptions/pricing - Get current pricing
export async function GET() {
  try {
    const settings = await prisma.adminSetting.findMany({
      where: {
        key: {
          in: ['PRO_MONTHLY_PRICE', 'PRO_YEARLY_PRICE'],
        },
      },
    })

    const pricingMap = settings.reduce((acc, setting) => {
      acc[setting.key] = setting.value
      return acc
    }, {} as Record<string, string>)

    return NextResponse.json({
      monthly: parseFloat(pricingMap.PRO_MONTHLY_PRICE || '9.99'),
      yearly: parseFloat(pricingMap.PRO_YEARLY_PRICE || '89.00'),
    })
  } catch (error: any) {
    console.error('Failed to fetch pricing:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch pricing' },
      { status: 500 }
    )
  }
}

// PUT /api/subscriptions/pricing - Update pricing (admin only)
export async function PUT(request: NextRequest) {
  try {
    const userId = await verifyAdmin()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { monthly, yearly } = body

    if (monthly === undefined || yearly === undefined) {
      return NextResponse.json(
        { error: 'monthly and yearly prices are required' },
        { status: 400 }
      )
    }

    if (monthly <= 0 || yearly <= 0) {
      return NextResponse.json(
        { error: 'Prices must be greater than 0' },
        { status: 400 }
      )
    }

    // Update or create pricing settings
    await Promise.all([
      prisma.adminSetting.upsert({
        where: { key: 'PRO_MONTHLY_PRICE' },
        update: { value: monthly.toString() },
        create: { key: 'PRO_MONTHLY_PRICE', value: monthly.toString() },
      }),
      prisma.adminSetting.upsert({
        where: { key: 'PRO_YEARLY_PRICE' },
        update: { value: yearly.toString() },
        create: { key: 'PRO_YEARLY_PRICE', value: yearly.toString() },
      }),
    ])

    return NextResponse.json({
      success: true,
      pricing: {
        monthly: parseFloat(monthly.toString()),
        yearly: parseFloat(yearly.toString()),
      },
    })
  } catch (error: any) {
    console.error('Failed to update pricing:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update pricing' },
      { status: 500 }
    )
  }
}

