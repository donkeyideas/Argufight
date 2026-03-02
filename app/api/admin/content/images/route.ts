import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/auth/session-utils'
import { prisma } from '@/lib/db/prisma'
import { put } from '@vercel/blob'

export const dynamic = 'force-dynamic'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const MAX_BASE64_SIZE = 1 * 1024 * 1024 // 1MB - base64 fallback limit

// POST /api/admin/content/images - Upload image for section
export async function POST(request: NextRequest) {
  try {
    const userId = await verifyAdmin()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const fileEntry = formData.get('image')
    const file = fileEntry instanceof File ? fileEntry : null
    const sectionId = (formData.get('sectionId') as string | null) || ''
    const imagePosition = (formData.get('imagePosition') as string | null) || 'left'

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
    const filename = `homepage/${crypto.randomBytes(16).toString('hex')}.${fileExtension}`

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
      // Only use base64 fallback for small images
      if (file.size > MAX_BASE64_SIZE) {
        return NextResponse.json(
          { 
            error: 'Vercel Blob Storage is not configured. Please set BLOB_READ_WRITE_TOKEN in your environment variables. Images larger than 1MB require Blob Storage.',
            details: blobError?.message
          },
          { status: 500 }
        )
      }
      
      // Fallback: Store as base64 data URL (only for small images)
      console.warn('Vercel Blob Storage not available, using base64 fallback for small image:', blobError)
      const base64 = buffer.toString('base64')
      imageUrl = `data:${file.type};base64,${base64}`
    }

    // Get image dimensions (simplified - you might want to use sharp or similar)
    // For now, we'll just save the URL

    // Save to media library
    const media = await prisma.mediaLibrary.create({
      data: {
        url: imageUrl,
        filename: file.name,
        fileSize: file.size,
        mimeType: file.type,
        usedIn: `homepage:${sectionId}`,
        uploadedBy: userId,
      },
    })

    // Add to section (only if sectionId is provided and valid)
    let image = null
    if (sectionId && sectionId.trim() !== '') {
      try {
        const section = await prisma.homepageSection.findUnique({
          where: { id: sectionId },
          include: { images: true },
        })

        if (!section) {
          // Don't fail the upload, just don't add to section
          console.warn(`Section ${sectionId} not found, image saved to media library only`)
        } else {
          const maxOrder = section.images?.length || 0

          image = await prisma.homepageImage.create({
            data: {
              sectionId,
              url: imageUrl,
              order: maxOrder,
              imagePosition: imagePosition === 'right' ? 'right' : 'left',
            },
          })
        }
      } catch (sectionError) {
        // Don't fail the upload if section creation fails
        console.error('Failed to add image to section:', sectionError)
      }
    }

    // Invalidate the unstable_cache used by the homepage
    const { revalidateTag } = await import('next/cache')
    revalidateTag('homepage-sections', 'tag')

    return NextResponse.json({ 
      image, 
      media,
      success: true 
    })
  } catch (error: any) {
    console.error('Failed to upload image:', error)
    const errorMessage = error.message || 'Failed to upload image'
    return NextResponse.json(
      { 
        error: errorMessage,
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}

