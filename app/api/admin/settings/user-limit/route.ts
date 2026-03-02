import { NextRequest, NextResponse } from 'next/server'
import { verifySession } from '@/lib/auth/session'
import { prisma } from '@/lib/db/prisma'
import { getUserIdFromSession } from '@/lib/auth/session-utils'

export const dynamic = 'force-dynamic'

// GET /api/admin/settings/user-limit - Get current user limit setting
export async function GET(request: NextRequest) {
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
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { isAdmin: true },
    })

    if (!user?.isAdmin) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      )
    }

    // Get user limit setting
    let userLimitSetting = await prisma.adminSetting.findUnique({
      where: { key: 'user_limit' },
    })

    // If setting doesn't exist, create default
    if (!userLimitSetting) {
      userLimitSetting = await prisma.adminSetting.create({
        data: {
          key: 'user_limit',
          value: '0', // 0 means unlimited
          description: 'Maximum number of users allowed on the platform. Set to 0 for unlimited.',
          category: 'users',
        },
      })
    }

    // Get current user count
    const currentUserCount = await prisma.user.count({
      where: {
        isBanned: false, // Don't count banned users
      },
    })

    // Get waiting list count
    let waitingListCount = 0
    try {
      waitingListCount = await (prisma as any).waitingList?.count({
        where: { approved: false },
      }) || 0
    } catch {
      // Table might not exist yet, try raw SQL
      try {
        const result = await prisma.$queryRawUnsafe<Array<{ count: number }>>(`
          SELECT COUNT(*) as count
          FROM waiting_list
          WHERE approved = 0
        `)
        waitingListCount = result[0]?.count || 0
      } catch (sqlError) {
        // Table doesn't exist yet, count is 0
        waitingListCount = 0
      }
    }

    return NextResponse.json({
      userLimit: parseInt(userLimitSetting.value) || 0,
      currentUserCount,
      waitingListCount,
      isLimited: parseInt(userLimitSetting.value) > 0,
    })
  } catch (error) {
    console.error('Failed to get user limit:', error)
    return NextResponse.json(
      { error: 'Failed to get user limit' },
      { status: 500 }
    )
  }
}

// PATCH /api/admin/settings/user-limit - Update user limit
export async function PATCH(request: NextRequest) {
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
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { isAdmin: true },
    })

    if (!user?.isAdmin) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      )
    }

    const { userLimit } = await request.json()

    if (typeof userLimit !== 'number' || userLimit < 0) {
      return NextResponse.json(
        { error: 'User limit must be a non-negative number' },
        { status: 400 }
      )
    }

    // Update or create setting
    const setting = await prisma.adminSetting.upsert({
      where: { key: 'user_limit' },
      update: {
        value: userLimit.toString(),
        updatedBy: userId,
      },
      create: {
        key: 'user_limit',
        value: userLimit.toString(),
        description: 'Maximum number of users allowed on the platform. Set to 0 for unlimited.',
        category: 'users',
        updatedBy: userId,
      },
    })

    // Get current user count
    const currentUserCount = await prisma.user.count({
      where: {
        isBanned: false,
      },
    })

    // Get waiting list count
    let waitingListCount = 0
    try {
      waitingListCount = await (prisma as any).waitingList?.count({
        where: { approved: false },
      }) || 0
    } catch {
      // Table might not exist yet, try raw SQL
      try {
        const result = await prisma.$queryRawUnsafe<Array<{ count: number }>>(`
          SELECT COUNT(*) as count
          FROM waiting_list
          WHERE approved = 0
        `)
        waitingListCount = result[0]?.count || 0
      } catch (sqlError) {
        // Table doesn't exist yet, count is 0
        waitingListCount = 0
      }
    }

    return NextResponse.json({
      success: true,
      userLimit: parseInt(setting.value),
      currentUserCount,
      waitingListCount,
      isLimited: parseInt(setting.value) > 0,
    })
  } catch (error) {
    console.error('Failed to update user limit:', error)
    return NextResponse.json(
      { error: 'Failed to update user limit' },
      { status: 500 }
    )
  }
}

