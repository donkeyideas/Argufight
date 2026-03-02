import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/auth/session-utils'
import { prisma } from '@/lib/db/prisma'

export const dynamic = 'force-dynamic'

// GET /api/admin/lists - Get all lists for a board
export async function GET(request: NextRequest) {
  try {
    const userId = await verifyAdmin()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const boardId = searchParams.get('boardId')

    if (!boardId) {
      return NextResponse.json(
        { error: 'boardId is required' },
        { status: 400 }
      )
    }

    const lists = await prisma.list.findMany({
      where: {
        boardId,
        isArchived: false,
      },
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
    })

    return NextResponse.json({ lists })
  } catch (error: any) {
    console.error('Failed to fetch lists:', error)
    
    // Handle case where tables don't exist yet (migration not run)
    if (error?.code === 'P2021' || error?.code === '42P01' || error?.message?.includes('does not exist')) {
      return NextResponse.json(
        { error: 'Database migration required. Please run: npx prisma migrate deploy' },
        { status: 503 }
      )
    }
    
    return NextResponse.json(
      { error: 'Failed to fetch lists', details: error?.message },
      { status: 500 }
    )
  }
}

// POST /api/admin/lists - Create a new list
export async function POST(request: Request) {
  try {
    const userId = await verifyAdmin()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { boardId, name, position } = body

    if (!boardId || !name) {
      return NextResponse.json(
        { error: 'boardId and name are required' },
        { status: 400 }
      )
    }

    // Get max position if not provided
    let listPosition = position
    if (listPosition === undefined) {
      const maxList = await prisma.list.findFirst({
        where: { boardId },
        orderBy: { position: 'desc' },
      })
      listPosition = maxList ? maxList.position + 1 : 0
    }

    const list = await prisma.list.create({
      data: {
        boardId,
        name,
        position: listPosition,
      },
      include: {
        cards: {
          include: {
            labels: true,
          },
        },
      },
    })

    return NextResponse.json({ list })
  } catch (error: any) {
    console.error('Failed to create list:', error)
    
    // Handle case where tables don't exist yet (migration not run)
    if (error?.code === 'P2021' || error?.code === '42P01' || error?.message?.includes('does not exist')) {
      return NextResponse.json(
        { error: 'Database migration required. Please run: npx prisma migrate deploy' },
        { status: 503 }
      )
    }
    
    return NextResponse.json(
      { error: 'Failed to create list', details: error?.message },
      { status: 500 }
    )
  }
}

