/**
 * Test endpoint to debug cookie issues
 * GET /api/test-cookie
 */

import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function GET(request: NextRequest) {
  try {
    // Get cookies from both methods
    const cookieStore = await cookies()
    const sessionCookie = cookieStore.get('session')?.value
    
    // Also check raw headers
    const cookieHeader = request.headers.get('cookie')
    
    return NextResponse.json({
      sessionCookieFromCookies: sessionCookie || 'NOT FOUND',
      cookieHeader: cookieHeader || 'NOT FOUND',
      allCookies: Object.fromEntries(
        cookieStore.getAll().map(c => [c.name, c.value.substring(0, 20) + '...'])
      ),
      message: sessionCookie 
        ? 'Cookie found via cookies() function' 
        : 'Cookie NOT found via cookies() function',
    })
  } catch (error: any) {
    return NextResponse.json({
      error: error.message,
      stack: error.stack,
    }, { status: 500 })
  }
}
