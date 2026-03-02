import { NextRequest, NextResponse } from 'next/server'
import { verifySession } from '@/lib/auth/session'
import { prisma } from '@/lib/db/prisma'
import { getUserIdFromSession } from '@/lib/auth/session-utils'

// In-memory store for typing status (debateId -> Map<userId, timestamp>)
// In production, consider using Redis or a database table
const typingStatus = new Map<string, Map<string, number>>()

// Clean up stale typing status (older than 3 seconds)
const cleanupTypingStatus = () => {
  const now = Date.now()
  for (const [debateId, users] of typingStatus.entries()) {
    for (const [userId, timestamp] of users.entries()) {
      if (now - timestamp > 3000) {
        users.delete(userId)
      }
    }
    if (users.size === 0) {
      typingStatus.delete(debateId)
    }
  }
}

// Run cleanup every 2 seconds
setInterval(cleanupTypingStatus, 2000)

// POST /api/debates/[id]/chat/typing - Set typing status
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await verifySession()
    const userId = getUserIdFromSession(session)

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: debateId } = await params

    // Verify debate exists
    const debate = await prisma.debate.findUnique({
      where: { id: debateId },
      select: { id: true },
    })

    if (!debate) {
      return NextResponse.json({ error: 'Debate not found' }, { status: 404 })
    }

    // Update typing status
    if (!typingStatus.has(debateId)) {
      typingStatus.set(debateId, new Map())
    }
    const users = typingStatus.get(debateId)!
    users.set(userId, Date.now())

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to set typing status:', error)
    return NextResponse.json(
      { error: 'Failed to set typing status' },
      { status: 500 }
    )
  }
}

// GET /api/debates/[id]/chat/typing - Get who's typing
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await verifySession()
    const userId = getUserIdFromSession(session)

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: debateId } = await params

    // Verify debate exists
    const debate = await prisma.debate.findUnique({
      where: { id: debateId },
      select: { id: true },
    })

    if (!debate) {
      return NextResponse.json({ error: 'Debate not found' }, { status: 404 })
    }

    // Get typing users (excluding current user)
    const users = typingStatus.get(debateId)
    if (!users || users.size === 0) {
      return NextResponse.json({ typingUsers: [] })
    }

    // Filter out current user and stale entries (older than 3 seconds)
    const now = Date.now()
    const typingUserIds: string[] = []
    for (const [uid, timestamp] of users.entries()) {
      if (uid !== userId && now - timestamp <= 3000) {
        typingUserIds.push(uid)
      }
    }

    // Fetch user details for typing users
    if (typingUserIds.length === 0) {
      return NextResponse.json({ typingUsers: [] })
    }

    const typingUsers = await prisma.user.findMany({
      where: { id: { in: typingUserIds } },
      select: {
        id: true,
        username: true,
        avatarUrl: true,
      },
    })

    return NextResponse.json({ typingUsers })
  } catch (error) {
    console.error('Failed to get typing status:', error)
    return NextResponse.json(
      { error: 'Failed to get typing status' },
      { status: 500 }
    )
  }
}

