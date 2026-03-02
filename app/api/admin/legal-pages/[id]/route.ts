import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/auth/session-utils'
import { prisma } from '@/lib/db/prisma'

export const dynamic = 'force-dynamic'

// GET /api/admin/legal-pages/[id] - Get a single legal page
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await verifyAdmin()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const page = await prisma.legalPage.findUnique({
      where: { id },
    })

    if (!page) {
      return NextResponse.json({ error: 'Page not found' }, { status: 404 })
    }

    return NextResponse.json({ page })
  } catch (error) {
    console.error('Failed to fetch legal page:', error)
    return NextResponse.json(
      { error: 'Failed to fetch legal page' },
      { status: 500 }
    )
  }
}

// PATCH /api/admin/legal-pages/[id] - Update a legal page
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await verifyAdmin()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const { title, content, metaTitle, metaDescription, isVisible } = body

    const page = await prisma.legalPage.update({
      where: { id },
      data: {
        ...(title !== undefined && { title }),
        ...(content !== undefined && { content }),
        ...(metaTitle !== undefined && { metaTitle }),
        ...(metaDescription !== undefined && { metaDescription }),
        ...(isVisible !== undefined && { isVisible }),
      },
    })

    return NextResponse.json({ page })
  } catch (error: any) {
    console.error('Failed to update legal page:', error)
    if (error.code === 'P2025') {
      return NextResponse.json({ error: 'Page not found' }, { status: 404 })
    }
    return NextResponse.json(
      { error: 'Failed to update legal page' },
      { status: 500 }
    )
  }
}

// DELETE /api/admin/legal-pages/[id] - Delete a legal page
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await verifyAdmin()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    await prisma.legalPage.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Failed to delete legal page:', error)
    if (error.code === 'P2025') {
      return NextResponse.json({ error: 'Page not found' }, { status: 404 })
    }
    return NextResponse.json(
      { error: 'Failed to delete legal page' },
      { status: 500 }
    )
  }
}

