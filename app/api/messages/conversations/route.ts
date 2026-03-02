import { NextRequest, NextResponse } from 'next/server'
import { verifySession } from '@/lib/auth/session'
import { prisma } from '@/lib/db/prisma'
import { getUserIdFromSession } from '@/lib/auth/session-utils'

// GET /api/messages/conversations - Get user's conversations
export async function GET(request: NextRequest) {
  try {
    const session = await verifySession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = getUserIdFromSession(session)
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const conversations = await prisma.conversation.findMany({
      where: {
        OR: [
          { user1Id: userId },
          { user2Id: userId },
        ],
      },
      select: {
        id: true,
        user1Id: true,
        user2Id: true,
        lastMessageAt: true,
        user1LastReadAt: true,
        user2LastReadAt: true,
        user1: {
          select: {
            id: true,
            username: true,
            avatarUrl: true,
          },
        },
        user2: {
          select: {
            id: true,
            username: true,
            avatarUrl: true,
          },
        },
        messages: {
          take: 1,
          orderBy: {
            createdAt: 'desc',
          },
          select: {
            id: true,
            content: true,
            createdAt: true,
          },
        },
      },
      orderBy: {
        lastMessageAt: 'desc',
      },
    })

    // Get unread counts for each conversation
    const conversationsWithUnread = await Promise.all(
      conversations.map(async (conv) => {
        const otherUserId = conv.user1Id === userId ? conv.user2Id : conv.user1Id
        const lastReadAt = conv.user1Id === userId 
          ? conv.user1LastReadAt 
          : conv.user2LastReadAt

        const unreadCount = await prisma.directMessage.count({
          where: {
            conversationId: conv.id,
            receiverId: userId,
            isRead: false,
            createdAt: lastReadAt ? { gt: lastReadAt } : undefined,
          },
        })

        return {
          ...conv,
          unreadCount,
          otherUser: conv.user1Id === userId ? conv.user2 : conv.user1,
        }
      })
    )

    return NextResponse.json({ conversations: conversationsWithUnread })
  } catch (error) {
    console.error('Failed to fetch conversations:', error)
    return NextResponse.json(
      { error: 'Failed to fetch conversations' },
      { status: 500 }
    )
  }
}

// POST /api/messages/conversations - Create or get conversation with a user
export async function POST(request: NextRequest) {
  try {
    const session = await verifySession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = getUserIdFromSession(session)
    if (!userId) {
      console.error('POST /api/messages/conversations: No userId from session')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { otherUserId } = body

    if (!otherUserId) {
      return NextResponse.json(
        { error: 'otherUserId is required' },
        { status: 400 }
      )
    }

    if (otherUserId === userId) {
      return NextResponse.json(
        { error: 'Cannot create conversation with yourself' },
        { status: 400 }
      )
    }

    // Verify other user exists
    const otherUser = await prisma.user.findUnique({
      where: { id: otherUserId },
      select: { id: true },
    })

    if (!otherUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Always put smaller ID first for consistency (matches unique constraint)
    const [user1Id, user2Id] = userId < otherUserId 
      ? [userId, otherUserId]
      : [otherUserId, userId]

    // Check if conversation already exists (using sorted IDs)
    const existing = await prisma.conversation.findUnique({
      where: {
        user1Id_user2Id: {
          user1Id,
          user2Id,
        },
      },
      select: {
        id: true,
        user1Id: true,
        user2Id: true,
        lastMessageAt: true,
        user1LastReadAt: true,
        user2LastReadAt: true,
        user1: {
          select: {
            id: true,
            username: true,
            avatarUrl: true,
          },
        },
        user2: {
          select: {
            id: true,
            username: true,
            avatarUrl: true,
          },
        },
      },
    })

    if (existing) {
      return NextResponse.json({ conversation: existing })
    }

    // Create new conversation
    try {
      const conversation = await prisma.conversation.create({
        data: {
          user1Id,
          user2Id,
        },
        select: {
          id: true,
          user1Id: true,
          user2Id: true,
          lastMessageAt: true,
          user1LastReadAt: true,
          user2LastReadAt: true,
          user1: {
            select: {
              id: true,
              username: true,
              avatarUrl: true,
            },
          },
          user2: {
            select: {
              id: true,
              username: true,
              avatarUrl: true,
            },
          },
        },
      })

      return NextResponse.json({ conversation }, { status: 201 })
    } catch (createError: any) {
      // If conversation already exists (race condition), fetch it
      if (createError?.code === 'P2002' || createError?.message?.includes('Unique constraint')) {
        const existing = await prisma.conversation.findUnique({
          where: {
            user1Id_user2Id: {
              user1Id,
              user2Id,
            },
          },
          select: {
            id: true,
            user1Id: true,
            user2Id: true,
            lastMessageAt: true,
            user1LastReadAt: true,
            user2LastReadAt: true,
            user1: {
              select: {
                id: true,
                username: true,
                avatarUrl: true,
              },
            },
            user2: {
              select: {
                id: true,
                username: true,
                avatarUrl: true,
              },
            },
          },
        })

        if (existing) {
          return NextResponse.json({ conversation: existing })
        }
      }
      throw createError
    }
  } catch (error: any) {
    console.error('Failed to create conversation:', error)
    console.error('Error details:', {
      message: error?.message,
      code: error?.code,
      meta: error?.meta,
      stack: error?.stack,
    })
    
    // Provide more specific error messages
    let errorMessage = 'Failed to create conversation'
    if (error?.code === 'P2002') {
      errorMessage = 'Conversation already exists'
    } else if (error?.message) {
      errorMessage = error.message
    }
    
    return NextResponse.json(
      { 
        error: errorMessage,
        details: process.env.NODE_ENV === 'development' ? error?.message : undefined,
      },
      { status: 500 }
    )
  }
}

