import { NextRequest, NextResponse } from 'next/server'
import { verifyCronAuth } from '@/lib/auth/cron-auth'
import { triggerAIAutoAccept } from '@/lib/ai/trigger-ai-accept'

// Cron job to auto-accept open challenges for AI users
// Delegates to the shared triggerAIAutoAccept function for consistent round-robin distribution
export async function GET(request: NextRequest) {
  try {
    const authError = verifyCronAuth(request)
    if (authError) return authError

    const accepted = await triggerAIAutoAccept()

    return NextResponse.json({
      message: 'Auto-accept completed',
      accepted,
    })
  } catch (error: any) {
    console.error('[AI Auto-Accept] Error:', error.message)
    return NextResponse.json(
      { error: error.message || 'Failed to auto-accept challenges' },
      { status: 500 }
    )
  }
}
