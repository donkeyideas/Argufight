import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/auth/session-utils'
import { prisma } from '@/lib/db/prisma'

export const dynamic = 'force-dynamic'

// GET /api/admin/content/social-media - Get all social media links
export async function GET() {
  try {
    const userId = await verifyAdmin()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const links = await prisma.socialMediaLink.findMany({
      orderBy: { order: 'asc' },
    })

    return NextResponse.json({ links })
  } catch (error: any) {
    console.error('Failed to fetch social media links:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch social media links' },
      { status: error.status || 500 }
    )
  }
}

// POST /api/admin/content/social-media - Create or update social media link
export async function POST(request: NextRequest) {
  try {
    const userId = await verifyAdmin()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { platform, url, order, isActive } = body

    if (!platform || !url) {
      return NextResponse.json(
        { error: 'Platform and URL are required' },
        { status: 400 }
      )
    }

    // Upsert (create or update)
    const link = await prisma.socialMediaLink.upsert({
      where: { platform },
      update: {
        url,
        order: order ?? 0,
        isActive: isActive !== false,
      },
      create: {
        platform,
        url,
        order: order ?? 0,
        isActive: isActive !== false,
      },
    })

    return NextResponse.json({ link })
  } catch (error: any) {
    console.error('Failed to save social media link:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to save social media link' },
      { status: error.status || 500 }
    )
  }
}

// DELETE /api/admin/content/social-media - Delete social media link
export async function DELETE(request: NextRequest) {
  try {
    const userId = await verifyAdmin()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const platform = searchParams.get('platform')

    if (!platform) {
      return NextResponse.json(
        { error: 'Platform is required' },
        { status: 400 }
      )
    }

    await prisma.socialMediaLink.delete({
      where: { platform },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Failed to delete social media link:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to delete social media link' },
      { status: error.status || 500 }
    )
  }
}

