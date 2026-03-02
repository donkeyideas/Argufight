import { NextRequest, NextResponse } from 'next/server'
import { verifySession } from '@/lib/auth/session'
import { prisma } from '@/lib/db/prisma'

export const dynamic = 'force-dynamic'

// PATCH /api/admin/content/buttons/[id] - Update a button
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await verifySession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is admin
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { isAdmin: true },
    })

    if (!user?.isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()

    const button = await prisma.homepageButton.update({
      where: { id },
      data: {
        text: body.text !== undefined ? body.text : undefined,
        url: body.url !== undefined ? body.url : undefined,
        variant: body.variant !== undefined ? body.variant : undefined,
        order: body.order !== undefined ? body.order : undefined,
        isVisible: body.isVisible !== undefined ? body.isVisible : undefined,
      },
    })

    return NextResponse.json({ button })
  } catch (error) {
    console.error('Failed to update button:', error)
    return NextResponse.json(
      { error: 'Failed to update button' },
      { status: 500 }
    )
  }
}

// DELETE /api/admin/content/buttons/[id] - Delete a button
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await verifySession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is admin
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { isAdmin: true },
    })

    if (!user?.isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params

    await prisma.homepageButton.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete button:', error)
    return NextResponse.json(
      { error: 'Failed to delete button' },
      { status: 500 }
    )
  }
}










