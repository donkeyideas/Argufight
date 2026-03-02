import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'

// GET /api/debates/check-appeals - Check status of all appeals
export async function GET(request: NextRequest) {
  try {
    const appeals = await prisma.debate.findMany({
      where: {
        appealCount: {
          gt: 0,
        },
      },
      include: {
        challenger: {
          select: {
            id: true,
            username: true,
          },
        },
        opponent: {
          select: {
            id: true,
            username: true,
          },
        },
        verdicts: {
          include: {
            judge: {
              select: {
                id: true,
                name: true,
              },
            },
          },
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
      orderBy: {
        appealedAt: 'desc',
      },
    })

    const processedAppeals = appeals.map(appeal => {
      // Determine if verdicts were generated after appeal
      const appealedAt = appeal.appealedAt || new Date()
      const originalVerdicts = appeal.verdicts.filter(
        v => new Date(v.createdAt) < appealedAt
      )
      const appealVerdicts = appeal.verdicts.filter(
        v => new Date(v.createdAt) >= appealedAt
      )

      return {
        id: appeal.id,
        topic: appeal.topic,
        status: appeal.status,
        appealStatus: appeal.appealStatus,
        appealCount: appeal.appealCount,
        appealedAt: appeal.appealedAt,
        appealedBy: appeal.appealedBy,
        originalWinnerId: appeal.originalWinnerId,
        currentWinnerId: appeal.winnerId,
        challenger: appeal.challenger.username,
        opponent: appeal.opponent?.username || 'N/A',
        originalVerdictsCount: originalVerdicts.length,
        appealVerdictsCount: appealVerdicts.length,
        hasAppealVerdicts: appealVerdicts.length > 0,
        appealReason: appeal.appealReason?.substring(0, 100) + '...',
        canRegenerate: appeal.status === 'APPEALED' && appeal.appealStatus === 'PENDING',
      }
    })

    const summary = {
      total: processedAppeals.length,
      pending: processedAppeals.filter(a => a.appealStatus === 'PENDING').length,
      processing: processedAppeals.filter(a => a.appealStatus === 'PROCESSING').length,
      resolved: processedAppeals.filter(a => a.appealStatus === 'RESOLVED').length,
      denied: processedAppeals.filter(a => a.appealStatus === 'DENIED').length,
      stuck: processedAppeals.filter(a => a.canRegenerate).length,
    }

    return NextResponse.json({
      summary,
      appeals: processedAppeals,
    })
  } catch (error: any) {
    console.error('Check appeals error:', error)
    return NextResponse.json(
      { error: 'Failed to check appeals', details: error.message },
      { status: 500 }
    )
  }
}

