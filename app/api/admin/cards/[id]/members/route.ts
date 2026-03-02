import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/auth/session-utils'
import { prisma } from '@/lib/db/prisma'

export const dynamic = 'force-dynamic'

// POST /api/admin/cards/[id]/members - Add member to card
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await verifyAdmin()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const { userId: memberUserId } = body

    if (!memberUserId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }

    const member = await prisma.cardMember.create({
      data: {
        cardId: id,
        userId: memberUserId,
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
    })

    return NextResponse.json({ member })
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'Member already assigned' }, { status: 400 })
    }
    console.error('Failed to add member:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to add member' },
      { status: 500 }
    )
  }
}

// GET /api/admin/cards/[id]/members - Get all members for a card
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await verifyAdmin()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const members = await prisma.cardMember.findMany({
      where: { cardId: id },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
    })

    return NextResponse.json({ members })
  } catch (error: any) {
    console.error('Failed to fetch members:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch members' },
      { status: 500 }
    )
  }
}

