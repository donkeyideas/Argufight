import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    // 1. Count ALL debates by status (no filters)
    const allCounts = await prisma.debate.groupBy({
      by: ['status'],
      _count: true,
    })

    // 2. Get ALL active/waiting debates (no privacy filter)
    const allActiveWaiting = await prisma.debate.findMany({
      where: { status: { in: ['ACTIVE', 'WAITING'] } },
      select: {
        id: true,
        topic: true,
        status: true,
        isPrivate: true,
        visibility: true,
        challengeType: true,
        isOnboardingDebate: true,
        opponentId: true,
        challenger: { select: { username: true } },
        opponent: { select: { username: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 30,
    })

    // 3. Test each filter individually
    const filterTests = await Promise.all([
      prisma.debate.count({
        where: { status: { in: ['ACTIVE', 'WAITING'] } },
      }),
      prisma.debate.count({
        where: { status: { in: ['ACTIVE', 'WAITING'] }, isPrivate: false },
      }),
      prisma.debate.count({
        where: { status: { in: ['ACTIVE', 'WAITING'] }, isPrivate: true },
      }),
      prisma.debate.count({
        where: { status: { in: ['ACTIVE', 'WAITING'] }, visibility: 'PUBLIC' },
      }),
      prisma.debate.count({
        where: { status: { in: ['ACTIVE', 'WAITING'] }, visibility: 'PRIVATE' },
      }),
      prisma.debate.count({
        where: {
          status: { in: ['ACTIVE', 'WAITING'] },
          OR: [{ isPrivate: false }, { visibility: 'PUBLIC' }],
        },
      }),
    ])

    return NextResponse.json({
      statusCounts: allCounts,
      filterTests: {
        'total_active_waiting': filterTests[0],
        'isPrivate_false': filterTests[1],
        'isPrivate_true': filterTests[2],
        'visibility_PUBLIC': filterTests[3],
        'visibility_PRIVATE': filterTests[4],
        'OR_filter (dashboard query)': filterTests[5],
      },
      debates: allActiveWaiting.map(d => ({
        id: d.id.substring(0, 8),
        topic: d.topic.substring(0, 50),
        status: d.status,
        isPrivate: d.isPrivate,
        visibility: d.visibility,
        challengeType: d.challengeType,
        isOnboarding: d.isOnboardingDebate,
        hasOpponent: !!d.opponentId,
        challenger: d.challenger?.username,
        opponent: d.opponent?.username,
      })),
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message, stack: error.stack?.substring(0, 500) }, { status: 500 })
  }
}
