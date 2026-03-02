import { NextRequest, NextResponse } from 'next/server'
import { verifySession } from '@/lib/auth/session'
import { prisma } from '@/lib/db/prisma'
import { getUserIdFromSession } from '@/lib/auth/session-utils'


// GET /api/admin/waiting-list - Get all users on waiting list
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

    // Get waiting list (using raw SQL as fallback)
    let waitingList: any[] = []
    try {
      waitingList = await (prisma as any).waitingList?.findMany({
        where: { approved: false },
        orderBy: { position: 'asc' },
        select: {
          id: true,
          email: true,
          username: true,
          position: true,
          notified: true,
          createdAt: true,
        },
      }) || []
    } catch (error) {
      // If table doesn't exist, try raw SQL
      try {
        const result = await prisma.$queryRawUnsafe<Array<{
          id: string
          email: string
          username: string
          position: number
          notified: number
          created_at: Date
        }>>(`
          SELECT id, email, username, position, notified, created_at
          FROM waiting_list
          WHERE approved = 0
          ORDER BY position ASC
        `)
        waitingList = result.map(item => ({
          id: item.id,
          email: item.email,
          username: item.username,
          position: item.position,
          notified: Boolean(item.notified),
          createdAt: item.created_at,
        }))
      } catch (sqlError) {
        // Table doesn't exist yet, return empty array
        console.log('Waiting list table does not exist yet')
      }
    }

    return NextResponse.json({
      waitingList,
      count: waitingList.length,
    })
  } catch (error) {
    console.error('Failed to get waiting list:', error)
    return NextResponse.json(
      { error: 'Failed to get waiting list' },
      { status: 500 }
    )
  }
}










