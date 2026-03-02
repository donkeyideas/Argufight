import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/auth/session-utils'
import { prisma } from '@/lib/db/prisma'
import { publishPost } from '@/lib/social/publisher'

export const dynamic = 'force-dynamic'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const userId = await verifyAdmin()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const post = await prisma.socialMediaPost.findUnique({ where: { id } })
    if (!post) return NextResponse.json({ error: 'Post not found' }, { status: 404 })

    const result = await publishPost(post.platform, post.content, post.hashtags)

    if (result.success) {
      await prisma.socialMediaPost.update({
        where: { id },
        data: {
          status: 'PUBLISHED',
          publishedAt: new Date(),
        },
      })
    } else {
      await prisma.socialMediaPost.update({
        where: { id },
        data: { status: 'FAILED' },
      })
    }

    return NextResponse.json(result)
  } catch (error: any) {
    console.error('publish error:', error)
    return NextResponse.json({ error: error.message ?? 'Publish failed' }, { status: 500 })
  }
}
