import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { verifyCronAuth } from '@/lib/auth/cron-auth'

// GET /api/cron/process-stuck-appeals - Cron job to process stuck appeals
export async function GET(request: NextRequest) {
  try {
    const authError = verifyCronAuth(request)
    if (authError) return authError

    // Find all stuck appeals (PENDING status for more than 5 minutes)
    // This gives the automatic trigger time to work, but catches any that fail
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000)
    const stuckAppeals = await prisma.debate.findMany({
      where: {
        status: 'APPEALED',
        appealStatus: 'PENDING',
        appealedAt: {
          lte: fiveMinutesAgo, // Appeals older than 5 minutes
        },
      },
      select: {
        id: true,
        topic: true,
        appealedAt: true,
      },
      take: 10, // Process max 10 at a time
    })

    if (stuckAppeals.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No stuck appeals found',
        processed: 0,
      })
    }

    console.log(`[Cron] Found ${stuckAppeals.length} stuck appeals to process`)

    // Determine base URL
    let baseUrl = 'http://localhost:3000'
    if (process.env.NEXT_PUBLIC_APP_URL) {
      baseUrl = process.env.NEXT_PUBLIC_APP_URL
    } else if (process.env.VERCEL_URL) {
      baseUrl = `https://${process.env.VERCEL_URL}`
    }

    const regenerateUrl = `${baseUrl}/api/verdicts/regenerate`
    const results = []

    // Process each stuck appeal
    for (const appeal of stuckAppeals) {
      try {
        console.log(`[Cron] Processing stuck appeal: ${appeal.id}`)
        
        const response = await fetch(regenerateUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ debateId: appeal.id }),
        })

        if (response.ok) {
          const result = await response.json().catch(() => ({}))
          results.push({
            debateId: appeal.id,
            topic: appeal.topic,
            status: 'success',
            result,
          })
          console.log(`[Cron] ✅ Successfully processed appeal: ${appeal.id}`)
        } else {
          const errorData = await response.json().catch(() => ({}))
          results.push({
            debateId: appeal.id,
            topic: appeal.topic,
            status: 'failed',
            error: errorData.error || `HTTP ${response.status}`,
          })
          console.error(`[Cron] ❌ Failed to process appeal ${appeal.id}:`, errorData.error)
        }
      } catch (error: any) {
        results.push({
          debateId: appeal.id,
          topic: appeal.topic,
          status: 'error',
          error: error.message,
        })
        console.error(`[Cron] ❌ Error processing appeal ${appeal.id}:`, error.message)
      }
    }

    const successCount = results.filter(r => r.status === 'success').length
    const failCount = results.filter(r => r.status !== 'success').length

    return NextResponse.json({
      success: true,
      message: `Processed ${stuckAppeals.length} stuck appeals`,
      processed: successCount,
      failed: failCount,
      results,
    })
  } catch (error: any) {
    console.error('[Cron] Error processing stuck appeals:', error)
    return NextResponse.json(
      { error: 'Failed to process stuck appeals', details: error.message },
      { status: 500 }
    )
  }
}

