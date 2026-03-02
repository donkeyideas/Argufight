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

    await prisma.user.update({
      where: { id: userId },
      data: { hasCompletedOnboarding: true },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[Onboarding Complete] Error:', error.message)
    return NextResponse.json({ error: 'Failed to complete onboarding' }, { status: 500 })
  }
}
