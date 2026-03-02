import { NextRequest, NextResponse } from 'next/server'
import { verifySession } from '@/lib/auth/session'
import { prisma } from '@/lib/db/prisma'
import { getUserIdFromSession } from '@/lib/auth/session-utils'

// POST /api/debates/[id]/share - Track a share of a debate
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
    const body = await request.json()
    const { method } = body // e.g., "copy_link", "twitter", "facebook", etc.

    // Check if debate exists
    const debate = await prisma.debate.findUnique({
      where: { id: debateId },
    })

    if (!debate) {
      return NextResponse.json({ error: 'Debate not found' }, { status: 404 })
    }

    // Track the share
    await prisma.debateShare.create({
      data: {
        debateId,
        userId,
        method: method || 'copy_link',
      },
    })

    // Generate share URL
    const shareUrl = `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/debate/${debateId}`

    return NextResponse.json({
      success: true,
      shareUrl,
      message: 'Share tracked',
    })
  } catch (error) {
    console.error('Share error:', error)
    return NextResponse.json(
      { error: 'Failed to track share' },
      { status: 500 }
    )
  }
}

// GET /api/debates/[id]/share - Get share count and URL
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: debateId } = await params

    // Check if debate exists
    const debate = await prisma.debate.findUnique({
      where: { id: debateId },
    })

    if (!debate) {
      return NextResponse.json({ error: 'Debate not found' }, { status: 404 })
    }

    const shareCount = await prisma.debateShare.count({
      where: { debateId },
    })

    const shareUrl = `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/debate/${debateId}`

    return NextResponse.json({
      count: shareCount,
      shareUrl,
    })
  } catch (error) {
    console.error('Get share error:', error)
    return NextResponse.json(
      { error: 'Failed to get share info' },
      { status: 500 }
    )
  }
}










