import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/auth/session-utils'
import { put } from '@vercel/blob'
import { randomBytes } from 'crypto'

export const dynamic = 'force-dynamic'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const MAX_BASE64_SIZE = 1 * 1024 * 1024 // 1MB - base64 fallback limit

// POST /api/admin/belts/images - Upload belt design image
export async function POST(request: NextRequest) {
  try {
    const userId = await verifyAdmin()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('image') as File

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
    const fileExtension = file.name.split('.').pop() || 'jpg'
    const randomStr = randomBytes(8).toString('hex')
    const timestamp = Date.now()
    const filename = `belts/${timestamp}-${randomStr}.${fileExtension}`

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
    } catch (blobError: any) {
      // Fallback: Store as base64 data URL (only for small images)
      if (file.size > MAX_BASE64_SIZE) {
        return NextResponse.json(
          { 
            error: 'Vercel Blob Storage is not configured. Please set BLOB_READ_WRITE_TOKEN in your environment variables. Images larger than 1MB require Blob Storage.',
            details: blobError?.message
          },
          { status: 500 }
        )
      }
      
      console.warn('Vercel Blob Storage not available, using base64 fallback for small image:', blobError)
      const base64 = buffer.toString('base64')
      imageUrl = `data:${file.type};base64,${base64}`
    }

    return NextResponse.json({ 
      url: imageUrl,
      filename: file.name,
      fileSize: file.size,
      mimeType: file.type,
    })
  } catch (error: any) {
    console.error('Failed to upload belt image:', error)
    return NextResponse.json(
      { error: 'Failed to upload image', details: error.message },
      { status: 500 }
    )
  }
}
