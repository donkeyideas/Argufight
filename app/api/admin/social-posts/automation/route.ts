import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/auth/session-utils'
import { prisma } from '@/lib/db/prisma'

export const dynamic = 'force-dynamic'

const AUTOMATION_KEYS = [
  'SOCIAL_AUTO_ENABLED',
  'SOCIAL_AUTO_PLATFORMS',
  'SOCIAL_AUTO_HOUR_UTC',
  'SOCIAL_AUTO_TOPICS',
  'SOCIAL_AUTO_INCLUDE_DEBATES',
  'SOCIAL_AUTO_REQUIRE_APPROVAL',
]

export async function GET() {
  try {
    const userId = await verifyAdmin()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const rows = await prisma.adminSetting.findMany({ where: { key: { in: AUTOMATION_KEYS } } })
    const config: Record<string, string> = {}
    for (const row of rows) config[row.key] = row.value

    return NextResponse.json({
      enabled: config['SOCIAL_AUTO_ENABLED'] !== 'false',
      platforms: safeParseJson(config['SOCIAL_AUTO_PLATFORMS'], ['TWITTER', 'LINKEDIN', 'FACEBOOK']),
      hourUtc: parseInt(config['SOCIAL_AUTO_HOUR_UTC'] ?? '9', 10),
      topics: safeParseJson(config['SOCIAL_AUTO_TOPICS'], [
        'Debate tips and strategies',
        'ArguFight platform highlights',
        'Critical thinking skills',
        'Winning argument techniques',
      ]),
      includeDebates: config['SOCIAL_AUTO_INCLUDE_DEBATES'] !== 'false',
      requireApproval: config['SOCIAL_AUTO_REQUIRE_APPROVAL'] !== 'false',
    })
  } catch (error: any) {
    console.error('automation GET error:', error)
    return NextResponse.json({ error: error.message ?? 'Failed to load automation config' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await verifyAdmin()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { enabled, platforms, hourUtc, topics, includeDebates, requireApproval } = body

    const upserts = [
      { key: 'SOCIAL_AUTO_ENABLED', value: String(!!enabled) },
      { key: 'SOCIAL_AUTO_PLATFORMS', value: JSON.stringify(platforms ?? []) },
      { key: 'SOCIAL_AUTO_HOUR_UTC', value: String(hourUtc ?? 9) },
      { key: 'SOCIAL_AUTO_TOPICS', value: JSON.stringify(topics ?? []) },
      { key: 'SOCIAL_AUTO_INCLUDE_DEBATES', value: String(!!includeDebates) },
      { key: 'SOCIAL_AUTO_REQUIRE_APPROVAL', value: String(!!requireApproval) },
    ]

    await Promise.all(
      upserts.map((u) =>
        prisma.adminSetting.upsert({
          where: { key: u.key },
          update: { value: u.value },
          create: { key: u.key, value: u.value },
        }),
      ),
    )

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('automation POST error:', error)
    return NextResponse.json({ error: error.message ?? 'Failed to save automation config' }, { status: 500 })
  }
}

function safeParseJson<T>(val: string | undefined, fallback: T): T {
  if (!val) return fallback
  try {
    return JSON.parse(val) as T
  } catch {
    return fallback
  }
}
