/**
 * Tournament belt logic
 * Handles belt creation for tournaments and belt staking in tournaments
 */

import { prisma } from '@/lib/db/prisma'
import { getBeltSettings, createBelt } from './core'
import { deductCoins } from './coin-economics'

// Feature flag check
function isBeltSystemEnabled(): boolean {
  return process.env.ENABLE_BELT_SYSTEM === 'true'
}

/**
 * Create a belt for a tournament
 */
export async function createTournamentBelt(
  tournamentId: string,
  userId: string,
  coinsPaid: number
) {
  if (!isBeltSystemEnabled()) {
    throw new Error('Belt system is not enabled')
  }

  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    include: {
      participants: {
        include: {
          user: {
            select: {
              id: true,
              username: true,
            },
          },
        },
      },
    },
  })

  if (!tournament) {
    throw new Error('Tournament not found')
  }

  if (tournament.beltCreated) {
    throw new Error('Tournament already has a belt')
  }

  // Get appropriate cost based on tournament size
  const settings = await getBeltSettings('TOURNAMENT')
  let expectedCost: number

  if (tournament.maxParticipants <= 8) {
    expectedCost = settings.tournamentBeltCostSmall
  } else if (tournament.maxParticipants <= 16) {
    expectedCost = settings.tournamentBeltCostMedium
  } else {
    expectedCost = settings.tournamentBeltCostLarge
  }

  if (coinsPaid < expectedCost) {
    throw new Error(
      `Insufficient coins. Required: ${expectedCost}, provided: ${coinsPaid}`
    )
  }

  // Deduct coins from user
  try {
    await deductCoins(userId, coinsPaid, {
      type: 'BELT_TOURNAMENT_CREATION',
      description: `Created tournament belt for ${tournament.name}`,
      tournamentId,
      metadata: {
        tournamentName: tournament.name,
        tournamentSize: tournament.maxParticipants,
        expectedCost,
        coinsPaid,
      },
    })
  } catch (error: any) {
    if (error.message === 'Insufficient coins') {
      throw new Error(`Insufficient coins. Required: ${expectedCost} coins.`)
    }
    throw error
  }

  // Create belt
  const belt = await createBelt({
    name: `${tournament.name} Championship Belt`,
    type: 'TOURNAMENT',
    category: undefined,
    tournamentId,
    creationCost: coinsPaid,
    createdBy: userId,
  })

  // Update tournament
  await prisma.tournament.update({
    where: { id: tournamentId },
    data: {
      beltCreated: true,
      beltCreationCost: coinsPaid,
      beltCreatedBy: userId,
    },
  })

  return belt
}

/**
 * Stake a belt in a tournament
 */
export async function stakeBeltInTournament(
  beltId: string,
  tournamentId: string,
  userId: string
) {
  if (!isBeltSystemEnabled()) {
    throw new Error('Belt system is not enabled')
  }

  const belt = await prisma.belt.findUnique({
    where: { id: beltId },
  })

  if (!belt) {
    throw new Error('Belt not found')
  }

  if (belt.currentHolderId !== userId) {
    throw new Error('You do not own this belt')
  }

  if (belt.isStaked) {
    throw new Error('Belt is already staked')
  }

  if (belt.status !== 'ACTIVE' && belt.status !== 'MANDATORY') {
    throw new Error(`Cannot stake belt with status: ${belt.status}`)
  }

  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
  })

  if (!tournament) {
    throw new Error('Tournament not found')
  }

  if (tournament.status !== 'IN_PROGRESS') {
    throw new Error('Tournament is not in progress')
  }

  // Check if user is in tournament
  const participant = await prisma.tournamentParticipant.findFirst({
    where: {
      tournamentId,
      userId,
      status: 'ACTIVE',
    },
  })

  if (!participant) {
    throw new Error('You are not a participant in this tournament')
  }

  // Update belt
  await prisma.belt.update({
    where: { id: beltId },
    data: {
      isStaked: true,
      stakedInTournamentId: tournamentId,
      status: 'STAKED',
    },
  })

  // Update debate to indicate belt is at stake
  // This will be handled when debates are created for tournament matches

  return belt
}

/**
 * Process belt transfer after tournament completion
 */
export async function processTournamentBeltTransfer(
  tournamentId: string,
  winnerId: string
) {
  if (!isBeltSystemEnabled()) {
    return // Silently skip if disabled
  }

  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    include: {
      tournamentBelt: {
        include: { currentHolder: true },
      },
      stakedBelts: {
        include: { currentHolder: true },
      },
    },
  })

  if (!tournament) {
    throw new Error('Tournament not found')
  }

  // Transfer tournament belt if it exists
  if (tournament.tournamentBelt) {
    const belt = tournament.tournamentBelt
    const fromUserId = belt.currentHolderId

    if (fromUserId && fromUserId !== winnerId) {
      // Calculate days held
      const acquiredAt = belt.acquiredAt || new Date()
      const daysHeld = Math.floor(
        (Date.now() - acquiredAt.getTime()) / (24 * 60 * 60 * 1000)
      )

      const { transferBelt } = await import('./core')
      await transferBelt(
        belt.id,
        fromUserId,
        winnerId,
        'TOURNAMENT_WIN',
        {
          tournamentId,
          daysHeld,
          defensesWon: belt.successfulDefenses,
          defensesLost: belt.timesDefended - belt.successfulDefenses,
        }
      )
    } else if (!fromUserId) {
      // Belt is vacant, award to winner
      const { transferBelt } = await import('./core')
      await transferBelt(belt.id, null, winnerId, 'TOURNAMENT_WIN', {
        tournamentId,
        daysHeld: 0,
        defensesWon: 0,
        defensesLost: 0,
      })
    }
  }

  // Transfer all staked belts
  for (const belt of tournament.stakedBelts) {
    if (belt.currentHolderId && belt.currentHolderId !== winnerId) {
      const acquiredAt = belt.acquiredAt || new Date()
      const daysHeld = Math.floor(
        (Date.now() - acquiredAt.getTime()) / (24 * 60 * 60 * 1000)
      )

      const { transferBelt } = await import('./core')
      await transferBelt(
        belt.id,
        belt.currentHolderId,
        winnerId,
        'TOURNAMENT_WIN',
        {
          tournamentId,
          daysHeld,
          defensesWon: belt.successfulDefenses,
          defensesLost: belt.timesDefended - belt.successfulDefenses,
        }
      )

      // Unstake belt
      await prisma.belt.update({
        where: { id: belt.id },
        data: {
          isStaked: false,
          stakedInTournamentId: null,
          status: 'ACTIVE',
          lastDefendedAt: new Date(),
          timesDefended: {
            increment: 1,
          },
        },
      })
    }
  }
}
