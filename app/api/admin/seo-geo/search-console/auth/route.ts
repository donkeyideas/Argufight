import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/auth/session-utils'
import { prisma } from '@/lib/db/prisma'
import { getOAuthUrl, exchangeCodeForTokens } from '@/lib/seo/search-console'

export const dynamic = 'force-dynamic'

// GET: Generate OAuth URL or handle callback
export async function GET(request: NextRequest) {
  try {
    const userId = await verifyAdmin()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')

    // Load client credentials from admin_settings
    const settings = await prisma.adminSetting.findMany({
      where: { key: { in: ['seo_gsc_client_id', 'seo_gsc_client_secret'] } },
      select: { key: true, value: true },
    })
    const map = Object.fromEntries(settings.map((s) => [s.key, s.value]))
    const clientId = map['seo_gsc_client_id']
    const clientSecret = map['seo_gsc_client_secret']

    if (!clientId || !clientSecret) {
      return NextResponse.json(
        { error: 'GSC Client ID and Client Secret must be configured in Settings first' },
        { status: 400 }
      )
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXTAUTH_URL || 'https://www.argufight.com'
    const redirectUri = `${baseUrl}/api/admin/seo-geo/search-console/auth`

    // If we have a code, this is the OAuth callback
    if (code) {
      const { refreshToken } = await exchangeCodeForTokens(
        clientId,
        clientSecret,
        code,
        redirectUri
      )

      // Store refresh token
      await prisma.adminSetting.upsert({
        where: { key: 'seo_gsc_refresh_token' },
        update: { value: refreshToken, updatedBy: userId },
        create: {
          key: 'seo_gsc_refresh_token',
          value: refreshToken,
          encrypted: true,
          category: 'seo',
          description: 'Google Search Console OAuth refresh token',
        },
      })

      // Redirect back to the SEO-GEO settings page with success
      return NextResponse.redirect(
        new URL('/admin/seo-geo?tab=settings&gsc=connected', baseUrl)
      )
    }

    // No code - generate OAuth URL
    const authUrl = getOAuthUrl(clientId, clientSecret, redirectUri)
    return NextResponse.json({ authUrl })
  } catch (error) {
    console.error('GSC auth error:', error)
    const message = error instanceof Error ? error.message : 'Authentication failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// POST: Disconnect GSC (clear refresh token)
export async function POST(request: NextRequest) {
  try {
    const userId = await verifyAdmin()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    if (body.action === 'disconnect') {
      await prisma.adminSetting.deleteMany({
        where: { key: 'seo_gsc_refresh_token' },
      })

      // Clear cached client
      return NextResponse.json({ success: true, message: 'GSC disconnected' })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('GSC disconnect error:', error)
    return NextResponse.json({ error: 'Failed to disconnect' }, { status: 500 })
  }
}
