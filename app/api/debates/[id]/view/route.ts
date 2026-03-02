import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'

// POST /api/debates/[id]/view - Track a view (increment view count)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Check if debate exists
    const debate = await prisma.debate.findUnique({
      where: { id },
      select: { id: true },
    })

    if (!debate) {
      return NextResponse.json({ error: 'Debate not found' }, { status: 404 })
    }

    // Increment view count atomically
    const updated = await prisma.debate.update({
      where: { id },
      data: {
        viewCount: {
          increment: 1,
        },
      },
      select: {
        viewCount: true,
      },
    })

    return NextResponse.json({ viewCount: updated.viewCount })
  } catch (error) {
    console.error('Failed to track view:', error)
    // Don't fail the request if view tracking fails
    return NextResponse.json({ error: 'Failed to track view' }, { status: 500 })
  }
}

// GET /api/debates/[id]/view - Get view count
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const debate = await prisma.debate.findUnique({
      where: { id },
      select: { viewCount: true },
    })

    if (!debate) {
      return NextResponse.json({ error: 'Debate not found' }, { status: 404 })
    }

    return NextResponse.json({ viewCount: debate.viewCount })
  } catch (error) {
    console.error('Failed to get view count:', error)
    return NextResponse.json({ error: 'Failed to get view count' }, { status: 500 })
  }
}










