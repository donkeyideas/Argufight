import { NextRequest, NextResponse } from 'next/server'
import { verifySession } from '@/lib/auth/session'
import { prisma } from '@/lib/db/prisma'
import { getUserIdFromSession } from '@/lib/auth/session-utils'


// GET /api/admin/llm-models/export - Export appeal data for training
export async function GET(request: NextRequest) {
  try {
    const session = await verifySession()

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify admin
    const userId = getUserIdFromSession(session)
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { isAdmin: true },
    })

    if (!user?.isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const format = searchParams.get('format') || 'json'

    // Get all appealed debates with full data
    const appealedDebates = await prisma.debate.findMany({
      where: {
        appealStatus: {
          in: ['PENDING', 'PROCESSING', 'RESOLVED'],
        },
        appealReason: {
          not: null,
        },
      },
      include: {
        challenger: {
          select: {
            id: true,
            username: true,
            eloRating: true,
          },
        },
        opponent: {
          select: {
            id: true,
            username: true,
            eloRating: true,
          },
        },
        statements: {
          orderBy: {
            round: 'asc',
          },
          select: {
            id: true,
            round: true,
            content: true,
            authorId: true,
          },
        },
        verdicts: {
          select: {
            id: true,
            decision: true,
            reasoning: true,
            judge: {
              select: {
                name: true,
                personality: true,
              },
            },
          },
        },
      },
      orderBy: {
        appealedAt: 'desc',
      },
    })

    // Format data for training
    const trainingData = appealedDebates.map((debate) => {
      const appealedStatements = debate.appealedStatements
        ? JSON.parse(debate.appealedStatements)
        : []

      const appealedStatementContents = debate.statements
        .filter((s) => appealedStatements.includes(s.id))
        .map((s) => ({
          round: s.round,
          content: s.content,
          author: s.authorId === debate.challengerId ? 'challenger' : 'opponent',
        }))

      const originalWinner =
        debate.originalWinnerId === debate.challengerId
          ? 'challenger'
          : 'opponent'

      const newWinner =
        debate.winnerId === debate.challengerId
          ? 'challenger'
          : debate.winnerId === debate.opponentId
          ? 'opponent'
          : null

      const verdictFlipped =
        debate.appealStatus === 'RESOLVED' &&
        debate.originalWinnerId &&
        debate.winnerId &&
        debate.originalWinnerId !== debate.winnerId

      return {
        debate_id: debate.id,
        topic: debate.topic,
        category: debate.category,
        appeal_reason: debate.appealReason,
        appealed_statements: appealedStatementContents,
        original_winner: originalWinner,
        new_winner: newWinner,
        verdict_flipped: verdictFlipped,
        challenger_elo: debate.challenger.eloRating,
        opponent_elo: debate.opponent?.eloRating || 0,
        total_statements: debate.statements.length,
        appeal_date: debate.appealedAt?.toISOString(),
        created_at: debate.createdAt.toISOString(),
      }
    })

    if (format === 'csv') {
      // Convert to CSV
      if (trainingData.length === 0) {
        return new NextResponse('No data to export', {
          headers: {
            'Content-Type': 'text/csv',
            'Content-Disposition': 'attachment; filename="appeal-training-data.csv"',
          },
        })
      }

      const headers = Object.keys(trainingData[0])
      const csvRows = [
        headers.join(','),
        ...trainingData.map((row) =>
          headers
            .map((header) => {
              const value = row[header as keyof typeof row]
              if (typeof value === 'object') {
                return JSON.stringify(value).replace(/"/g, '""')
              }
              return String(value).replace(/"/g, '""')
            })
            .map((v) => `"${v}"`)
            .join(',')
        ),
      ]

      return new NextResponse(csvRows.join('\n'), {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': 'attachment; filename="appeal-training-data.csv"',
        },
      })
    } else {
      // Return JSON
      return NextResponse.json(trainingData, {
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': 'attachment; filename="appeal-training-data.json"',
        },
      })
    }
  } catch (error) {
    console.error('Failed to export training data:', error)
    return NextResponse.json(
      { error: 'Failed to export data' },
      { status: 500 }
    )
  }
}

