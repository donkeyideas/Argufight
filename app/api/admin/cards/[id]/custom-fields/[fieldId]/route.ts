import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/auth/session-utils'
import { prisma } from '@/lib/db/prisma'

export const dynamic = 'force-dynamic'

// PATCH /api/admin/cards/[id]/custom-fields/[fieldId] - Update custom field
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; fieldId: string }> }
) {
  try {
    const userId = await verifyAdmin()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { fieldId } = await params
    const body = await request.json()
    const { name, value, fieldType } = body

    const customField = await prisma.cardCustomField.update({
      where: { id: fieldId },
      data: {
        ...(name !== undefined && { name }),
        ...(value !== undefined && { value }),
        ...(fieldType !== undefined && { fieldType }),
      },
    })

    return NextResponse.json({ customField })
  } catch (error: any) {
    console.error('Failed to update custom field:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update custom field' },
      { status: 500 }
    )
  }
}

// DELETE /api/admin/cards/[id]/custom-fields/[fieldId] - Remove custom field
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; fieldId: string }> }
) {
  try {
    const userId = await verifyAdmin()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { fieldId } = await params
    await prisma.cardCustomField.delete({
      where: { id: fieldId },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Failed to remove custom field:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to remove custom field' },
      { status: 500 }
    )
  }
}

