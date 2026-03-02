import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifySessionWithDb } from '@/lib/auth/session-verify'

/**
 * Debug endpoint to check session status
 * Visit: https://honorable-ai.vercel.app/api/debug-session
 */
export async function GET() {
  try {
    const cookieStore = await cookies()
    const sessionCookie = cookieStore.get('session')
    
    const session = await verifySessionWithDb()
    
    return NextResponse.json({
      hasCookie: !!sessionCookie,
      cookieValue: sessionCookie ? sessionCookie.value.substring(0, 50) + '...' : null,
      hasSession: !!session,
      userId: session?.userId,
      user: session?.user,
      environment: {
        nodeEnv: process.env.NODE_ENV,
        vercel: process.env.VERCEL,
      },
    })
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : String(error),
    }, { status: 500 })
  }
}










