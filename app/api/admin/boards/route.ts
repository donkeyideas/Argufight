import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/auth/session-utils'
import { prisma } from '@/lib/db/prisma'

export const dynamic = 'force-dynamic'

// GET /api/admin/boards - Get all boards
export async function GET() {
  try {
    const userId = await verifyAdmin()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const boards = await prisma.board.findMany({
      where: { isArchived: false },
      include: {
        lists: {
          where: { isArchived: false },
          include: {
            cards: {
              where: { isArchived: false },
              include: {
                labels: true,
              },
              orderBy: { position: 'asc' },
            },
          },
          orderBy: { position: 'asc' },
        },
      },
      orderBy: { updatedAt: 'desc' },
    })

    return NextResponse.json({ boards })
  } catch (error: any) {
    console.error('Failed to fetch boards:', error)
    
    // Handle case where tables don't exist yet (migration not run)
    if (error?.code === 'P2021' || error?.code === '42P01' || error?.message?.includes('does not exist')) {
      return NextResponse.json({ boards: [] }, { status: 200 })
    }
    
    return NextResponse.json(
      { error: 'Failed to fetch boards', details: error?.message },
      { status: 500 }
    )
  }
}

// POST /api/admin/boards - Create a new board
export async function POST(request: Request) {
  try {
    const userId = await verifyAdmin()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { name, description, color } = body

    if (!name) {
      return NextResponse.json(
        { error: 'Board name is required' },
        { status: 400 }
      )
    }

    const board = await prisma.board.create({
      data: {
        name,
        description: description || null,
        color: color || '#0079bf',
      },
      include: {
        lists: {
          include: {
            cards: {
              include: {
                labels: true,
              },
            },
          },
        },
      },
    })

    return NextResponse.json({ board })
  } catch (error: any) {
    console.error('Failed to create board:', error)
    
    // Handle case where tables don't exist yet (migration not run)
    if (error?.code === 'P2021' || error?.code === '42P01' || error?.message?.includes('does not exist')) {
      return NextResponse.json(
        { error: 'Database migration required. Please run: npx prisma migrate deploy' },
        { status: 503 }
      )
    }
    
    return NextResponse.json(
      { error: 'Failed to create board', details: error?.message },
      { status: 500 }
    )
  }
}

