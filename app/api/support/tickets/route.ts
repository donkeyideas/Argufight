import { NextRequest, NextResponse } from 'next/server'
import { verifySession } from '@/lib/auth/session'
import { prisma } from '@/lib/db/prisma'
import { getUserIdFromSession } from '@/lib/auth/session-utils'

// GET /api/support/tickets - Get user's support tickets
export async function GET(request: NextRequest) {
  try {
    const session = await verifySession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = getUserIdFromSession(session)
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')

    const where: any = { userId }
    if (status) {
      where.status = status.toUpperCase()
    }

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

    console.log('[API /support/tickets GET] Returning tickets:', {
      count: tickets.length,
      tickets: tickets.map(t => ({
        id: t.id,
        subject: t.subject,
        replyCount: t.replies?.length || 0,
      })),
    })

    return NextResponse.json({ tickets })
  } catch (error) {
    console.error('Failed to fetch support tickets:', error)
    return NextResponse.json(
      { error: 'Failed to fetch support tickets' },
      { status: 500 }
    )
  }
}

// POST /api/support/tickets - Create a new support ticket
export async function POST(request: NextRequest) {
  try {
    const session = await verifySession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = getUserIdFromSession(session)
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { subject, description, category, priority } = body

    if (!subject || !description) {
      return NextResponse.json(
        { error: 'Subject and description are required' },
        { status: 400 }
      )
    }

    console.log('[API /support/tickets POST] Creating ticket:', {
      userId,
      subject,
      category,
      priority,
    })

    const ticket = await prisma.supportTicket.create({
      data: {
        userId,
        subject,
        description,
        category: category || null,
        priority: priority || 'MEDIUM',
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
    })

    console.log('[API /support/tickets POST] Ticket created successfully:', {
      id: ticket.id,
      userId: ticket.userId,
      subject: ticket.subject,
      status: ticket.status,
      priority: ticket.priority,
      category: ticket.category,
      createdAt: ticket.createdAt,
      userEmail: ticket.user?.email,
    })

    // Verify the ticket was actually saved by fetching it back
    const verifyTicket = await prisma.supportTicket.findUnique({
      where: { id: ticket.id },
      select: { id: true, userId: true, subject: true },
    })
    
    if (!verifyTicket) {
      console.error('[API /support/tickets POST] CRITICAL: Ticket was not saved to database!', ticket.id)
    } else {
      console.log('[API /support/tickets POST] Ticket verified in database:', verifyTicket.id)
    }

    return NextResponse.json({ ticket }, { status: 201 })
  } catch (error) {
    console.error('Failed to create support ticket:', error)
    return NextResponse.json(
      { error: 'Failed to create support ticket' },
      { status: 500 }
    )
  }
}

