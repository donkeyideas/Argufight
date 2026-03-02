import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'

// GET /api/content/social-media - Get active social media links (public)
export async function GET() {
  try {
    const links = await prisma.socialMediaLink.findMany({
      where: { isActive: true },
      orderBy: { order: 'asc' },
      select: {
        platform: true,
        url: true,
      },
    })

    return NextResponse.json({ links })
  } catch (error) {
    console.error('Failed to fetch social media links:', error)
    return NextResponse.json(
      { error: 'Failed to fetch social media links' },
      { status: 500 }
    )
  }
}

