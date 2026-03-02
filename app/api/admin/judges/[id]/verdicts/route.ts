import { NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/auth/session-utils'
import { prisma } from '@/lib/db/prisma'


// GET /api/admin/judges/[id]/verdicts - Get all verdicts for a specific judge
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await verifyAdmin()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const verdicts = await prisma.verdict.findMany({
      where: {
        judgeId: id,
      },
      include: {
        debate: {
          select: {
            id: true,
            topic: true,
            category: true,
            status: true,
            challenger: {
              select: {
                id: true,
                username: true,
                avatarUrl: true,
              },
            },
            opponent: {
              select: {
                id: true,
                username: true,
                avatarUrl: true,
              },
            },
            createdAt: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return NextResponse.json({ verdicts })
  } catch (error) {
    console.error('Failed to fetch judge verdicts:', error)
    return NextResponse.json(
      { error: 'Failed to fetch judge verdicts' },
      { status: 500 }
    )
  }
}










