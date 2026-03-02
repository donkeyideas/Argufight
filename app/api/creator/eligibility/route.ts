import { NextRequest, NextResponse } from 'next/server'
import { verifySessionWithDb } from '@/lib/auth/session-verify'
import { getCreatorEligibility } from '@/lib/ads/config'

// GET /api/creator/eligibility - Get creator eligibility requirements
export async function GET(request: NextRequest) {
  try {
    const session = await verifySessionWithDb()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const eligibility = await getCreatorEligibility()
    return NextResponse.json(eligibility)
  } catch (error: any) {
    console.error('Failed to fetch eligibility:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch eligibility' },
      { status: 500 }
    )
  }
}

