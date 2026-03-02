import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/auth/session-utils'
import { prisma } from '@/lib/db/prisma'


// GET /api/admin/support/tickets/unread-count - Get count of unread/unreplied support tickets
export async function GET(request: NextRequest) {
  try {
    const userId = await verifyAdmin()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Count tickets that are OPEN and have no admin replies
    const unreadCount = await prisma.supportTicket.count({
      where: {
        status: 'OPEN',
        replies: {
          none: {
            author: {
              isAdmin: true,
            },
          },
        },
      },
    })

    return NextResponse.json({ unreadCount })
  } catch (error) {
    console.error('Failed to fetch unread ticket count:', error)
    return NextResponse.json(
      { error: 'Failed to fetch unread ticket count' },
      { status: 500 }
    )
  }
}

