import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/auth/session-utils'
import { prisma } from '@/lib/db/prisma'
import { put } from '@vercel/blob'

export const dynamic = 'force-dynamic'

// PUT /api/admin/ai-users/[id] - Update AI user
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
    const formData = await request.formData()
    const aiPersonality = formData.get('aiPersonality') as string
    const aiResponseDelay = parseInt(formData.get('aiResponseDelay') as string)
    const aiPaused = formData.get('aiPaused') === 'true'
    const avatarUrl = formData.get('avatarUrl') as string | null
    const file = formData.get('file') as File | null

    // Verify this is an AI user
    const existing = await prisma.user.findUnique({
      where: { id },
      select: { isAI: true, username: true },
    })

    if (!existing || !existing.isAI) {
      return NextResponse.json(
        { error: 'AI user not found' },
        { status: 404 }
      )
    }

    // Handle image upload
    let finalAvatarUrl = avatarUrl
    if (file) {
      const blob = await put(`ai-users/${existing.username}-${Date.now()}`, file, {
        access: 'public',
      })
      finalAvatarUrl = blob.url
    }

    // Update AI user
    const updated = await prisma.user.update({
      where: { id },
      data: {
        avatarUrl: finalAvatarUrl !== null ? finalAvatarUrl : undefined,
        aiPersonality,
        aiResponseDelay,
        aiPaused,
      },
      select: {
        id: true,
        username: true,
        email: true,
        avatarUrl: true,
        aiPersonality: true,
        aiResponseDelay: true,
        aiPaused: true,
      },
    })

    return NextResponse.json({ aiUser: updated })
  } catch (error: any) {
    console.error('Failed to update AI user:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update AI user' },
      { status: 500 }
    )
  }
}

