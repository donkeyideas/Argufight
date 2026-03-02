import { NextRequest, NextResponse } from 'next/server'
import { verifySessionWithDb } from '@/lib/auth/session-verify'
import { getPlatformFee } from '@/lib/ads/config'

// GET /api/creator/platform-fees - Get platform fees for all tiers
export async function GET(request: NextRequest) {
  try {
    const session = await verifySessionWithDb()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const [bronze, silver, gold, platinum] = await Promise.all([
      getPlatformFee('BRONZE'),
      getPlatformFee('SILVER'),
      getPlatformFee('GOLD'),
      getPlatformFee('PLATINUM'),
    ])

    return NextResponse.json({
      BRONZE: bronze,
      SILVER: silver,
      GOLD: gold,
      PLATINUM: platinum,
    })
  } catch (error: any) {
    console.error('Failed to fetch platform fees:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch platform fees' },
      { status: 500 }
    )
  }
}

