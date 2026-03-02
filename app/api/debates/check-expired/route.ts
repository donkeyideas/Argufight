import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'

/**
 * GET /api/debates/check-expired
 * 
 * Lightweight endpoint to check if there are expired rounds.
 * Can be called frequently without heavy processing.
 * Returns count of expired debates.
 */
export async function GET(request: NextRequest) {
  try {
    const now = new Date()
    
    const count = await prisma.$queryRawUnsafe<Array<{ count: number }>>(`
      SELECT COUNT(*) as count
      FROM debates
      WHERE status = 'ACTIVE'
        AND round_deadline IS NOT NULL
        AND datetime(round_deadline) <= datetime(?)
    `, now.toISOString())

    return NextResponse.json({
      expiredCount: count[0]?.count || 0,
      timestamp: now.toISOString(),
    })
  } catch (error: any) {
    console.error('Failed to check expired rounds:', error)
    return NextResponse.json(
      { error: 'Failed to check expired rounds', details: error.message },
      { status: 500 }
    )
  }
}










