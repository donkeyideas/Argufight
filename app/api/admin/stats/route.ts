import { NextRequest, NextResponse } from 'next/server'
import { verifySession } from '@/lib/auth/session'
import { prisma } from '@/lib/db/prisma'
import { getUserIdFromSession } from '@/lib/auth/session-utils'


export async function GET(request: NextRequest) {
  try {
    const session = await verifySession()

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify admin
    const userId = getUserIdFromSession(session)
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { isAdmin: true },
    })

    if (!user?.isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Fetch stats
    const [
      totalUsers,
      totalEmployees,
      totalDebates,
      activeDebates,
      completedToday,
    ] = await Promise.all([
      prisma.user.count({ where: { isAdmin: false } }), // Only count regular users, not employees
      prisma.user.count({ where: { isAdmin: true } }), // Count employees separately
      prisma.debate.count(),
      prisma.debate.count({ where: { status: 'ACTIVE' } }),
      prisma.debate.count({
        where: {
          status: 'VERDICT_READY',
          verdictDate: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
          },
        },
      }),
    ])

    return NextResponse.json({
      totalUsers,
      totalEmployees,
      totalDebates,
      activeDebates,
      completedToday,
    })
  } catch (error) {
    console.error('Failed to fetch admin stats:', error)
    return NextResponse.json(
      { error: 'Failed to fetch stats' },
      { status: 500 }
    )
  }
}

