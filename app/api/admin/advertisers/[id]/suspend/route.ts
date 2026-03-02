import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/auth/session-utils'
import { prisma } from '@/lib/db/prisma'

export const dynamic = 'force-dynamic'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await verifyAdmin()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const { reason } = body

    const advertiser = await prisma.advertiser.update({
      where: { id },
      data: {
        status: 'SUSPENDED',
        suspendedAt: new Date(),
        suspensionReason: reason || null,
      },
    })

    return NextResponse.json({ success: true, advertiser })
  } catch (error: any) {
    console.error('Failed to suspend advertiser:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to suspend advertiser' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await verifyAdmin()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const advertiser = await prisma.advertiser.update({
      where: { id },
      data: {
        status: 'APPROVED',
        suspendedAt: null,
        suspensionReason: null,
      },
    })

    return NextResponse.json({ success: true, advertiser })
  } catch (error: any) {
    console.error('Failed to unsuspend advertiser:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to unsuspend advertiser' },
      { status: 500 }
    )
  }
}

