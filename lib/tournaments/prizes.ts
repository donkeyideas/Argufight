/**
 * Tournament Prize Distribution Logic
 * Distributes prizes to tournament winners based on prize pool and distribution
 */

import { prisma } from '@/lib/db/prisma'

interface PrizeDistribution {
  [key: string]: number // e.g., { "1st": 60, "2nd": 30, "3rd": 10 }
}

/**
 * Distribute tournament prizes to winners
 * Called when tournament status becomes COMPLETED
 */
export async function distributeTournamentPrizes(tournamentId: string): Promise<void> {
  try {
    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                coins: true,
              },
            },
          },
          where: {
            status: {
              in: ['ACTIVE', 'ELIMINATED'],
            },
          },
        },
      },
    })

    if (!tournament) {
      throw new Error(`Tournament ${tournamentId} not found`)
    }

    // Skip if no prize pool
    if (!tournament.prizePool || tournament.prizePool <= 0) {
      console.log(`[Prize Distribution] Tournament "${tournament.name}" has no prize pool - skipping`)
      return
    }

    // Parse prize distribution JSON
    let distribution: PrizeDistribution
    try {
      distribution = tournament.prizeDistribution
        ? JSON.parse(tournament.prizeDistribution)
        : { '1st': 60, '2nd': 30, '3rd': 10 } // Default distribution
    } catch (error) {
      console.error('[Prize Distribution] Invalid prize distribution JSON:', tournament.prizeDistribution)
      distribution = { '1st': 60, '2nd': 30, '3rd': 10 }
    }

    console.log(
      `[Prize Distribution] Starting distribution for tournament "${tournament.name}" - ` +
      `Prize Pool: ${tournament.prizePool} coins`
    )

    // Get final standings based on wins and seed
    // Sort by: wins DESC, then seed ASC (lower seed = higher initial ranking)
    const standings = [...tournament.participants].sort((a, b) => {
      if (b.wins !== a.wins) {
        return b.wins - a.wins
      }
      return (a.seed || 999) - (b.seed || 999)
    })

    // Distribute prizes
    const prizes: Array<{
      place: string
      userId: string
      username: string
      amount: number
    }> = []

    // 1st place
    if (standings.length >= 1 && distribution['1st']) {
      const amount = Math.floor((tournament.prizePool * distribution['1st']) / 100)
      const winner = standings[0]

      await prisma.$transaction([
        prisma.user.update({
          where: { id: winner.userId },
          data: {
            coins: {
              increment: amount,
            },
          },
        }),
        prisma.coinTransaction.create({
          data: {
            userId: winner.userId,
            type: 'BELT_TOURNAMENT_REWARD',
            amount,
            balanceAfter: winner.user.coins + amount,
            description: `1st place prize - Tournament: ${tournament.name}`,
            metadata: {
              tournamentId,
              place: '1st',
              percentage: distribution['1st'],
            },
          },
        }),
        prisma.notification.create({
          data: {
            userId: winner.userId,
            type: 'OTHER',
            title: '🏆 Tournament Victory!',
            message: `Congratulations! You won ${amount} coins for placing 1st in "${tournament.name}"`,
          },
        }),
      ])

      prizes.push({
        place: '1st',
        userId: winner.userId,
        username: winner.user.username,
        amount,
      })

      console.log(`[Prize Distribution] 1st place: ${winner.user.username} - ${amount} coins`)
    }

    // 2nd place
    if (standings.length >= 2 && distribution['2nd']) {
      const amount = Math.floor((tournament.prizePool * distribution['2nd']) / 100)
      const secondPlace = standings[1]

      await prisma.$transaction([
        prisma.user.update({
          where: { id: secondPlace.userId },
          data: {
            coins: {
              increment: amount,
            },
          },
        }),
        prisma.coinTransaction.create({
          data: {
            userId: secondPlace.userId,
            type: 'BELT_TOURNAMENT_REWARD',
            amount,
            balanceAfter: secondPlace.user.coins + amount,
            description: `2nd place prize - Tournament: ${tournament.name}`,
            metadata: {
              tournamentId,
              place: '2nd',
              percentage: distribution['2nd'],
            },
          },
        }),
        prisma.notification.create({
          data: {
            userId: secondPlace.userId,
            type: 'OTHER',
            title: '🥈 2nd Place!',
            message: `Great job! You won ${amount} coins for placing 2nd in "${tournament.name}"`,
          },
        }),
      ])

      prizes.push({
        place: '2nd',
        userId: secondPlace.userId,
        username: secondPlace.user.username,
        amount,
      })

      console.log(`[Prize Distribution] 2nd place: ${secondPlace.user.username} - ${amount} coins`)
    }

    // 3rd place
    if (standings.length >= 3 && distribution['3rd']) {
      const amount = Math.floor((tournament.prizePool * distribution['3rd']) / 100)
      const thirdPlace = standings[2]

      await prisma.$transaction([
        prisma.user.update({
          where: { id: thirdPlace.userId },
          data: {
            coins: {
              increment: amount,
            },
          },
        }),
        prisma.coinTransaction.create({
          data: {
            userId: thirdPlace.userId,
            type: 'BELT_TOURNAMENT_REWARD',
            amount,
            balanceAfter: thirdPlace.user.coins + amount,
            description: `3rd place prize - Tournament: ${tournament.name}`,
            metadata: {
              tournamentId,
              place: '3rd',
              percentage: distribution['3rd'],
            },
          },
        }),
        prisma.notification.create({
          data: {
            userId: thirdPlace.userId,
            type: 'OTHER',
            title: '🥉 3rd Place!',
            message: `Nice work! You won ${amount} coins for placing 3rd in "${tournament.name}"`,
          },
        }),
      ])

      prizes.push({
        place: '3rd',
        userId: thirdPlace.userId,
        username: thirdPlace.user.username,
        amount,
      })

      console.log(`[Prize Distribution] 3rd place: ${thirdPlace.user.username} - ${amount} coins`)
    }

    console.log(
      `[Prize Distribution] ✅ Distributed ${prizes.reduce((sum, p) => sum + p.amount, 0)} coins to ${prizes.length} winners`
    )
  } catch (error: any) {
    console.error('[Prize Distribution] Failed to distribute prizes:', error)
    throw error
  }
}
