import { NextRequest, NextResponse } from 'next/server'
import { verifySessionWithDb } from '@/lib/auth/session-verify'
import { prisma } from '@/lib/db/prisma'

export const dynamic = 'force-dynamic'

/**
 * PUT /api/admin/coins/packages/[id]
 * Update coin package pricing
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await verifySessionWithDb()
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { isAdmin: true },
    })

    if (!user?.isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params
    const packageId = id
    const body = await request.json()
    const { priceUSD, baseCoins, bonusCoins } = body

    if (priceUSD === undefined && baseCoins === undefined && bonusCoins === undefined) {
      return NextResponse.json(
        { error: 'At least one field is required' },
        { status: 400 }
      )
    }

    // Update in AdminSetting
    const packageName = packageId.charAt(0).toUpperCase() + packageId.slice(1)
    
    const updates: Promise<any>[] = []

    if (priceUSD !== undefined) {
      updates.push(
        prisma.adminSetting.upsert({
          where: { key: `COIN_PACKAGE_${packageName.toUpperCase()}_PRICE` },
          create: {
            key: `COIN_PACKAGE_${packageName.toUpperCase()}_PRICE`,
            value: priceUSD.toString(),
            category: 'COINS',
          },
          update: {
            value: priceUSD.toString(),
          },
        })
      )
    }

    if (bonusCoins !== undefined) {
      updates.push(
        prisma.adminSetting.upsert({
          where: { key: `COIN_PACKAGE_${packageName.toUpperCase()}_BONUS` },
          create: {
            key: `COIN_PACKAGE_${packageName.toUpperCase()}_BONUS`,
            value: bonusCoins.toString(),
            category: 'COINS',
          },
          update: {
            value: bonusCoins.toString(),
          },
        })
      )
    }

    await Promise.all(updates)

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[API] Error updating coin package:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update package' },
      { status: 500 }
    )
  }
}
