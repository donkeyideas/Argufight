import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/auth/session-utils'
import { prisma } from '@/lib/db/prisma'

export const dynamic = 'force-dynamic'

// GET /api/admin/seo - Get SEO settings
export async function GET() {
  try {
    const userId = await verifyAdmin()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get all SEO-related admin settings
    const seoSettings = await prisma.adminSetting.findMany({
      where: {
        key: {
          startsWith: 'seo_',
        },
      },
    })

    // Convert to object, masking encrypted values
    const settings: Record<string, string> = {}
    seoSettings.forEach((setting) => {
      const key = setting.key.replace('seo_', '')
      if (setting.encrypted && setting.value) {
        // Show only last 4 chars for encrypted fields
        settings[key] = '••••••••' + setting.value.slice(-4)
      } else {
        settings[key] = setting.value || ''
      }
    })

    return NextResponse.json({ settings })
  } catch (error) {
    console.error('Failed to fetch SEO settings:', error)
    return NextResponse.json(
      { error: 'Failed to fetch SEO settings' },
      { status: 500 }
    )
  }
}

// POST /api/admin/seo - Save SEO settings
export async function POST(request: NextRequest) {
  try {
    const userId = await verifyAdmin()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const settings = body.settings || body

    // Keys that should be marked as encrypted
    const encryptedKeys = new Set(['gsc_client_secret'])

    // Save each setting
    for (const [key, value] of Object.entries(settings)) {
      const strValue = String(value || '')
      // Skip masked values (they haven't been changed)
      if (strValue.startsWith('••••')) continue

      const dbKey = `seo_${key}`
      await prisma.adminSetting.upsert({
        where: { key: dbKey },
        update: {
          value: strValue,
          updatedBy: userId,
        },
        create: {
          key: dbKey,
          value: strValue,
          category: 'seo',
          encrypted: encryptedKeys.has(key),
        },
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to save SEO settings:', error)
    return NextResponse.json(
      { error: 'Failed to save SEO settings' },
      { status: 500 }
    )
  }
}

