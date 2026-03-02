import { NextRequest, NextResponse } from 'next/server'
import { verifySession } from '@/lib/auth/session'
import { prisma } from '@/lib/db/prisma'
import { getUserIdFromSession } from '@/lib/auth/session-utils'
import { put } from '@vercel/blob'
import { randomBytes } from 'crypto'

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB

// POST /api/profile/avatar - Upload profile picture
export async function POST(request: NextRequest) {
  try {
    const session = await verifySession()
    const userId = getUserIdFromSession(session)

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData() as any
    const file = formData.get('avatar') as File

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
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

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File size must be less than 5MB' },
        { status: 400 }
      )
    }

    // Convert file to buffer
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // Generate unique filename
    const fileExtension = file.name.split('.').pop() || 'jpg'
    const filename = `avatars/${userId}-${randomBytes(16).toString('hex')}.${fileExtension}`

    let avatarUrl: string

    // Try to upload to Vercel Blob Storage
    try {
      const blob = await put(filename, buffer, {
        access: 'public',
        contentType: file.type,
      })
      avatarUrl = blob.url
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
      avatarUrl = `data:${file.type};base64,${base64}`
    }

    // Save avatar URL to database
    await prisma.user.update({
      where: { id: userId },
      data: { avatarUrl },
    })

    return NextResponse.json({ avatarUrl })
  } catch (error: any) {
    console.error('Failed to upload avatar:', error)
    return NextResponse.json(
      { error: 'Failed to upload avatar', details: error.message },
      { status: 500 }
    )
  }
}

