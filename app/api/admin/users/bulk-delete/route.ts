import { NextRequest, NextResponse } from 'next/server'
import { verifySession } from '@/lib/auth/session'
import { prisma } from '@/lib/db/prisma'
import { getUserIdFromSession } from '@/lib/auth/session-utils'

export const dynamic = 'force-dynamic'

// POST /api/admin/users/bulk-delete - Delete multiple users (admin only)
export async function POST(request: NextRequest) {
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

    const body = await request.json()
    const { userIds } = body

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return NextResponse.json(
        { error: 'User IDs array is required' },
        { status: 400 }
      )
    }

    // Prevent admin from deleting themselves
    if (userIds.includes(userId)) {
      return NextResponse.json(
        { error: 'You cannot delete your own account' },
        { status: 400 }
      )
    }

    // Verify all users exist and get their info
    const users = await prisma.user.findMany({
      where: {
        id: { in: userIds },
      },
      select: {
        id: true,
        username: true,
        email: true,
        isAdmin: true,
      },
    })

    if (users.length !== userIds.length) {
      return NextResponse.json(
        { error: 'Some users were not found' },
        { status: 404 }
      )
    }

    // Log admin deletions
    const adminUsers = users.filter(u => u.isAdmin)
    if (adminUsers.length > 0) {
      console.warn(`[ADMIN] Admin users being deleted: ${adminUsers.map(u => `${u.username} (${u.email})`).join(', ')} by admin ${userId}`)
    }

    // Manually delete related records that don't have cascade delete
    // TournamentParticipant and TournamentSubscription don't have onDelete: Cascade
    await prisma.tournamentParticipant.deleteMany({
      where: {
        userId: { in: userIds },
      },
    })

    await prisma.tournamentSubscription.deleteMany({
      where: {
        userId: { in: userIds },
      },
    })

    // Delete users (cascade will handle other related records)
    const deleteResult = await prisma.user.deleteMany({
      where: {
        id: { in: userIds },
      },
    })

    console.log(`[ADMIN] ${deleteResult.count} user(s) deleted: ${users.map(u => u.username).join(', ')} by admin ${userId}`)

    return NextResponse.json({
      success: true,
      message: `${deleteResult.count} user(s) deleted successfully`,
      deletedCount: deleteResult.count,
    })
  } catch (error: any) {
    console.error('Failed to delete users:', error)
    // Return more detailed error message for debugging
    const errorMessage = error?.message || 'Failed to delete users'
    const errorCode = error?.code || 'UNKNOWN_ERROR'
    
    return NextResponse.json(
      { 
        error: 'Failed to delete users',
        details: errorMessage,
        code: errorCode,
      },
      { status: 500 }
    )
  }
}
