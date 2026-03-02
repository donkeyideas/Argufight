import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/auth/session-utils'
import { prisma } from '@/lib/db/prisma'

export const dynamic = 'force-dynamic'

// POST /api/admin/ai-users/[id]/toggle-pause - Toggle pause status
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

    // Get current pause status
    const aiUser = await prisma.user.findUnique({
      where: { id },
      select: { isAI: true, aiPaused: true },
    })

    if (!aiUser || !aiUser.isAI) {
      return NextResponse.json(
        { error: 'AI user not found' },
        { status: 404 }
      )
    }

    // Toggle pause
    const updated = await prisma.user.update({
      where: { id },
      data: {
        aiPaused: !aiUser.aiPaused,
      },
      select: {
        id: true,
        aiPaused: true,
      },
    })

    return NextResponse.json({ aiUser: updated })
  } catch (error: any) {
    console.error('Failed to toggle pause:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to toggle pause' },
      { status: 500 }
    )
  }
}

