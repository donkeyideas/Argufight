import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/auth/session-utils'
import { prisma } from '@/lib/db/prisma'
import { put } from '@vercel/blob'

export const dynamic = 'force-dynamic'

// GET /api/admin/advertisements/[id] - Get a specific advertisement
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

    const ad = await prisma.advertisement.findUnique({
      where: { id },
    })

    if (!ad) {
      return NextResponse.json(
        { error: 'Advertisement not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ ad })
  } catch (error: any) {
    console.error('Failed to fetch advertisement:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch advertisement' },
      { status: error.status || 500 }
    )
  }
}

// PUT /api/admin/advertisements/[id] - Update an advertisement
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await verifyAdmin()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    console.log(`[Update Ad API] Updating advertisement ${id}`)
    
    const formData = await request.formData()
    const title = formData.get('title') as string
    const type = formData.get('type') as string
    const targetUrl = formData.get('targetUrl') as string
    const status = formData.get('status') as string
    const startDate = formData.get('startDate') as string
    const endDate = formData.get('endDate') as string
    const category = formData.get('category') as string
    const file = formData.get('file') as File | null
    const creativeUrl = formData.get('creativeUrl') as string

    console.log(`[Update Ad API] Received data:`, {
      title,
      type,
      targetUrl,
      status,
      hasFile: !!file,
      creativeUrl: creativeUrl ? 'provided' : 'not provided',
    })

    const updateData: any = {}
    if (title !== undefined && title !== null) updateData.title = title.trim()
    if (type !== undefined && type !== null) {
      if (!['BANNER', 'SPONSORED_DEBATE', 'IN_FEED'].includes(type)) {
        return NextResponse.json(
          { error: 'type must be BANNER, SPONSORED_DEBATE, or IN_FEED' },
          { status: 400 }
        )
      }
      updateData.type = type
    }
    if (targetUrl !== undefined && targetUrl !== null) updateData.targetUrl = targetUrl.trim()
    if (status !== undefined && status !== null) updateData.status = status
    if (startDate !== undefined && startDate !== null) updateData.startDate = startDate ? new Date(startDate) : null
    if (endDate !== undefined && endDate !== null) updateData.endDate = endDate ? new Date(endDate) : null
    if (category !== undefined) updateData.category = category?.trim() || null

    if (file) {
      // Upload new file
      console.log(`[Update Ad API] Uploading new file: ${file.name}`)
      const blob = await put(`advertisements/${Date.now()}-${file.name}`, file, {
        access: 'public',
      })
      updateData.creativeUrl = blob.url
      console.log(`[Update Ad API] New file uploaded to: ${blob.url}`)
    } else if (creativeUrl && creativeUrl.trim()) {
      // Allow URL update - always update if provided
      updateData.creativeUrl = creativeUrl.trim()
      console.log(`[Update Ad API] Updating creativeUrl to: ${updateData.creativeUrl}`)
    }
    // If no file and no URL provided, keep existing creativeUrl (don't update it)

    console.log(`[Update Ad API] Updating with data:`, updateData)
    const ad = await prisma.advertisement.update({
      where: { id },
      data: updateData,
    })

    console.log(`[Update Ad API] ✅ Successfully updated ad ${id}`)
    return NextResponse.json({ ad })
  } catch (error: any) {
    console.error('Failed to update advertisement:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update advertisement' },
      { status: error.status || 500 }
    )
  }
}

// DELETE /api/admin/advertisements/[id] - Delete an advertisement
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

    await prisma.advertisement.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Failed to delete advertisement:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to delete advertisement' },
      { status: error.status || 500 }
    )
  }
}

