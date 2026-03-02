import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/auth/session-utils'
import { prisma } from '@/lib/db/prisma'

export const dynamic = 'force-dynamic'

const CREDENTIAL_KEYS = [
  'SOCIAL_TWITTER_API_KEY',
  'SOCIAL_TWITTER_API_SECRET',
  'SOCIAL_TWITTER_ACCESS_TOKEN',
  'SOCIAL_TWITTER_ACCESS_SECRET',
  'SOCIAL_LINKEDIN_ACCESS_TOKEN',
  'SOCIAL_LINKEDIN_PERSON_URN',
  'SOCIAL_FACEBOOK_PAGE_ACCESS_TOKEN',
  'SOCIAL_FACEBOOK_PAGE_ID',
  'SOCIAL_INSTAGRAM_ACCESS_TOKEN',
  'SOCIAL_INSTAGRAM_ACCOUNT_ID',
]

export async function GET() {
  try {
    const userId = await verifyAdmin()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const rows = await prisma.adminSetting.findMany({ where: { key: { in: CREDENTIAL_KEYS } } })
    // Return only whether each key is set (not the actual value) for security
    const configured: Record<string, boolean> = {}
    const values: Record<string, string> = {}
    for (const k of CREDENTIAL_KEYS) {
      const row = rows.find((r) => r.key === k)
      configured[k] = !!row?.value
      values[k] = row?.value ?? ''
    }

    return NextResponse.json({ configured, values })
  } catch (error: any) {
    return NextResponse.json({ error: error.message ?? 'Failed to load credentials' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await verifyAdmin()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body: Record<string, string> = await request.json()

    await Promise.all(
      Object.entries(body)
        .filter(([key]) => CREDENTIAL_KEYS.includes(key))
        .map(([key, value]) =>
          prisma.adminSetting.upsert({
            where: { key },
            update: { value },
            create: { key, value },
          }),
        ),
    )

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message ?? 'Failed to save credentials' }, { status: 500 })
  }
}
