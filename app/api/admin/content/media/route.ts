import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/auth/session-utils'
import { prisma } from '@/lib/db/prisma'
import { put } from '@vercel/blob'

export const dynamic = 'force-dynamic'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

// GET /api/admin/content/media - Get media library
export async function GET() {
  try {
    const userId = await verifyAdmin()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const media = await prisma.mediaLibrary.findMany({
      orderBy: {
        uploadedAt: 'desc',
      },
    })

    return NextResponse.json({ media })
  } catch (error) {
    console.error('Failed to fetch media library:', error)
    return NextResponse.json(
      { error: 'Failed to fetch media library' },
      { status: 500 }
    )
  }
}

// POST /api/admin/content/media - Upload to media library
export async function POST(request: NextRequest) {
  try {
    const userId = await verifyAdmin()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'File must be an image' }, { status: 400 })
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'File size must be less than 10MB' }, { status: 400 })
    }

    // Generate unique filename
    const crypto = require('crypto')
    const fileExtension = file.name.split('.').pop() || 'jpg'
    const filename = `media/${crypto.randomBytes(16).toString('hex')}.${fileExtension}`

    // Upload to Vercel Blob Storage
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    
    let imageUrl: string
    try {
      // Try Vercel Blob Storage first
      const blob = await put(filename, buffer, {
        access: 'public',
        contentType: file.type,
      })
      imageUrl = blob.url
    } catch (blobError) {
      console.error('Vercel Blob Storage error:', blobError)
      // If file is small enough, fall back to base64
      if (file.size <= 1 * 1024 * 1024) {
        const base64 = buffer.toString('base64')
        imageUrl = `data:${file.type};base64,${base64}`
      } else {
        return NextResponse.json(
          {
            error: 'Image upload failed. Vercel Blob Storage is not available and the file is too large for fallback storage. Please check BLOB_READ_WRITE_TOKEN configuration.',
          },
          { status: 500 }
        )
      }
    }

    // Save to media library
    const media = await prisma.mediaLibrary.create({
      data: {
        url: imageUrl,
        filename: file.name,
        fileSize: file.size,
        mimeType: file.type,
        uploadedBy: userId,
      },
    })

    return NextResponse.json({ media })
  } catch (error) {
    console.error('Failed to upload media:', error)
    return NextResponse.json(
      { error: 'Failed to upload media' },
      { status: 500 }
    )
  }
}

