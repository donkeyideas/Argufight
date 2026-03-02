/**
 * Coin economics for belt system
 * Handles coin transactions for challenges, rewards, and belt creation
 */

import { prisma } from '@/lib/db/prisma'
import { getBeltSettings } from './core'

// Feature flag check
function isBeltSystemEnabled(): boolean {
  return process.env.ENABLE_BELT_SYSTEM === 'true'
}

/**
 * Calculate entry fee for a belt challenge
 */
export async function calculateChallengeEntryFee(beltId: string): Promise<number> {
  if (!isBeltSystemEnabled()) {
    return 0
  }

  const belt = await prisma.belt.findUnique({
    where: { id: beltId },
  })

  if (!belt) {
    throw new Error('Belt not found')
  }

  const settings = await getBeltSettings(belt.type)

  // Base fee * multiplier based on belt value
  const entryFee = Math.floor(
    settings.entryFeeBase * settings.entryFeeMultiplier * (belt.coinValue / 1000 + 1)
  )

  return entryFee
}

/**
 * Calculate coin rewards for a belt challenge
 */
export async function calculateChallengeRewards(
  entryFee: number,
  beltType: string
): Promise<{
  winnerReward: number
  loserConsolation: number
  platformFee: number
}> {
  const settings = await getBeltSettings(beltType as any)

  const winnerReward = Math.floor(entryFee * (settings.winnerRewardPercent / 100))
  const loserConsolation = Math.floor(entryFee * (settings.loserConsolationPercent / 100))
  const platformFee = entryFee - winnerReward - loserConsolation

  return {
    winnerReward,
    loserConsolation,
    platformFee,
  }
}

/**
 * Process coin transactions for a completed belt challenge
 */
export async function processBeltChallengeCoins(
  challengeId: string,
  winnerId: string
) {
  if (!isBeltSystemEnabled()) {
    return
  }

  const challenge = await prisma.beltChallenge.findUnique({
    where: { id: challengeId },
    include: {
      belt: true,
      challenger: true,
      beltHolder: true,
    },
  })

  if (!challenge) {
    throw new Error('Challenge not found')
  }

  const rewards = await calculateChallengeRewards(
    challenge.entryFee,
    challenge.belt.type
  )

  const loserId =
    winnerId === challenge.challengerId
      ? challenge.beltHolderId
      : challenge.challengerId

  // Process coin rewards
  await Promise.all([
    // Winner gets reward
    addCoins(winnerId, rewards.winnerReward, {
      type: 'BELT_CHALLENGE_REWARD',
      description: `Won belt challenge - ${challenge.belt.name}`,
      beltChallengeId: challengeId,
      beltId: challenge.beltId,
      metadata: {
        challengeId,
        beltName: challenge.belt.name,
        beltType: challenge.belt.type,
      },
    }),
    // Loser gets consolation
    addCoins(loserId, rewards.loserConsolation, {
      type: 'BELT_CHALLENGE_CONSOLATION',
      description: `Lost belt challenge - ${challenge.belt.name}`,
      beltChallengeId: challengeId,
      beltId: challenge.beltId,
      metadata: {
        challengeId,
        beltName: challenge.belt.name,
        beltType: challenge.belt.type,
      },
    }),
    // Platform fee (stored in a special platform account or tracked separately)
    // For now, we'll log it. In the future, you might want a platform account
    Promise.resolve().then(() => {
      console.log('[Belt Coins] Platform fee:', {
        challengeId,
        platformFee: rewards.platformFee,
        beltId: challenge.beltId,
      })
      // TODO: If you have a platform account, add coins to it:
      // await addCoins('platform-account-id', rewards.platformFee, {
      //   type: 'PLATFORM_FEE',
      //   beltChallengeId: challengeId,
      //   beltId: challenge.beltId,
      // })
    }),
  ])
}

/**
 * Deduct coins from user
 * @throws Error if insufficient balance
 */
export async function deductCoins(
  userId: string,
  amount: number,
  options?: {
    type: 'BELT_CHALLENGE_ENTRY' | 'BELT_TOURNAMENT_CREATION' | 'ADMIN_DEDUCT' | 'REFUND'
    description?: string
    beltChallengeId?: string
    beltId?: string
    tournamentId?: string
    metadata?: Record<string, any>
  }
): Promise<number> {
  if (amount <= 0) {
    throw new Error('Amount must be positive')
  }

  // Get current balance
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { coins: true },
  })

  if (!user) {
    throw new Error('User not found')
  }

  if (user.coins < amount) {
    throw new Error('Insufficient coins')
  }

  const newBalance = user.coins - amount

  // Update user balance and create transaction record in a transaction
  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: { coins: newBalance },
    })

    await tx.coinTransaction.create({
      data: {
        userId,
        type: options?.type || 'ADMIN_DEDUCT',
        status: 'COMPLETED',
        amount: -amount, // Negative for deduction
        balanceAfter: newBalance,
        description: options?.description || `Deducted ${amount} coins`,
        beltChallengeId: options?.beltChallengeId,
        beltId: options?.beltId,
        tournamentId: options?.tournamentId,
        metadata: options?.metadata,
      },
    })
  })

  return newBalance
}

/**
 * Add coins to user
 */
export async function addCoins(
  userId: string,
  amount: number,
  options?: {
    type: 'BELT_CHALLENGE_REWARD' | 'BELT_CHALLENGE_CONSOLATION' | 'BELT_TOURNAMENT_REWARD' | 'ADMIN_GRANT' | 'REFUND' | 'PLATFORM_FEE' | 'COIN_PURCHASE'
    description?: string
    beltChallengeId?: string
    beltId?: string
    tournamentId?: string
    debateId?: string
    metadata?: Record<string, any>
  }
): Promise<number> {
  if (amount <= 0) {
    throw new Error('Amount must be positive')
  }

  // Get current balance
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { coins: true },
  })

  if (!user) {
    throw new Error('User not found')
  }

  const newBalance = user.coins + amount

  // Update user balance and create transaction record in a transaction
  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: { coins: newBalance },
    })

    await tx.coinTransaction.create({
      data: {
        userId,
        type: options?.type || 'ADMIN_GRANT',
        status: 'COMPLETED',
        amount, // Positive for addition
        balanceAfter: newBalance,
        description: options?.description || `Added ${amount} coins`,
        beltChallengeId: options?.beltChallengeId,
        beltId: options?.beltId,
        tournamentId: options?.tournamentId,
        debateId: options?.debateId,
        metadata: options?.metadata,
      },
    })
  })

  return newBalance
}
