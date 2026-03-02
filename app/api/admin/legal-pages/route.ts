import { NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/auth/session-utils'
import { prisma } from '@/lib/db/prisma'

export const dynamic = 'force-dynamic'

// GET /api/admin/legal-pages - Get all legal pages
export async function GET() {
  try {
    const userId = await verifyAdmin()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const pages = await prisma.legalPage.findMany({
      orderBy: { slug: 'asc' },
    })

    return NextResponse.json({ pages })
  } catch (error) {
    console.error('Failed to fetch legal pages:', error)
    return NextResponse.json(
      { error: 'Failed to fetch legal pages' },
      { status: 500 }
    )
  }
}

// POST /api/admin/legal-pages - Create a new legal page
export async function POST(request: Request) {
  try {
    const userId = await verifyAdmin()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { slug, title, content, metaTitle, metaDescription, isVisible } = body

    if (!slug || !title || !content) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const page = await prisma.legalPage.create({
      data: {
        slug,
        title,
        content,
        metaTitle,
        metaDescription,
        isVisible: isVisible !== undefined ? isVisible : true,
      },
    })

    return NextResponse.json({ page })
  } catch (error: any) {
    console.error('Failed to create legal page:', error)
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'A page with this slug already exists' },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: 'Failed to create legal page' },
      { status: 500 }
    )
  }
}










