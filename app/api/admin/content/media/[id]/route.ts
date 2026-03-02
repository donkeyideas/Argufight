import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/auth/session-utils'
import { prisma } from '@/lib/db/prisma'
import { del } from '@vercel/blob'

export const dynamic = 'force-dynamic'

// DELETE /api/admin/content/media/[id] - Delete media from library
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

    // Find the media item
    const media = await prisma.mediaLibrary.findUnique({
      where: { id },
    })

    if (!media) {
      return NextResponse.json({ error: 'Media not found' }, { status: 404 })
    }

    // Delete from Vercel Blob Storage if it's a blob URL
    if (media.url.includes('blob.vercel-storage.com')) {
      try {
        await del(media.url)
      } catch (blobError) {
        console.warn('Failed to delete from blob storage:', blobError)
        // Continue with database deletion even if blob deletion fails
      }
    }

    // Delete from database
    await prisma.mediaLibrary.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete media:', error)
    return NextResponse.json(
      { error: 'Failed to delete media' },
      { status: 500 }
    )
  }
}

