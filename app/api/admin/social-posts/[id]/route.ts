import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/auth/session-utils'
import { prisma } from '@/lib/db/prisma'

export const dynamic = 'force-dynamic'

// GET /api/admin/social-posts/[id] - Get a specific post
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

    const post = await prisma.socialMediaPost.findUnique({
      where: { id },
      include: {
        debate: {
          select: {
            id: true,
            topic: true,
            category: true,
            challenger: {
              select: {
                id: true,
                username: true,
                avatarUrl: true,
              },
            },
            opponent: {
              select: {
                id: true,
                username: true,
                avatarUrl: true,
              },
            },
          },
        },
      },
    })

    if (!post) {
      return NextResponse.json(
        { error: 'Post not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ post })
  } catch (error: any) {
    console.error('Failed to fetch social post:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch social post' },
      { status: error.status || 500 }
    )
  }
}

// PUT /api/admin/social-posts/[id] - Update a post
export async function PUT(
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
    const { content, imagePrompt, hashtags, status, scheduledAt } = body

    const updateData: any = {}
    if (content !== undefined) updateData.content = content.trim()
    if (imagePrompt !== undefined) updateData.imagePrompt = imagePrompt?.trim() || null
    if (hashtags !== undefined) updateData.hashtags = hashtags?.trim() || null
    if (status !== undefined) updateData.status = status
    if (scheduledAt !== undefined) updateData.scheduledAt = scheduledAt ? new Date(scheduledAt) : null

    const post = await prisma.socialMediaPost.update({
      where: { id },
      data: updateData,
      include: {
        debate: {
          select: {
            id: true,
            topic: true,
            category: true,
          },
        },
      },
    })

    return NextResponse.json({ post })
  } catch (error: any) {
    console.error('Failed to update social post:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update social post' },
      { status: error.status || 500 }
    )
  }
}

// DELETE /api/admin/social-posts/[id] - Delete a post
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await verifyAdmin()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    await prisma.socialMediaPost.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Failed to delete social post:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to delete social post' },
      { status: error.status || 500 }
    )
  }
}

