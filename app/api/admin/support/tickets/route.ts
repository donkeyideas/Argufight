import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/auth/session-utils'
import { prisma } from '@/lib/db/prisma'


// GET /api/admin/support/tickets - Get all support tickets (admin only)
export async function GET(request: NextRequest) {
  try {
    const userId = await verifyAdmin()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const assignedToId = searchParams.get('assignedToId')
    const priority = searchParams.get('priority')

    const where: any = {}
    if (status) {
      where.status = status.toUpperCase()
    }
    if (assignedToId) {
      where.assignedToId = assignedToId === 'unassigned' ? null : assignedToId
    }
    if (priority) {
      where.priority = priority.toUpperCase()
    }

    console.log('[API /admin/support/tickets GET] Fetching tickets with filters:', where)

    const tickets = await prisma.supportTicket.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true,
            avatarUrl: true,
          },
        },
        replies: {
          include: {
            author: {
              select: {
                id: true,
                username: true,
                avatarUrl: true,
                isAdmin: true,
              },
            },
          },
          orderBy: {
            createdAt: 'asc',
          },
        },
        assignedTo: {
          select: {
            id: true,
            username: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    console.log('[API /admin/support/tickets GET] Found tickets:', tickets.length)
    if (tickets.length > 0) {
      // Log detailed info for all tickets including reply counts
      tickets.forEach((ticket, index) => {
        console.log(`[API /admin/support/tickets GET] Ticket ${index + 1}:`, {
          id: ticket.id,
          subject: ticket.subject,
          userId: ticket.userId,
          userEmail: ticket.user?.email,
          status: ticket.status,
          createdAt: ticket.createdAt,
          replyCount: ticket.replies?.length || 0,
          replies: ticket.replies?.map(r => ({
            id: r.id,
            author: r.author?.username,
            isInternal: r.isInternal,
            createdAt: r.createdAt,
          })) || [],
        })
      })
    } else {
      // Check if there are any tickets at all in the database
      const totalTicketCount = await prisma.supportTicket.count()
      console.log('[API /admin/support/tickets GET] No tickets found with filters. Total tickets in DB:', totalTicketCount)
    }

    // Get admin users for assignment dropdown
    const admins = await prisma.user.findMany({
      where: { isAdmin: true },
      select: {
        id: true,
        username: true,
        avatarUrl: true,
      },
      orderBy: {
        username: 'asc',
      },
    })

    return NextResponse.json({ tickets, admins })
  } catch (error) {
    console.error('Failed to fetch support tickets:', error)
    return NextResponse.json(
      { error: 'Failed to fetch support tickets' },
      { status: 500 }
    )
  }
}

