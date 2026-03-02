import { NextRequest, NextResponse } from 'next/server'
import { verifySession } from '@/lib/auth/session'
import { prisma } from '@/lib/db/prisma'
import { getUserIdFromSession } from '@/lib/auth/session-utils'

export const dynamic = 'force-dynamic'

// GET /api/admin/settings - Get all settings
export async function GET(request: NextRequest) {
  try {
    const session = await verifySession()

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify admin
    const userId = getUserIdFromSession(session)
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { isAdmin: true },
    })

    if (!user?.isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get all settings
    const settings = await prisma.adminSetting.findMany()

    // Convert to object
    const settingsObj = settings.reduce((acc, setting) => {
      acc[setting.key] = setting.value
      return acc
    }, {} as Record<string, string>)

    // Log the marketplace setting specifically for debugging
    if (settingsObj.ADS_CREATOR_MARKETPLACE_ENABLED !== undefined) {
      console.log('[API Settings GET] ADS_CREATOR_MARKETPLACE_ENABLED:', settingsObj.ADS_CREATOR_MARKETPLACE_ENABLED)
    } else {
      console.log('[API Settings GET] ADS_CREATOR_MARKETPLACE_ENABLED: NOT FOUND (will default to false)')
    }

    return NextResponse.json(settingsObj)
  } catch (error) {
    console.error('Failed to fetch settings:', error)
    return NextResponse.json(
      { error: 'Failed to fetch settings' },
      { status: 500 }
    )
  }
}

// POST /api/admin/settings - Update settings
export async function POST(request: NextRequest) {
  try {
    const session = await verifySession()

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify admin
    const userId = getUserIdFromSession(session)
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { isAdmin: true },
    })

    if (!user?.isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    console.log('[API Settings] Updating settings:', Object.keys(body))

    // Update each setting
    for (const [key, value] of Object.entries(body)) {
      try {
        const result = await prisma.adminSetting.upsert({
          where: { key },
          update: {
            value: value as string,
            updatedBy: userId,
            updatedAt: new Date(),
          },
          create: {
            key,
            value: value as string,
            encrypted: key.includes('KEY') || key.includes('SECRET'),
            updatedBy: userId,
            category: key.startsWith('ADS_') ? 'advertising' : 'general',
            description: key === 'ADS_CREATOR_MARKETPLACE_ENABLED' ? 'Enable Creator Marketplace' : undefined,
          },
        })
        console.log(`[API Settings] Updated ${key}:`, result.value, 'at', result.updatedAt)
      } catch (error: any) {
        console.error(`[API Settings] Failed to update ${key}:`, error.message)
        throw error
      }
    }

    // Verify the update by fetching the setting immediately
    const verifySetting = await prisma.adminSetting.findMany({
      where: { key: { in: Object.keys(body) } },
    })
    console.log('[API Settings] Verified settings after update:')
    verifySetting.forEach(s => {
      console.log(`  ${s.key}: ${s.value} (updated: ${s.updatedAt})`)
    })
    
    // Double-check the marketplace setting specifically
    if (body.ADS_CREATOR_MARKETPLACE_ENABLED !== undefined) {
      const marketplaceCheck = await prisma.adminSetting.findUnique({
        where: { key: 'ADS_CREATOR_MARKETPLACE_ENABLED' },
      })
      console.log('[API Settings] Marketplace setting verification:', {
        exists: !!marketplaceCheck,
        value: marketplaceCheck?.value,
        updatedAt: marketplaceCheck?.updatedAt,
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to update settings:', error)
    return NextResponse.json(
      { error: 'Failed to update settings' },
      { status: 500 }
    )
  }
}

