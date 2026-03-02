import { prisma } from '@/lib/db/prisma'

interface StreakMilestone {
  days: number
  coins: number
  message: string
}

const STREAK_MILESTONES: StreakMilestone[] = [
  { days: 3, coins: 15, message: '3-Day Streak!' },
  { days: 7, coins: 40, message: 'Week Warrior!' },
  { days: 14, coins: 100, message: 'Two-Week Titan!' },
  { days: 30, coins: 250, message: 'Monthly Master!' },
]

// After 30 days, award 50 coins every 7 days
const ONGOING_INTERVAL = 7
const ONGOING_REWARD = 50

interface StreakResult {
  newStreak: number
  reward: { coins: number; message: string } | null
}

export async function updateDebateStreak(userId: string): Promise<StreakResult> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      debateStreak: true,
      longestDebateStreak: true,
      lastDebateDate: true,
      coins: true,
    },
  })

  if (!user) return { newStreak: 0, reward: null }

  const todayUTC = new Date()
  todayUTC.setUTCHours(0, 0, 0, 0)

  // Check if already counted today
  if (user.lastDebateDate) {
    const lastDate = new Date(user.lastDebateDate)
    lastDate.setUTCHours(0, 0, 0, 0)
    if (lastDate.getTime() === todayUTC.getTime()) {
      return { newStreak: user.debateStreak, reward: null }
    }
  }

  // Calculate new streak
  let newStreak: number
  const yesterdayUTC = new Date(todayUTC)
  yesterdayUTC.setUTCDate(yesterdayUTC.getUTCDate() - 1)

  if (user.lastDebateDate) {
    const lastDate = new Date(user.lastDebateDate)
    lastDate.setUTCHours(0, 0, 0, 0)
    if (lastDate.getTime() === yesterdayUTC.getTime()) {
      // Consecutive day — increment
      newStreak = user.debateStreak + 1
    } else {
      // Gap — reset to 1
      newStreak = 1
    }
  } else {
    // First ever debate day
    newStreak = 1
  }

  const newLongest = Math.max(newStreak, user.longestDebateStreak)

  // Check for milestone reward
  let reward: { coins: number; message: string } | null = null

  // Check fixed milestones (only award when exactly hitting the milestone)
  const milestone = STREAK_MILESTONES.find(m => m.days === newStreak)
  if (milestone) {
    reward = { coins: milestone.coins, message: milestone.message }
  }
  // Check ongoing rewards after 30 days
  else if (newStreak > 30 && (newStreak - 30) % ONGOING_INTERVAL === 0) {
    reward = { coins: ONGOING_REWARD, message: `${newStreak}-Day Streak!` }
  }

  // Update user streak data
  const updateData: any = {
    debateStreak: newStreak,
    longestDebateStreak: newLongest,
    lastDebateDate: todayUTC,
  }

  if (reward) {
    updateData.coins = { increment: reward.coins }
  }

  await prisma.user.update({
    where: { id: userId },
    data: updateData,
  })

  // Create coin transaction if reward earned
  if (reward) {
    try {
      await prisma.coinTransaction.create({
        data: {
          userId,
          type: 'DEBATE_STREAK_REWARD',
          status: 'COMPLETED',
          amount: reward.coins,
          balanceAfter: user.coins + reward.coins,
          description: reward.message,
        },
      })
    } catch {
      // Non-critical — streak still updated
    }
  }

  return { newStreak, reward }
}
