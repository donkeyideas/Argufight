import { NextRequest, NextResponse } from 'next/server'
import { verifySession } from '@/lib/auth/session'
import { prisma } from '@/lib/db/prisma'
import { getUserIdFromSession } from '@/lib/auth/session-utils'
import { put } from '@vercel/blob'
import { randomBytes } from 'crypto'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

// POST /api/debates/images - Upload debate image
export async function POST(request: NextRequest) {
  try {
    const session = await verifySession()
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const userId = getUserIdFromSession(session)
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const formData = await request.formData() as any
    const fileEntry = formData.get('image')
    const file = fileEntry instanceof File ? fileEntry : null
    const debateId = (formData.get('debateId') as string | null) || null
    const alt = (formData.get('alt') as string | null) || null
    const caption = (formData.get('caption') as string | null) || null
    const order = parseInt((formData.get('order') as string) || '0')

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: 'No image file provided' },
        { status: 400 }
      )
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      return NextResponse.json(
        { error: 'File must be an image' },
        { status: 400 }
      )
    }

    // Validate file size (max 10MB)
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'Image must be less than 10MB' },
        { status: 400 }
      )
    }

    // Convert file to buffer
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // Generate unique filename
    const timestamp = Date.now()
    const randomStr = randomBytes(16).toString('hex')
    const extension = file.name.split('.').pop() || 'jpg'
    const filename = `debates/${debateId || 'temp'}/${timestamp}-${randomStr}.${extension}`

    let url: string

    // Try to upload to Vercel Blob Storage
    try {
      const blob = await put(filename, buffer, {
        access: 'public',
        contentType: file.type,
      })
      url = blob.url
    } catch (blobError: any) {
      console.error('Failed to upload to Blob Storage:', blobError)
      
      // Fallback to base64 data URL if Blob Storage is not configured
      if (file.size > 1 * 1024 * 1024) { // 1MB limit for base64
        return NextResponse.json(
          { error: 'File too large for fallback storage. Please configure BLOB_READ_WRITE_TOKEN in Vercel.' },
          { status: 500 }
        )
      }
      
      const base64 = buffer.toString('base64')
      url = `data:${file.type};base64,${base64}`
    }

    // If debateId is provided, create the DebateImage record
    if (debateId) {
      const debateImage = await prisma.debateImage.create({
        data: {
          debateId,
          url,
          alt: alt || null,
          caption: caption || null,
          order,
          fileSize: file.size,
          mimeType: file.type,
          uploadedBy: userId,
        },
      })

      return NextResponse.json({ image: debateImage })
    }

    // Otherwise, just return the URL for later association
    return NextResponse.json({
      url,
      alt: alt || null,
      caption: caption || null,
      order,
      fileSize: file.size,
      mimeType: file.type,
    })
  } catch (error: any) {
    console.error('Failed to upload debate image:', error)
    return NextResponse.json(
      { error: 'Failed to upload image', details: error.message },
      { status: 500 }
    )
  }
}

