import { NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/auth/session-utils'
import { prisma } from '@/lib/db/prisma'

export const dynamic = 'force-dynamic'

// GET /api/admin/judges - Get all judges
export async function GET() {
  try {
    const userId = await verifyAdmin()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const judges = await prisma.judge.findMany({
      orderBy: {
        name: 'asc',
      },
      include: {
        _count: {
          select: {
            verdicts: true,
          },
        },
      },
    })

    return NextResponse.json({ judges })
  } catch (error) {
    console.error('Failed to fetch judges:', error)
    return NextResponse.json(
      { error: 'Failed to fetch judges' },
      { status: 500 }
    )
  }
}

// POST /api/admin/judges - Create a new judge
export async function POST(request: Request) {
  try {
    const userId = await verifyAdmin()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { name, personality, emoji, description, systemPrompt } = body

    if (!name || !personality || !description || !systemPrompt) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const judge = await prisma.judge.create({
      data: {
        name,
        personality,
        emoji: emoji || '', // Empty string if not provided (not displayed in UI)
        description,
        systemPrompt,
      },
    })

    return NextResponse.json({ judge }, { status: 201 })
  } catch (error: any) {
    console.error('Failed to create judge:', error)
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'A judge with this name already exists' },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: 'Failed to create judge' },
      { status: 500 }
    )
  }
}

