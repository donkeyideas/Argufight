import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'

// GET /api/blog/[slug] - Get single published blog post (public)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params

    const post = await prisma.blogPost.findUnique({
      where: { slug },
      include: {
        author: {
          select: {
            id: true,
            username: true,
            avatarUrl: true,
            bio: true,
          },
        },
        featuredImage: {
          select: {
            id: true,
            url: true,
            alt: true,
          },
        },
        categories: {
          include: {
            category: true,
          },
        },
        tags: {
          include: {
            tag: true,
          },
        },
      },
    })

    if (!post) {
      return NextResponse.json({ error: 'Blog post not found' }, { status: 404 })
    }

    // Only return published posts
    if (post.status !== 'PUBLISHED') {
      return NextResponse.json({ error: 'Blog post not found' }, { status: 404 })
    }

    // Check if published date is in the future (scheduled)
    if (post.publishedAt && post.publishedAt > new Date()) {
      return NextResponse.json({ error: 'Blog post not found' }, { status: 404 })
    }

    // Increment view count
    await prisma.blogPost.update({
      where: { id: post.id },
      data: {
        views: {
          increment: 1,
        },
      },
    })

    return NextResponse.json({
      post: {
        ...post,
        views: post.views + 1, // Return incremented count
        categories: post.categories.map(c => c.category),
        tags: post.tags.map(t => t.tag),
      },
    })
  } catch (error) {
    console.error('Failed to fetch blog post:', error)
    return NextResponse.json(
      { error: 'Failed to fetch blog post' },
      { status: 500 }
    )
  }
}

