import { NextRequest, NextResponse } from 'next/server'
import { verifySession } from '@/lib/auth/session'
import { prisma } from '@/lib/db/prisma'
import { getUserIdFromSession } from '@/lib/auth/session-utils'

// GET /api/notifications - Get user notifications
export async function GET(request: NextRequest) {
  try {
    const session = await verifySession()
    const userId = getUserIdFromSession(session)

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const unreadOnly = searchParams.get('unreadOnly') === 'true'
    const limit = parseInt(searchParams.get('limit') || '50')

    const where: any = { userId }
    if (unreadOnly) {
      where.read = false
    }

    // Use Prisma's regular query (fallback already works, so use it directly)
    try {
      console.log('Fetching notifications for user:', userId, 'unreadOnly:', unreadOnly)
      
      const notifications = await prisma.notification.findMany({
        where,
        include: {
          debate: {
            select: {
              id: true,
              topic: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: limit,
      })
      
      // Map to expected format
      const mappedNotifications = notifications.map(n => ({
        id: n.id,
        userId: n.userId,
        type: n.type,
        title: n.title,
        message: n.message,
        debateId: n.debateId,
        debate: n.debate,
        read: n.read,
        readAt: n.readAt,
        createdAt: n.createdAt,
      }))
      
      console.log(`[API /notifications] Returning ${mappedNotifications.length} notifications`)
      if (mappedNotifications.length > 0) {
        console.log(`[API /notifications] Sample notification:`, {
          id: mappedNotifications[0].id,
          title: mappedNotifications[0].title,
          type: mappedNotifications[0].type,
          read: mappedNotifications[0].read,
        })
      }
      
      return NextResponse.json(mappedNotifications)
    } catch (error: any) {
      console.error('[API /notifications] Error fetching notifications:', error)
      return NextResponse.json(
        { error: 'Failed to fetch notifications' },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('Failed to fetch notifications:', error)
    return NextResponse.json(
      { error: 'Failed to fetch notifications' },
      { status: 500 }
    )
  }
}

