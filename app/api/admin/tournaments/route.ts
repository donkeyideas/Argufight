import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/auth/session-utils'
import { prisma } from '@/lib/db/prisma'


// GET /api/admin/tournaments - Get all tournaments
export async function GET(request: NextRequest) {
  try {
    const userId = await verifyAdmin()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch all tournaments using Prisma
    // Use select to avoid including format field if migration hasn't been applied
    console.log('[Admin Tournaments API] Fetching tournaments...')
    const tournaments = await prisma.tournament.findMany({
      select: {
        id: true,
        name: true,
        description: true,
        status: true,
        maxParticipants: true,
        currentRound: true,
        totalRounds: true,
        format: true, // Include format field
        createdAt: true,
        creatorId: true,
        creator: {
          select: {
            username: true,
            email: true,
          },
        },
        participants: {
          select: {
            id: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 100,
    })

    console.log(`[Admin Tournaments API] Found ${tournaments.length} tournaments`)

    // Format tournaments for response
    const tournamentsWithCounts = tournaments.map((tournament) => ({
      id: tournament.id,
      name: tournament.name,
      description: tournament.description,
      status: tournament.status,
      maxParticipants: tournament.maxParticipants,
      currentRound: tournament.currentRound,
      totalRounds: tournament.totalRounds,
      format: tournament.format || 'BRACKET', // Default to BRACKET if not set
      participantCount: tournament.participants.length,
      createdAt: tournament.createdAt.toISOString(),
      creator: tournament.creator || { username: 'Unknown', email: '' },
    }))

    console.log(`[Admin Tournaments API] Returning ${tournamentsWithCounts.length} formatted tournaments`)
    return NextResponse.json(tournamentsWithCounts)
  } catch (error: any) {
    // If table doesn't exist, return empty array
    if (error.message?.includes('does not exist') || error.code === '42P01') {
      return NextResponse.json([])
    }

    console.error('Failed to fetch tournaments:', error)
    return NextResponse.json(
      { error: 'Failed to fetch tournaments' },
      { status: 500 }
    )
  }
}

