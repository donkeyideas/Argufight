import { NextRequest, NextResponse } from 'next/server'
import { verifySession } from '@/lib/auth/session'
import { prisma } from '@/lib/db/prisma'

export const dynamic = 'force-dynamic'

// POST /api/admin/content/buttons - Create a new button
export async function POST(request: NextRequest) {
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

    const body = await request.json()
    const { sectionId, text, url, variant, order, isVisible } = body

    if (!sectionId || !text) {
      return NextResponse.json(
        { error: 'Section ID and text are required' },
        { status: 400 }
      )
    }

    const button = await prisma.homepageButton.create({
      data: {
        sectionId,
        text,
        url: url || null,
        variant: variant || 'primary',
        order: order || 0,
        isVisible: isVisible !== undefined ? isVisible : true,
      },
    })

    return NextResponse.json({ button })
  } catch (error) {
    console.error('Failed to create button:', error)
    return NextResponse.json(
      { error: 'Failed to create button' },
      { status: 500 }
    )
  }
}










