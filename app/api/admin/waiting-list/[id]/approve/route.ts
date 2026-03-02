import { NextRequest, NextResponse } from 'next/server'
import { verifySession } from '@/lib/auth/session'
import { prisma } from '@/lib/db/prisma'
import { getUserIdFromSession } from '@/lib/auth/session-utils'
import { createSession } from '@/lib/auth/session'

export const dynamic = 'force-dynamic'

// POST /api/admin/waiting-list/[id]/approve - Approve a user from waiting list
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

    const { id } = await params

    // Get waiting list entry
    let waitingListEntry: any = null
    try {
      waitingListEntry = await (prisma as any).waitingList?.findUnique({
        where: { id },
      })
    } catch {
      // Try raw SQL
      const result = await prisma.$queryRawUnsafe<Array<{
        id: string
        email: string
        username: string
        password_hash: string
        position: number
        approved: number
      }>>(`
        SELECT id, email, username, password_hash, position, approved
        FROM waiting_list
        WHERE id = ?
      `, id)
      
      if (result.length > 0) {
        waitingListEntry = {
          id: result[0].id,
          email: result[0].email,
          username: result[0].username,
          passwordHash: result[0].password_hash,
          position: result[0].position,
          approved: Boolean(result[0].approved),
        }
      }
    }

    if (!waitingListEntry) {
      return NextResponse.json(
        { error: 'Waiting list entry not found' },
        { status: 404 }
      )
    }

    if (waitingListEntry.approved) {
      return NextResponse.json(
        { error: 'User already approved' },
        { status: 400 }
      )
    }

    // Check if user already exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email: waitingListEntry.email },
          { username: waitingListEntry.username },
        ],
      },
    })

    if (existingUser) {
      // Remove from waiting list
      try {
        await (prisma as any).waitingList?.delete({
          where: { id },
        })
      } catch {
        await prisma.$executeRawUnsafe(`
          DELETE FROM waiting_list WHERE id = ?
        `, id)
      }
      
      return NextResponse.json(
        { error: 'User already exists' },
        { status: 400 }
      )
    }

    // Create user from waiting list entry
    const newUser = await prisma.user.create({
      data: {
        email: waitingListEntry.email,
        username: waitingListEntry.username,
        passwordHash: waitingListEntry.passwordHash,
      },
    })

    // Mark as approved in waiting list
    try {
      await (prisma as any).waitingList?.update({
        where: { id },
        data: {
          approved: true,
          approvedAt: new Date(),
          approvedBy: userId,
        },
      })
    } catch {
      await prisma.$executeRawUnsafe(`
        UPDATE waiting_list
        SET approved = 1, approved_at = ?, approved_by = ?
        WHERE id = ?
      `, new Date().toISOString(), userId, id)
    }

    // Reorder remaining waiting list positions
    try {
      await (prisma as any).waitingList?.updateMany({
        where: {
          position: { gt: waitingListEntry.position },
          approved: false,
        },
        data: {
          position: { decrement: 1 },
        },
      })
    } catch {
      await prisma.$executeRawUnsafe(`
        UPDATE waiting_list
        SET position = position - 1
        WHERE position > ? AND approved = 0
      `, waitingListEntry.position)
    }

    return NextResponse.json({
      success: true,
      user: {
        id: newUser.id,
        email: newUser.email,
        username: newUser.username,
      },
      message: 'User approved and created successfully',
    })
  } catch (error) {
    console.error('Failed to approve user:', error)
    return NextResponse.json(
      { error: 'Failed to approve user' },
      { status: 500 }
    )
  }
}










