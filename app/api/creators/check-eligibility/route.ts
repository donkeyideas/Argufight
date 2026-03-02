import { NextRequest, NextResponse } from 'next/server'
import { isEligibleForCreator } from '@/lib/ads/helpers'

// GET /api/creators/check-eligibility?elo=1500&debates=10&createdAt=...
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const elo = parseInt(searchParams.get('elo') || '0', 10)
    const debates = parseInt(searchParams.get('debates') || '0', 10)
    const createdAtStr = searchParams.get('createdAt')

    if (!createdAtStr) {
      return NextResponse.json(
        { error: 'createdAt is required' },
        { status: 400 }
      )
    }

    const createdAt = new Date(createdAtStr)
    const result = await isEligibleForCreator(elo, createdAt, debates)

    return NextResponse.json(result)
  } catch (error: any) {
    console.error('Failed to check eligibility:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to check eligibility' },
      { status: 500 }
    )
  }
}

