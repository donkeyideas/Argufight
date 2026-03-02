import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/auth/session-utils'
import { prisma } from '@/lib/db/prisma'
import { hashPassword } from '@/lib/auth/password'
import { put } from '@vercel/blob'

export const dynamic = 'force-dynamic'

// GET /api/admin/ai-users - List all AI users
export async function GET(request: NextRequest) {
  try {
    const userId = await verifyAdmin()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const aiUsers = await prisma.user.findMany({
      where: {
        isAI: true,
      },
      select: {
        id: true,
        username: true,
        email: true,
        avatarUrl: true,
        eloRating: true,
        totalDebates: true,
        debatesWon: true,
        debatesLost: true,
        aiPersonality: true,
        aiResponseDelay: true,
        aiPaused: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return NextResponse.json(aiUsers)
  } catch (error: any) {
    console.error('Failed to fetch AI users:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch AI users' },
      { status: 500 }
    )
  }
}

// POST /api/admin/ai-users - Create new AI user
export async function POST(request: NextRequest) {
  try {
    const userId = await verifyAdmin()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const username = formData.get('username') as string
    const aiPersonality = formData.get('aiPersonality') as string
    const aiResponseDelay = parseInt(formData.get('aiResponseDelay') as string)
    const aiPaused = formData.get('aiPaused') === 'true'
    const avatarUrl = formData.get('avatarUrl') as string | null
    const file = formData.get('file') as File | null

    if (!username || !aiPersonality || !aiResponseDelay) {
      return NextResponse.json(
        { error: 'Username, personality, and response delay are required' },
        { status: 400 }
      )
    }

    // Check if username already exists
    const existing = await prisma.user.findUnique({
      where: { username },
    })

    if (existing) {
      return NextResponse.json(
        { error: 'Username already taken' },
        { status: 409 }
      )
    }

    // Handle image upload
    let finalAvatarUrl = avatarUrl
    if (file) {
      const blob = await put(`ai-users/${username}-${Date.now()}`, file, {
        access: 'public',
      })
      finalAvatarUrl = blob.url
    }

    // Generate a dummy email and password for AI users
    const email = `ai-${username.toLowerCase().replace(/\s+/g, '-')}@argufight.ai`
    const passwordHash = await hashPassword(crypto.randomUUID()) // Random password, never used

    // Create AI user
    const aiUser = await prisma.user.create({
      data: {
        username: username.trim(),
        email,
        passwordHash,
        avatarUrl: finalAvatarUrl,
        isAI: true,
        aiPersonality,
        aiResponseDelay,
        aiPaused,
        eloRating: 1200, // Start at default ELO
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

    // Create FREE subscription for AI user
    await prisma.userSubscription.create({
      data: {
        userId: aiUser.id,
        tier: 'FREE',
        status: 'ACTIVE',
        billingCycle: null,
      },
    })

    return NextResponse.json({ aiUser }, { status: 201 })
  } catch (error: any) {
    console.error('Failed to create AI user:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create AI user' },
      { status: 500 }
    )
  }
}

