import { NextRequest, NextResponse } from 'next/server'
import { checkAndAdvanceExpiredRounds } from '@/lib/debates/round-advancement'
import { verifyCronAuth } from '@/lib/auth/cron-auth'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// GET /api/cron/advance-debate-rounds - Check and advance all expired debate rounds
export async function GET(request: NextRequest) {
  const authError = verifyCronAuth(request)
  if (authError) return authError

  try {
    const result = await checkAndAdvanceExpiredRounds()
    return NextResponse.json({
      success: true,
      message: `Processed ${result.processed} debates.`,
      details: result.debates,
    })
  } catch (error: any) {
    console.error('Cron job failed to advance debate rounds:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to advance debate rounds' },
      { status: 500 }
    )
  }
}
