import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { verifySession } from '@/lib/auth/session'
import { getUserIdFromSession } from '@/lib/auth/session-utils'

export async function POST() {
  try {
    const session = await verifySession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = getUserIdFromSession(session)
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { isAdmin: true },
    })

    if (!user?.isAdmin) {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 })
    }

    // Fix all non-private debates to have visibility = PUBLIC
    const updated = await prisma.debate.updateMany({
      where: {
        isPrivate: false,
        visibility: 'PRIVATE',
      },
      data: {
        visibility: 'PUBLIC',
      },
    })

    return NextResponse.json({
      success: true,
      updated: updated.count,
      message: `Updated ${updated.count} debates from PRIVATE to PUBLIC visibility`,
    })
  } catch (error: any) {
    console.error('[Fix Visibility]', error.message)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
