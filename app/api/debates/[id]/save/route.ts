import { NextRequest, NextResponse } from 'next/server'
import { verifySession } from '@/lib/auth/session'
import { prisma } from '@/lib/db/prisma'
import { getUserIdFromSession } from '@/lib/auth/session-utils'

// POST /api/debates/[id]/save - Toggle save/bookmark on a debate
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

    // Check if debate exists
    const debate = await prisma.debate.findUnique({
      where: { id: debateId },
    })

    if (!debate) {
      return NextResponse.json({ error: 'Debate not found' }, { status: 404 })
    }

    // Check if already saved
    const existingSave = await prisma.debateSave.findUnique({
      where: {
        debateId_userId: {
          debateId,
          userId,
        },
      },
    })

    if (existingSave) {
      // Unsave
      await prisma.debateSave.delete({
        where: { id: existingSave.id },
      })

      return NextResponse.json({
        success: true,
        saved: false,
        message: 'Debate unsaved',
      })
    } else {
      // Save
      await prisma.debateSave.create({
        data: {
          debateId,
          userId,
        },
      })

      return NextResponse.json({
        success: true,
        saved: true,
        message: 'Debate saved',
      })
    }
  } catch (error) {
    console.error('Save error:', error)
    return NextResponse.json(
      { error: 'Failed to toggle save' },
      { status: 500 }
    )
  }
}

// GET /api/debates/[id]/save - Check if user has saved this debate
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await verifySession()
    const userId = getUserIdFromSession(session)

    if (!userId) {
      return NextResponse.json({ saved: false })
    }

    const { id: debateId } = await params

    const isSaved = await prisma.debateSave.findUnique({
      where: {
        debateId_userId: {
          debateId,
          userId,
        },
      },
    })

    return NextResponse.json({
      saved: !!isSaved,
    })
  } catch (error) {
    console.error('Get save error:', error)
    return NextResponse.json(
      { error: 'Failed to get save status' },
      { status: 500 }
    )
  }
}










