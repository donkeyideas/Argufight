import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'

export async function GET(request: NextRequest) {
  // Check admin settings first, then environment variables
  let clientId = process.env.GOOGLE_CLIENT_ID
  
  if (!clientId) {
    try {
      const setting = await prisma.adminSetting.findUnique({
        where: { key: 'GOOGLE_CLIENT_ID' },
      })
      if (setting && setting.value) {
        clientId = setting.value
      }
    } catch (error) {
      console.error('Failed to fetch GOOGLE_CLIENT_ID from admin settings:', error)
    }
  }
  
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.argufight.com'
  const redirectUri = `${baseUrl}/api/auth/google/callback`
  
  if (!clientId) {
    return NextResponse.json(
      { error: 'Google OAuth not configured. Please add GOOGLE_CLIENT_ID in admin settings or environment variables.' },
      { status: 500 }
    )
  }

  // Get the intended redirect URL and user type from query params
  const searchParams = request.nextUrl.searchParams
  const returnTo = searchParams.get('returnTo') || '/'
  const userType = searchParams.get('userType') || 'user' // 'user', 'advertiser', or 'employee'
  const addAccount = searchParams.get('addAccount') === 'true'
  // Detect mobile by checking for custom scheme (honorableai://) or mobile://
  const isMobile = returnTo.startsWith('mobile://') || returnTo.startsWith('honorableai://')

  // Use mobile callback if it's a mobile request
  const finalRedirectUri = isMobile 
    ? `${baseUrl}/api/auth/google/mobile-callback`
    : redirectUri

  // Build Google OAuth URL
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: finalRedirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'offline',
    prompt: 'consent',
    state: JSON.stringify({ returnTo, userType, addAccount, isMobile }), // Store return URL, user type, addAccount flag, and mobile flag for CSRF protection
  })

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`

  return NextResponse.redirect(authUrl)
}

