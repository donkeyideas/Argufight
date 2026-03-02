import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { verifyAdmin } from '@/lib/auth/session-utils'
import { prisma } from '@/lib/db/prisma'

export const dynamic = 'force-dynamic'

// GET /api/admin/content/sections - Get all homepage sections
export async function GET() {
  try {
    const userId = await verifyAdmin()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const sections = await prisma.homepageSection.findMany({
      include: {
        images: {
          orderBy: {
            order: 'asc',
          },
        },
        buttons: {
          orderBy: {
            order: 'asc',
          },
        },
      },
      orderBy: {
        order: 'asc',
      },
    })

    return NextResponse.json({ sections })
  } catch (error) {
    console.error('Failed to fetch sections:', error)
    return NextResponse.json(
      { error: 'Failed to fetch sections' },
      { status: 500 }
    )
  }
}

// POST /api/admin/content/sections - Create a new homepage section
export async function POST(request: NextRequest) {
  try {
    const userId = await verifyAdmin()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { key, title, content, order, isVisible, metaTitle, metaDescription } = body

    if (!key) {
      return NextResponse.json({ error: 'Section key is required' }, { status: 400 })
    }

    // Check if key already exists
    const existing = await prisma.homepageSection.findUnique({
      where: { key },
    })

    if (existing) {
      return NextResponse.json({ error: 'Section with this key already exists' }, { status: 400 })
    }

    // Get max order if order not provided
    let sectionOrder = order
    if (sectionOrder === undefined || sectionOrder === null) {
      const maxOrderSection = await prisma.homepageSection.findFirst({
        orderBy: { order: 'desc' },
        select: { order: true },
      })
      sectionOrder = maxOrderSection ? maxOrderSection.order + 1 : 0
    }

    const section = await prisma.homepageSection.create({
      data: {
        key,
        title: title || null,
        content: content || null,
        order: sectionOrder,
        isVisible: isVisible !== undefined ? isVisible : true,
        metaTitle: metaTitle || null,
        metaDescription: metaDescription || null,
      },
      include: {
        images: true,
        buttons: true,
      },
    })

    // Invalidate the unstable_cache used by the homepage
    revalidateTag('homepage-sections', 'tag')

    return NextResponse.json({ section }, { status: 201 })
  } catch (error: any) {
    console.error('Failed to create section:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create section' },
      { status: 500 }
    )
  }
}

