import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/auth/session-utils'
import { prisma } from '@/lib/db/prisma'

export const dynamic = 'force-dynamic'

// Helper function to generate slug from title
function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

// GET /api/admin/blog/[id] - Get single blog post
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

    const post = await prisma.blogPost.findUnique({
      where: { id },
      include: {
        author: {
          select: {
            id: true,
            username: true,
            email: true,
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

    return NextResponse.json({
      post: {
        ...post,
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

// PATCH /api/admin/blog/[id] - Update blog post
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await verifyAdmin()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()

    const {
      title,
      excerpt,
      content,
      metaTitle,
      metaDescription,
      keywords,
      ogImage,
      status,
      publishedAt,
      featuredImageId,
      categoryIds,
      tagIds,
      featured,
    } = body

    // Check if post exists
    const existingPost = await prisma.blogPost.findUnique({
      where: { id },
    })

    if (!existingPost) {
      return NextResponse.json({ error: 'Blog post not found' }, { status: 404 })
    }

    // If title changed, regenerate slug
    let slug = existingPost.slug
    if (title && title !== existingPost.title) {
      slug = generateSlug(title)
      // Ensure slug is unique (excluding current post)
      let slugExists = await prisma.blogPost.findFirst({
        where: {
          slug,
          id: { not: id },
        },
      })
      let counter = 1
      while (slugExists) {
        slug = `${generateSlug(title)}-${counter}`
        slugExists = await prisma.blogPost.findFirst({
          where: {
            slug,
            id: { not: id },
          },
        })
        counter++
      }
    }

    // Update categories and tags
    if (categoryIds !== undefined) {
      // Delete existing category relations
      await prisma.blogPostToCategory.deleteMany({
        where: { postId: id },
      })
      // Create new category relations
      if (categoryIds.length > 0) {
        await prisma.blogPostToCategory.createMany({
          data: categoryIds.map((categoryId: string) => ({
            postId: id,
            categoryId,
          })),
        })
      }
    }

    if (tagIds !== undefined) {
      // Delete existing tag relations
      await prisma.blogPostToTag.deleteMany({
        where: { postId: id },
      })
      // Create new tag relations
      if (tagIds.length > 0) {
        await prisma.blogPostToTag.createMany({
          data: tagIds.map((tagId: string) => ({
            postId: id,
            tagId,
          })),
        })
      }
    }

    // Determine publishedAt: if status is PUBLISHED and it wasn't published before, set to now
    let finalPublishedAt = existingPost.publishedAt
    if (status === 'PUBLISHED') {
      if (!existingPost.publishedAt) {
        // First time publishing - set to now
        finalPublishedAt = new Date()
      }
      // If already published, keep the original publishedAt
    } else if (publishedAt !== undefined) {
      // For other statuses, use provided publishedAt or null
      finalPublishedAt = publishedAt ? new Date(publishedAt) : null
    }

    // Update post
    const post = await prisma.blogPost.update({
      where: { id },
      data: {
        ...(slug !== existingPost.slug && { slug }),
        ...(title && { title }),
        ...(excerpt !== undefined && { excerpt }),
        ...(content && { content }),
        ...(metaTitle !== undefined && { metaTitle }),
        ...(metaDescription !== undefined && { metaDescription }),
        ...(keywords !== undefined && { keywords }),
        ...(ogImage !== undefined && { ogImage }),
        ...(status && { status }),
        ...(finalPublishedAt !== undefined && { publishedAt: finalPublishedAt }),
        ...(featuredImageId !== undefined && { featuredImageId }),
        ...(featured !== undefined && { featured }),
      },
      include: {
        author: {
          select: {
            id: true,
            username: true,
            email: true,
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

    return NextResponse.json({
      post: {
        ...post,
        categories: post.categories.map(c => c.category),
        tags: post.tags.map(t => t.tag),
      },
    })
  } catch (error: any) {
    console.error('Failed to update blog post:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update blog post' },
      { status: 500 }
    )
  }
}

// DELETE /api/admin/blog/[id] - Delete blog post
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

    // Check if post exists
    const post = await prisma.blogPost.findUnique({
      where: { id },
    })

    if (!post) {
      return NextResponse.json({ error: 'Blog post not found' }, { status: 404 })
    }

    // Delete post (cascade will handle relations)
    await prisma.blogPost.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete blog post:', error)
    return NextResponse.json(
      { error: 'Failed to delete blog post' },
      { status: 500 }
    )
  }
}

