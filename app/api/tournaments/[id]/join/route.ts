import { NextRequest, NextResponse } from 'next/server'
import { verifySession } from '@/lib/auth/session'
import { getUserIdFromSession } from '@/lib/auth/session-utils'
import { prisma } from '@/lib/db/prisma'
import { recordFeatureUsage } from '@/lib/subscriptions/subscription-utils'
import { FEATURES } from '@/lib/subscriptions/features'

// POST /api/tournaments/[id]/join - Join a tournament
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await verifySession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = getUserIdFromSession(session)
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: tournamentId } = await params

    // Get request body for position selection (Championship format)
    const body = await request.json().catch(() => ({}))
    const { selectedPosition } = body

    // Get tournament
    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
      include: {
        participants: {
          include: {
            user: true,
          },
        },
      },
    })

    if (!tournament) {
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 })
    }

    // Check if tournament is private and user is invited
    if (tournament.isPrivate) {
      console.log(`[Join Tournament] Tournament "${tournament.name}" is private. Creator: ${tournament.creatorId}, User: ${userId}`)
      if (tournament.creatorId !== userId) {
        // User is not the creator, check if they're invited
        if (!tournament.invitedUserIds) {
          console.log(`[Join Tournament] Private tournament has no invited users`)
          return NextResponse.json(
            { error: 'This is a private tournament and you are not invited' },
            { status: 403 }
          )
        }

        let invitedIds: string[]
        try {
          invitedIds = JSON.parse(tournament.invitedUserIds) as string[]
        } catch (error) {
          console.error('Failed to parse invitedUserIds:', tournament.invitedUserIds, error)
          return NextResponse.json(
            { error: 'Invalid tournament invitation data' },
            { status: 500 }
          )
        }

        if (!Array.isArray(invitedIds) || !invitedIds.includes(userId)) {
          console.log(`[Join Tournament] User ${userId} is not in invited list: ${invitedIds.join(', ')}`)
          return NextResponse.json(
            { error: 'This is a private tournament and you are not invited' },
            { status: 403 }
          )
        }
        console.log(`[Join Tournament] User ${userId} is invited to private tournament`)
      } else {
        console.log(`[Join Tournament] User ${userId} is the creator of private tournament`)
      }
    } else {
      console.log(`[Join Tournament] Tournament "${tournament.name}" is public - allowing join`)
    }

    // Check if tournament is accepting registrations
    console.log(`[Join Tournament] Tournament status: ${tournament.status}`)
    if (tournament.status !== 'UPCOMING' && tournament.status !== 'REGISTRATION_OPEN') {
      console.log(`[Join Tournament] Tournament status "${tournament.status}" does not allow registrations`)
      return NextResponse.json(
        { error: 'Tournament is not accepting registrations' },
        { status: 400 }
      )
    }

    // Check if already registered
    const alreadyRegistered = tournament.participants.some((p) => p.userId === userId)
    if (alreadyRegistered) {
      return NextResponse.json(
        { error: 'You are already registered for this tournament' },
        { status: 400 }
      )
    }

    // Check if tournament is full
    if (tournament.participants.length >= tournament.maxParticipants) {
      return NextResponse.json(
        { error: 'Tournament is full' },
        { status: 400 }
      )
    }

    // Get user's ELO rating
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { eloRating: true },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Check ELO requirement
    if (tournament.minElo && user.eloRating < tournament.minElo) {
      return NextResponse.json(
        { error: `This tournament requires a minimum ELO of ${tournament.minElo}. Your ELO: ${user.eloRating}` },
        { status: 400 }
      )
    }

    // For Championship format, require position selection and check balance
    if (tournament.format === 'CHAMPIONSHIP') {
      if (!selectedPosition || (selectedPosition !== 'PRO' && selectedPosition !== 'CON')) {
        return NextResponse.json(
          { error: 'Championship format requires selecting a position (PRO or CON)' },
          { status: 400 }
        )
      }

      // Count participants by position
      const proCount = tournament.participants.filter((p) => p.selectedPosition === 'PRO').length
      const conCount = tournament.participants.filter((p) => p.selectedPosition === 'CON').length
      const maxPerPosition = tournament.maxParticipants / 2

      // Check if the selected position is full
      if (selectedPosition === 'PRO' && proCount >= maxPerPosition) {
        return NextResponse.json(
          { error: `PRO position is full (${proCount}/${maxPerPosition}). Please select CON.` },
          { status: 400 }
        )
      }

      if (selectedPosition === 'CON' && conCount >= maxPerPosition) {
        return NextResponse.json(
          { error: `CON position is full (${conCount}/${maxPerPosition}). Please select PRO.` },
          { status: 400 }
        )
      }
    }

    // Check entry fee and deduct coins if required
    if (tournament.entryFee && tournament.entryFee > 0) {
      if (user.eloRating < 0 || !user.eloRating) {
        // Get full user with coins
        const fullUser = await prisma.user.findUnique({
          where: { id: userId },
          select: { coins: true },
        })

        if (!fullUser || fullUser.coins < tournament.entryFee) {
          return NextResponse.json(
            {
              error: `Insufficient coins. Entry fee: ${tournament.entryFee}. Your balance: ${fullUser?.coins || 0}`,
            },
            { status: 400 }
          )
        }

        // Deduct entry fee and add to prize pool (transaction)
        await prisma.$transaction([
          prisma.user.update({
            where: { id: userId },
            data: { coins: { decrement: tournament.entryFee } },
          }),
          prisma.tournament.update({
            where: { id: tournamentId },
            data: { prizePool: { increment: tournament.entryFee } },
          }),
          prisma.coinTransaction.create({
            data: {
              userId,
              type: 'BELT_CHALLENGE_ENTRY',
              amount: -tournament.entryFee,
              balanceAfter: fullUser.coins - tournament.entryFee,
              description: `Entry fee for tournament: ${tournament.name}`,
              metadata: {
                tournamentId,
                entryFee: tournament.entryFee,
              },
            },
          }),
        ])

        console.log(
          `[Join Tournament] Deducted ${tournament.entryFee} coins entry fee from user ${userId}. Prize pool now: ${(tournament.prizePool || 0) + tournament.entryFee}`
        )
      }
    }

    // Get current participant count for seeding
    // Note: Creator is always seed 1, so new participants start at seed 2
    const participantCount = tournament.participants.length
    const nextSeed = participantCount + 1

    // Add participant
    await prisma.tournamentParticipant.create({
      data: {
        tournamentId,
        userId,
        seed: nextSeed, // Temporary seed, will be reseeded when tournament starts
        eloAtStart: user.eloRating, // Required field - store ELO at time of registration
        status: 'REGISTERED',
        selectedPosition: tournament.format === 'CHAMPIONSHIP' ? selectedPosition : null,
      },
    })

    console.log(`[Join Tournament] User ${userId} added as participant with seed ${nextSeed}`)

    // Update tournament status if needed
    // When status changes from UPCOMING to REGISTRATION_OPEN, record usage
    if (tournament.status === 'UPCOMING') {
      await prisma.tournament.update({
        where: { id: tournamentId },
        data: { status: 'REGISTRATION_OPEN' },
      })
      
      // Record usage now that tournament has started (status changed from UPCOMING)
      // This is when it counts against the user's limit
      await recordFeatureUsage(tournament.creatorId, FEATURES.TOURNAMENTS)
      console.log(`Tournament "${tournament.name}" status changed to REGISTRATION_OPEN - usage recorded for creator ${tournament.creatorId}`)
    }

    // Check if tournament is now full and should auto-start
    const updatedTournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
      include: {
        participants: true,
      },
    })

    if (updatedTournament && updatedTournament.participants.length >= updatedTournament.maxParticipants) {
      // Tournament is full - auto-start it
      console.log(`[Join Tournament] Tournament "${updatedTournament.name}" is full (${updatedTournament.participants.length}/${updatedTournament.maxParticipants}) - auto-starting...`)
      
      try {
        const { startTournament } = await import('@/lib/tournaments/match-generation')
        await startTournament(tournamentId)
        console.log(`[Join Tournament] Tournament "${updatedTournament.name}" started successfully`)
      } catch (error: any) {
        console.error(`[Join Tournament] Failed to auto-start tournament:`, error)
        // Don't fail the join request if auto-start fails - creator can start manually
      }
    }

    return NextResponse.json({ success: true, message: 'Successfully joined tournament' })
  } catch (error: any) {
    console.error('Failed to join tournament:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to join tournament' },
      { status: 500 }
    )
  }
}

