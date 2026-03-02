import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'

// GET /api/debates/[id]/check-verdicts - Check if verdicts will be generated for a debate
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Get debate with all relevant data
    const debate = await prisma.debate.findUnique({
      where: { id },
      include: {
        challenger: {
          select: {
            id: true,
            username: true,
          }
        },
        opponent: {
          select: {
            id: true,
            username: true,
          }
        },
        statements: {
          select: {
            id: true,
            round: true,
            authorId: true,
          }
        },
        verdicts: {
          select: {
            id: true,
            judgeId: true,
          }
        },
      },
    })

    if (!debate) {
      return NextResponse.json({
        exists: false,
        error: 'Debate not found',
      })
    }

    // Check if judges exist
    const judgeCount = await prisma.judge.count()
    
    // Check if DeepSeek API key is configured
    let deepseekConfigured = false
    try {
      const { getDeepSeekKey } = await import('@/lib/ai/deepseek')
      await getDeepSeekKey()
      deepseekConfigured = true
    } catch (error) {
      deepseekConfigured = false
    }

    // Determine if verdicts can be generated
    const canGenerateVerdicts = 
      debate.status === 'COMPLETED' || debate.status === 'VERDICT_READY'
      && debate.opponent !== null
      && judgeCount > 0
      && deepseekConfigured
      && debate.verdicts.length === 0

    // Check what's blocking verdict generation
    const blockers: string[] = []
    if (debate.status !== 'COMPLETED' && debate.status !== 'VERDICT_READY') {
      blockers.push(`Debate status is ${debate.status} (needs to be COMPLETED)`)
    }
    if (!debate.opponent) {
      blockers.push('Debate has no opponent')
    }
    if (judgeCount === 0) {
      blockers.push('No judges found in database (run seed script)')
    }
    if (!deepseekConfigured) {
      blockers.push('DeepSeek API key not configured')
    }
    if (debate.verdicts.length > 0) {
      blockers.push(`Verdicts already exist (${debate.verdicts.length} verdicts)`)
    }

    // Count statements by round
    const statementsByRound = debate.statements.reduce((acc, stmt) => {
      acc[stmt.round] = (acc[stmt.round] || 0) + 1
      return acc
    }, {} as Record<number, number>)

    return NextResponse.json({
      exists: true,
      debate: {
        id: debate.id,
        topic: debate.topic,
        status: debate.status,
        currentRound: debate.currentRound,
        totalRounds: debate.totalRounds,
        challenger: debate.challenger.username,
        opponent: debate.opponent?.username || null,
        statementCount: debate.statements.length,
        statementsByRound,
        verdictCount: debate.verdicts.length,
      },
      verdictGeneration: {
        canGenerate: canGenerateVerdicts,
        blockers,
        requirements: {
          statusOk: debate.status === 'COMPLETED' || debate.status === 'VERDICT_READY',
          hasOpponent: debate.opponent !== null,
          hasJudges: judgeCount > 0,
          apiKeyConfigured: deepseekConfigured,
          noExistingVerdicts: debate.verdicts.length === 0,
        },
        judgeCount,
        deepseekConfigured,
      },
      willAutoGenerate: canGenerateVerdicts && debate.status === 'COMPLETED',
    })
  } catch (error: any) {
    console.error('Failed to check verdict status:', error)
    return NextResponse.json(
      {
        error: 'Failed to check verdict status',
        details: error.message,
      },
      { status: 500 }
    )
  }
}










