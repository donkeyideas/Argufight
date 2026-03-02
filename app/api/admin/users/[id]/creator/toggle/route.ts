import { NextRequest, NextResponse } from 'next/server'
import { verifySession } from '@/lib/auth/session'
import { prisma } from '@/lib/db/prisma'
import { getUserIdFromSession } from '@/lib/auth/session-utils'
import { CreatorStatus } from '@prisma/client'

export const dynamic = 'force-dynamic'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await verifySession()
    const userId = getUserIdFromSession(session)
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if user is admin
    const adminUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { isAdmin: true },
    })

    if (!adminUser?.isAdmin) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      )
    }

    const { id } = await params
    const body = await request.json()
    const { enabled } = body

    if (typeof enabled !== 'boolean') {
      return NextResponse.json(
        { error: 'Invalid request: enabled must be a boolean' },
        { status: 400 }
      )
    }

    // Update user's creator status
    const user = await prisma.user.update({
      where: { id },
      data: {
        isCreator: enabled,
        creatorStatus: enabled ? CreatorStatus.BRONZE : null,
        creatorSince: enabled ? new Date() : null,
      },
    })

    return NextResponse.json(
      {
        success: true,
        message: `Creator mode ${enabled ? 'enabled' : 'disabled'} successfully`,
        user: {
          id: user.id,
          isCreator: user.isCreator,
          creatorStatus: user.creatorStatus,
        },
      },
      { status: 200 }
    )
  } catch (error: any) {
    console.error('[Creator Toggle API] Error:', error)
    
    // Handle Prisma errors
    if (error.code === 'P2025') {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(
      { error: error.message || 'Failed to toggle creator mode' },
      { status: 500 }
    )
  }
}
