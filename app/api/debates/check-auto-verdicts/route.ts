import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'

// GET /api/debates/check-auto-verdicts - Check if automatic verdict generation is working
export async function GET(request: NextRequest) {
  try {
    // Check environment variables
    const nextPublicAppUrl = process.env.NEXT_PUBLIC_APP_URL
    const vercelUrl = process.env.VERCEL_URL
    
    // Determine what URL would be used
    let baseUrl = 'http://localhost:3000'
    if (nextPublicAppUrl) {
      baseUrl = nextPublicAppUrl
    } else if (vercelUrl) {
      baseUrl = `https://${vercelUrl}`
    }
    
    // Find debates that should have verdicts but don't
    const completedDebatesWithoutVerdicts = await prisma.debate.findMany({
      where: {
        status: 'COMPLETED',
        opponentId: { not: null },
        verdicts: {
          none: {}
        }
      },
      select: {
        id: true,
        topic: true,
        status: true,
        currentRound: true,
        totalRounds: true,
        createdAt: true,
        endedAt: true,
        challenger: {
          select: {
            username: true
          }
        },
        opponent: {
          select: {
            username: true
          }
        },
        _count: {
          select: {
            statements: true,
            verdicts: true
          }
        }
      },
      orderBy: {
        endedAt: 'desc'
      },
      take: 10
    })
    
    // Check if judges exist
    const judgeCount = await prisma.judge.count()
    
    // Check if DeepSeek API key is configured
    let deepseekConfigured = false
    let deepseekError = null
    try {
      const { getDeepSeekKey } = await import('@/lib/ai/deepseek')
      await getDeepSeekKey()
      deepseekConfigured = true
    } catch (error: any) {
      deepseekConfigured = false
      deepseekError = error.message
    }
    
    // Check recent debates that completed
    const recentCompleted = await prisma.debate.findMany({
      where: {
        status: {
          in: ['COMPLETED', 'VERDICT_READY']
        },
        endedAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
        }
      },
      select: {
        id: true,
        topic: true,
        status: true,
        endedAt: true,
        _count: {
          select: {
            verdicts: true
          }
        }
      },
      orderBy: {
        endedAt: 'desc'
      },
      take: 10
    })
    
    return NextResponse.json({
      environment: {
        nextPublicAppUrl: nextPublicAppUrl || 'NOT SET',
        vercelUrl: vercelUrl || 'NOT SET',
        calculatedBaseUrl: baseUrl,
        verdictGenerationUrl: `${baseUrl}/api/verdicts/generate`,
      },
      configuration: {
        judgeCount,
        deepseekConfigured,
        deepseekError,
        canGenerateVerdicts: judgeCount > 0 && deepseekConfigured,
      },
      issues: {
        missingNextPublicAppUrl: !nextPublicAppUrl,
        missingVercelUrl: !vercelUrl && !nextPublicAppUrl,
        noJudges: judgeCount === 0,
        noDeepSeekKey: !deepseekConfigured,
      },
      completedDebatesWithoutVerdicts: completedDebatesWithoutVerdicts.map(d => ({
        id: d.id,
        topic: d.topic,
        status: d.status,
        rounds: `${d.currentRound}/${d.totalRounds}`,
        statements: d._count.statements,
        verdicts: d._count.verdicts,
        endedAt: d.endedAt,
        challenger: d.challenger.username,
        opponent: d.opponent?.username || 'None',
        timeSinceEnd: d.endedAt ? Math.floor((Date.now() - new Date(d.endedAt).getTime()) / 1000 / 60) + ' minutes ago' : 'Unknown',
      })),
      recentCompletedDebates: recentCompleted.map(d => ({
        id: d.id,
        topic: d.topic,
        status: d.status,
        verdicts: d._count.verdicts,
        endedAt: d.endedAt,
        hasVerdicts: d._count.verdicts > 0,
      })),
      recommendations: [
        ...(completedDebatesWithoutVerdicts.length > 0 ? [
          `Found ${completedDebatesWithoutVerdicts.length} completed debates without verdicts. These should be processed.`
        ] : []),
        ...(!nextPublicAppUrl && !vercelUrl ? [
          'NEXT_PUBLIC_APP_URL or VERCEL_URL should be set for automatic verdict generation to work'
        ] : []),
        ...(judgeCount === 0 ? [
          'No judges found. Run seed script to add judges.'
        ] : []),
        ...(!deepseekConfigured ? [
          `DeepSeek API key not configured: ${deepseekError || 'Unknown error'}`
        ] : []),
      ],
    })
  } catch (error: any) {
    console.error('Failed to check auto-verdict status:', error)
    return NextResponse.json(
      {
        error: 'Failed to check auto-verdict status',
        details: error.message,
      },
      { status: 500 }
    )
  }
}

