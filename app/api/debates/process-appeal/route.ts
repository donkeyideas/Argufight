import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'

// POST /api/debates/process-appeal - Manually trigger appeal processing
export async function POST(request: NextRequest) {
  try {
    const { debateId } = await request.json()

    if (!debateId) {
      return NextResponse.json(
        { error: 'Debate ID is required' },
        { status: 400 }
      )
    }

    // Get debate
    const debate = await prisma.debate.findUnique({
      where: { id: debateId },
      select: {
        id: true,
        status: true,
        appealStatus: true,
        appealCount: true,
      },
    })

    if (!debate) {
      return NextResponse.json({ error: 'Debate not found' }, { status: 404 })
    }

    if (debate.status !== 'APPEALED') {
      return NextResponse.json(
        { error: `Debate is not in APPEALED status. Current status: ${debate.status}` },
        { status: 400 }
      )
    }

    if (debate.appealStatus === 'RESOLVED') {
      return NextResponse.json(
        { error: 'This appeal has already been resolved' },
        { status: 400 }
      )
    }

    // Determine base URL for triggering regeneration
    let baseUrl = 'http://localhost:3000'
    if (process.env.NEXT_PUBLIC_APP_URL) {
      baseUrl = process.env.NEXT_PUBLIC_APP_URL
    } else if (process.env.VERCEL_URL) {
      baseUrl = `https://${process.env.VERCEL_URL}`
    }

    console.log(`[Process Appeal] Triggering regeneration for debate ${debateId} via ${baseUrl}/api/verdicts/regenerate`)

    // Trigger regeneration
    const response = await fetch(`${baseUrl}/api/verdicts/regenerate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ debateId }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      console.error('❌ Failed to trigger verdict regeneration:', {
        debateId,
        status: response.status,
        error: errorData.error || 'Unknown error',
        details: errorData.details,
      })
      return NextResponse.json(
        {
          error: 'Failed to trigger verdict regeneration',
          details: errorData.error || `HTTP ${response.status}`,
        },
        { status: response.status }
      )
    }

    const result = await response.json().catch(() => ({}))
    console.log('✅ Verdict regeneration triggered successfully:', debateId, result)

    return NextResponse.json({
      success: true,
      message: 'Appeal processing triggered successfully',
      debateId,
      result,
    })
  } catch (error: any) {
    console.error('Process appeal error:', error)
    return NextResponse.json(
      { error: 'Failed to process appeal', details: error.message },
      { status: 500 }
    )
  }
}

