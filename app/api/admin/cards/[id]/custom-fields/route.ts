import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/auth/session-utils'
import { prisma } from '@/lib/db/prisma'

export const dynamic = 'force-dynamic'

// POST /api/admin/cards/[id]/custom-fields - Add custom field to card
export async function POST(
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
    const { name, value, fieldType } = body

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    // Get current max position
    const maxField = await prisma.cardCustomField.findFirst({
      where: { cardId: id },
      orderBy: { position: 'desc' },
    })

    const customField = await prisma.cardCustomField.create({
      data: {
        cardId: id,
        name,
        value: value || '',
        fieldType: fieldType || 'text',
        position: (maxField?.position || 0) + 1,
      },
    })

    return NextResponse.json({ customField })
  } catch (error: any) {
    console.error('Failed to add custom field:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to add custom field' },
      { status: 500 }
    )
  }
}

// GET /api/admin/cards/[id]/custom-fields - Get all custom fields for a card
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
    const customFields = await prisma.cardCustomField.findMany({
      where: { cardId: id },
      orderBy: { position: 'asc' },
    })

    return NextResponse.json({ customFields })
  } catch (error: any) {
    console.error('Failed to fetch custom fields:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch custom fields' },
      { status: 500 }
    )
  }
}

