import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { verifyCronAuth } from '@/lib/auth/cron-auth'

// Cron job to mark expired offers as EXPIRED
// Schedule: Daily at 3 AM UTC
export async function GET(request: NextRequest) {
  try {
    const authError = verifyCronAuth(request)
    if (authError) return authError

    const now = new Date()
    const expiredOffers = await prisma.offer.updateMany({
      where: {
        status: 'PENDING',
        expiresAt: { lt: now },
      },
      data: {
        status: 'EXPIRED',
      },
    })

    console.log(`Marked ${expiredOffers.count} offers as expired`)

    return NextResponse.json({
      success: true,
      expiredCount: expiredOffers.count,
    })
  } catch (error: any) {
    console.error('Cron job failed:', error)
    return NextResponse.json(
      { error: error.message || 'Cron job failed' },
      { status: 500 }
    )
  }
}

