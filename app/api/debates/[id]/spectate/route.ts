import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { verifySession } from '@/lib/auth/session'
import { getUserIdFromSession } from '@/lib/auth/session-utils'

const SPECTATOR_TTL_SECONDS = 60

// POST /api/debates/[id]/spectate — heartbeat ping for spectator tracking
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Get viewer identity (userId or fallback to IP-based anonymous ID)
    let visitorId = 'anon'
    try {
      const session = await verifySession()
      if (session) {
        const uid = getUserIdFromSession(session)
        if (uid) visitorId = uid
      }
    } catch {
      // Not logged in — use anonymous tracking
    }

    if (visitorId === 'anon') {
      const forwarded = request.headers.get('x-forwarded-for')
      const ip = forwarded?.split(',')[0]?.trim() ?? 'unknown'
      visitorId = `anon_${ip}`
    }

    // Ensure the spectator_pings table exists (idempotent)
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS spectator_pings (
        debate_id TEXT NOT NULL,
        visitor_id TEXT NOT NULL,
        last_ping TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (debate_id, visitor_id)
      )
    `)

    // Upsert this viewer's heartbeat
    await prisma.$executeRawUnsafe(`
      INSERT INTO spectator_pings (debate_id, visitor_id, last_ping)
      VALUES ($1, $2, NOW())
      ON CONFLICT (debate_id, visitor_id)
      DO UPDATE SET last_ping = NOW()
    `, id, visitorId)

    // Clean up stale pings for this debate and recalculate count
    await prisma.$executeRawUnsafe(`
      DELETE FROM spectator_pings
      WHERE debate_id = $1 AND last_ping < NOW() - INTERVAL '${SPECTATOR_TTL_SECONDS} seconds'
    `, id)

    const result = await prisma.$queryRawUnsafe<[{ count: bigint }]>(`
      SELECT COUNT(*) as count FROM spectator_pings WHERE debate_id = $1
    `, id)

    const count = Number(result[0]?.count ?? 0)

    // Update the debate's spectatorCount
    await prisma.debate.update({
      where: { id },
      data: { spectatorCount: count },
    })

    return NextResponse.json({ spectatorCount: count })
  } catch (error) {
    console.error('Spectate error:', error)
    return NextResponse.json({ spectatorCount: 0 })
  }
}
