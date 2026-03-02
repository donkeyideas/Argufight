import { NextRequest, NextResponse } from 'next/server'
import { verifySession } from '@/lib/auth/session'
import { prisma } from '@/lib/db/prisma'
import { getUserIdFromSession } from '@/lib/auth/session-utils'

// POST /api/support/tickets/[id]/replies - Add a reply to a support ticket
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await verifySession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = getUserIdFromSession(session)
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const { content, isInternal } = body

    if (!content) {
      return NextResponse.json(
        { error: 'Content is required' },
        { status: 400 }
      )
    }

    // Check if ticket exists and user has access
    const ticket = await prisma.supportTicket.findUnique({
      where: { id },
      select: {
        userId: true,
        status: true,
      },
    })

    if (!ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
    }

    // Check if user owns the ticket or is admin
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { isAdmin: true },
    })

    if (ticket.userId !== userId && !user?.isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Only admins can create internal notes
    if (isInternal && !user?.isAdmin) {
      return NextResponse.json(
        { error: 'Only admins can create internal notes' },
        { status: 403 }
      )
    }

    // Create reply
    const reply = await prisma.supportTicketReply.create({
      data: {
        ticketId: id,
        authorId: userId,
        content,
        isInternal: isInternal || false,
      },
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
    })

    // Update ticket status if user replied (not admin)
    if (!user?.isAdmin && ticket.status === 'RESOLVED') {
      await prisma.supportTicket.update({
        where: { id },
        data: { status: 'OPEN' },
      })
    }

    // Create notification for ticket owner if admin replied (and not internal)
    if (user?.isAdmin && !isInternal && ticket.userId !== userId) {
      try {
        // Get ticket details for notification
        const ticketDetails = await prisma.supportTicket.findUnique({
          where: { id },
          select: {
            subject: true,
            user: {
              select: {
                email: true,
              },
            },
          },
        })

        // Get admin username for notification
        const adminUser = await prisma.user.findUnique({
          where: { id: userId },
          select: { username: true },
        })

        if (ticketDetails && adminUser) {
          // Create notification
          await prisma.notification.create({
            data: {
              userId: ticket.userId,
              type: 'NEW_MESSAGE', // Using existing type for now
              title: 'Support Ticket Reply',
              message: `${adminUser.username} replied to your support ticket: "${ticketDetails.subject}"`,
            },
          })

          console.log('[Support Ticket Reply] Created notification for user:', ticket.userId)
        }
      } catch (notificationError) {
        // Log but don't fail if notification creation fails
        console.error('Failed to create support ticket reply notification:', notificationError)
      }
    }

    return NextResponse.json({ reply }, { status: 201 })
  } catch (error) {
    console.error('Failed to create support ticket reply:', error)
    return NextResponse.json(
      { error: 'Failed to create reply' },
      { status: 500 }
    )
  }
}

