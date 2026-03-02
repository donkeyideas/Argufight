/**
 * API Route: POST /api/admin/belts/[id]/transfer
 * Admin-only belt transfer
 */

import { NextRequest, NextResponse } from 'next/server'
import { verifySessionWithDb } from '@/lib/auth/session-verify'
import { prisma } from '@/lib/db/prisma'
import { transferBelt } from '@/lib/belts/core'

export const dynamic = 'force-dynamic'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await verifySessionWithDb()
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is admin
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { isAdmin: true },
    })

    if (!user?.isAdmin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    // Check feature flag
    if (process.env.ENABLE_BELT_SYSTEM !== 'true') {
      return NextResponse.json({ error: 'Belt system is not enabled' }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()
    const { toUserId, reason, adminNotes } = body

    if (!toUserId) {
      return NextResponse.json({ error: 'toUserId is required' }, { status: 400 })
    }

    // Check if toUserId is a UUID (user ID) or username
    // UUID format: 8-4-4-4-12 hex characters
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(toUserId.trim())
    
    // Find user by ID or username
    const targetUser = isUUID
      ? await prisma.user.findUnique({
          where: { id: toUserId.trim() },
          select: { id: true, username: true },
        })
      : await prisma.user.findUnique({
          where: { username: toUserId.trim() },
          select: { id: true, username: true },
        })

    if (!targetUser) {
      return NextResponse.json(
        { error: `User "${toUserId}" not found. Please check the user ID or username and try again.` },
        { status: 404 }
      )
    }

    // Use the actual user ID for the transfer
    const actualUserId = targetUser.id

    // Get current belt holder
    const belt = await prisma.belt.findUnique({
      where: { id },
      select: { currentHolderId: true },
    })

    if (!belt) {
      return NextResponse.json({ error: 'Belt not found' }, { status: 404 })
    }

    // Transfer belt (use the actual user ID)
    const result = await transferBelt(
      id,
      belt.currentHolderId,
      actualUserId,
      reason || 'ADMIN_TRANSFER',
      {
        adminNotes: adminNotes || `Admin transfer to ${targetUser.username}`,
        transferredBy: session.userId,
      }
    )

    return NextResponse.json({ success: true, belt: result.belt, history: result.history })
  } catch (error: any) {
    console.error('[API] Error transferring belt:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to transfer belt' },
      { status: 500 }
    )
  }
}
