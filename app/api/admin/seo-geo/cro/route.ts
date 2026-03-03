import { NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/auth/session-utils'
import { prisma } from '@/lib/db/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const userId = await verifyAdmin()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const now = new Date()
    const sixMonthsAgo = new Date(now)
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)
    sixMonthsAgo.setDate(1)
    sixMonthsAgo.setHours(0, 0, 0, 0)

    const [
      totalUsers,
      activeSubscriptions,
      totalDebates,
      completedDebates,
      recentUsers,
      recentDebates,
      topDebaters,
    ] = await Promise.all([
      prisma.user.count({ where: { isBanned: false } }),
      prisma.userSubscription.count({ where: { status: 'ACTIVE' } }),
      prisma.debate.count(),
      prisma.debate.count({ where: { status: { in: ['COMPLETED', 'VERDICT_READY'] } } }),
      // Monthly signups
      prisma.user.findMany({
        where: { createdAt: { gte: sixMonthsAgo } },
        select: { createdAt: true },
        orderBy: { createdAt: 'asc' },
      }),
      // Monthly debates
      prisma.debate.findMany({
        where: { createdAt: { gte: sixMonthsAgo } },
        select: { createdAt: true },
        orderBy: { createdAt: 'asc' },
      }),
      // Users who debated (unique challengers)
      prisma.debate.findMany({
        select: { challengerId: true, opponentId: true },
        distinct: ['challengerId'],
        take: 5000,
      }),
    ])

    // Count unique users who created at least 1 debate
    const uniqueDebaters = new Set([
      ...topDebaters.map((d) => d.challengerId),
      ...topDebaters.filter((d) => d.opponentId).map((d) => d.opponentId as string),
    ])
    const activatedUsers = uniqueDebaters.size

    // Build monthly buckets (last 6 months)
    const monthlyData: { month: string; signups: number; debates: number }[] = []
    for (let i = 5; i >= 0; i--) {
      const start = new Date(now)
      start.setMonth(start.getMonth() - i)
      start.setDate(1)
      start.setHours(0, 0, 0, 0)
      const end = new Date(start)
      end.setMonth(end.getMonth() + 1)

      const monthLabel = start.toLocaleString('en-US', { month: 'short', year: '2-digit' })
      const signups = recentUsers.filter((u) => u.createdAt >= start && u.createdAt < end).length
      const debates = recentDebates.filter((d) => d.createdAt >= start && d.createdAt < end).length
      monthlyData.push({ month: monthLabel, signups, debates })
    }

    // Funnel metrics
    const activationRate   = totalUsers > 0 ? Math.round((activatedUsers / totalUsers) * 100)  : 0
    const paidConvRate     = totalUsers > 0 ? Math.round((activeSubscriptions / totalUsers) * 100) : 0
    const debateCompRate   = totalDebates > 0 ? Math.round((completedDebates / totalDebates) * 100) : 0
    const avgDebatesPerUser = totalUsers > 0 ? Math.round((totalDebates / totalUsers) * 10) / 10 : 0

    // CRO Score (0–100): blend of activation, debate completion, paid conversion
    let score = 0
    score += Math.min(40, activationRate * 0.5)         // activation rate (max 40pts at 80%)
    score += Math.min(20, debateCompRate * 0.25)         // completion rate (max 20pts at 80%)
    score += Math.min(10, paidConvRate * 2)              // paid conversion (max 10pts at 5%)
    score += Math.min(10, Math.min(totalUsers / 100, 1) * 10)  // user base size (max 10pts at 100+ users)
    score += 20 // base score for having the funnel in place
    score = Math.round(Math.min(100, score))

    // CRO recommendations
    const recommendations: { priority: string; title: string; description: string }[] = []
    if (activationRate < 30) {
      recommendations.push({ priority: 'high', title: 'Improve onboarding to first debate', description: `Only ${activationRate}% of registered users have created a debate. Add an onboarding prompt or guided first-debate flow after signup.` })
    }
    if (debateCompRate < 50) {
      recommendations.push({ priority: 'high', title: 'Reduce debate abandonment', description: `${100 - debateCompRate}% of debates are never completed. Consider sending round-due reminders and reducing default round duration.` })
    }
    if (paidConvRate < 2) {
      recommendations.push({ priority: 'medium', title: 'Improve upgrade conversion', description: `Paid conversion is ${paidConvRate}%. Add upgrade prompts at natural friction points (e.g., after 3 debates, on the leaderboard).` })
    }
    if (avgDebatesPerUser < 2) {
      recommendations.push({ priority: 'medium', title: 'Increase debates per user', description: `Average ${avgDebatesPerUser} debates/user. Introduce daily challenge notifications, rematch prompts, and streak incentives.` })
    }

    // CTA optimisation checklist
    const ctas = [
      { page: 'Homepage',      cta: 'Get Started',          priority: 'high',   status: 'live' },
      { page: 'Homepage',      cta: 'Join Discussion',       priority: 'high',   status: 'live' },
      { page: 'Dashboard',     cta: 'Start a debate',        priority: 'high',   status: 'live' },
      { page: 'Dashboard',     cta: 'Daily Challenge',       priority: 'high',   status: 'live' },
      { page: 'Leaderboard',   cta: 'Challenge top debater', priority: 'medium', status: 'live' },
      { page: 'Debate result', cta: 'Rematch',               priority: 'medium', status: 'live' },
      { page: 'Upgrade page',  cta: 'Subscribe',             priority: 'high',   status: 'live' },
      { page: 'Post-signup',   cta: 'Start first debate',    priority: 'high',   status: 'live' },
    ]

    return NextResponse.json({
      croScore: score,
      funnel: {
        totalUsers,
        activatedUsers,
        activeSubscriptions,
        activationRate,
        paidConvRate,
      },
      debateMetrics: {
        totalDebates,
        completedDebates,
        debateCompRate,
        avgDebatesPerUser,
      },
      monthlyData,
      recommendations,
      ctas,
    })
  } catch (error) {
    console.error('[CRO] Error:', error)
    return NextResponse.json({ error: 'Failed to fetch CRO data' }, { status: 500 })
  }
}
