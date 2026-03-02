/**
 * API Route: GET /api/belts/room
 * Get user's belt room (current belts and history)
 */

import { NextRequest, NextResponse } from 'next/server'
import { verifySessionWithDb } from '@/lib/auth/session-verify'
import { getUserBeltRoom } from '@/lib/belts/core'

export async function GET(request: NextRequest) {
  try {
    const session = await verifySessionWithDb()
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check feature flag
    if (process.env.ENABLE_BELT_SYSTEM !== 'true') {
      return NextResponse.json({ error: 'Belt system is not enabled' }, { status: 403 })
    }

    const beltRoom = await getUserBeltRoom(session.userId)
    
    console.log('[API /belts/room] Belt room data:', JSON.stringify(beltRoom, null, 2))
    if (beltRoom.currentBelts) {
      beltRoom.currentBelts.forEach((belt: any) => {
        console.log(`[API /belts/room] Belt ${belt.id} (${belt.name}): designImageUrl =`, belt.designImageUrl)
        // Specifically check for SPORTS belt
        if (belt.name?.includes('SPORTS') || belt.category === 'SPORTS') {
          console.log(`[API /belts/room] *** SPORTS BELT FOUND ***`)
          console.log(`[API /belts/room] SPORTS Belt ID: ${belt.id}`)
          console.log(`[API /belts/room] SPORTS Belt designImageUrl: ${belt.designImageUrl}`)
          console.log(`[API /belts/room] SPORTS Belt designImageUrl type: ${typeof belt.designImageUrl}`)
          console.log(`[API /belts/room] SPORTS Belt full object:`, JSON.stringify(belt, null, 2))
        }
      })
    }

    // Force no cache headers
    const response = NextResponse.json(beltRoom)
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
    response.headers.set('Pragma', 'no-cache')
    response.headers.set('Expires', '0')
    return response
  } catch (error: any) {
    console.error('[API] Error fetching belt room:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch belt room' },
      { status: 500 }
    )
  }
}
