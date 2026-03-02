import { NextRequest, NextResponse } from 'next/server'
import { verifySessionWithDb } from '@/lib/auth/session-verify'
import { prisma } from '@/lib/db/prisma'


/**
 * GET /api/admin/coins/stats
 * Get coin system statistics (admin)
 */
export async function GET(request: NextRequest) {
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

    // Get all coin purchases
    const purchases = await prisma.coinTransaction.findMany({
      where: {
        type: 'COIN_PURCHASE',
        status: 'COMPLETED',
      },
      select: {
        amount: true,
        metadata: true,
        createdAt: true,
      },
    })

    // Calculate stats
    const totalCoinsSold = purchases.reduce((sum, tx) => sum + tx.amount, 0)
    const totalPurchases = purchases.length
    
    // Calculate revenue from metadata (package prices)
    let totalRevenue = 0
    const packageCounts: Record<string, number> = {}
    
    purchases.forEach((tx) => {
      const metadata = tx.metadata as any
      if (metadata?.packageName) {
        packageCounts[metadata.packageName] = (packageCounts[metadata.packageName] || 0) + 1
        
        // Try to get price from metadata or calculate from coins
        if (metadata.priceUSD) {
          totalRevenue += parseFloat(metadata.priceUSD)
        } else {
          // Estimate: 100 coins = $1
          totalRevenue += tx.amount / 100
        }
      }
    })

    const averagePurchaseAmount = totalPurchases > 0 ? totalRevenue / totalPurchases : 0
    
    // Find most popular package
    const mostPopularPackage = Object.entries(packageCounts).reduce(
      (a, b) => (packageCounts[a[0]] > packageCounts[b[0]] ? a : b),
      ['Unknown', 0]
    )[0]

    // Today's stats
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    const todayPurchases = purchases.filter(
      (tx) => new Date(tx.createdAt) >= today
    )
    
    const todayRevenue = todayPurchases.reduce((sum, tx) => {
      const metadata = tx.metadata as any
      if (metadata?.priceUSD) {
        return sum + parseFloat(metadata.priceUSD)
      }
      return sum + tx.amount / 100
    }, 0)

    return NextResponse.json({
      totalRevenue,
      totalCoinsSold,
      totalPurchases,
      averagePurchaseAmount,
      mostPopularPackage,
      todayRevenue,
      todayPurchases: todayPurchases.length,
    })
  } catch (error: any) {
    console.error('[API] Error fetching coin stats:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch stats' },
      { status: 500 }
    )
  }
}
