import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/auth/session-utils'
import { prisma } from '@/lib/db/prisma'

export const dynamic = 'force-dynamic'

// Helper function to generate slug from title
function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove special chars
    .replace(/[\s_-]+/g, '-')  // Replace spaces with hyphens
    .replace(/^-+|-+$/g, '')   // Remove leading/trailing hyphens
}

// GET /api/admin/blog - List all blog posts
export async function GET(request: NextRequest) {
  try {
    const userId = await verifyAdmin()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') // DRAFT, PUBLISHED, SCHEDULED, ARCHIVED
    const search = searchParams.get('search')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const skip = (page - 1) * limit

    const where: any = {}
    if (status) {
      where.status = status
    }
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { excerpt: { contains: search, mode: 'insensitive' } },
        { content: { contains: search, mode: 'insensitive' } },
      ]
    }

    const [posts, total] = await Promise.all([
      prisma.blogPost.findMany({
        where,
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
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: limit,
      }),
      prisma.blogPost.count({ where }),
    ])

    return NextResponse.json({
      posts: posts.map(post => ({
        ...post,
        categories: post.categories.map(c => c.category),
        tags: post.tags.map(t => t.tag),
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('Failed to fetch blog posts:', error)
    return NextResponse.json(
      { error: 'Failed to fetch blog posts' },
      { status: 500 }
    )
  }
}

// POST /api/admin/blog - Create new blog post
export async function POST(request: NextRequest) {
  try {
    const userId = await verifyAdmin()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      title,
      excerpt,
      content,
      metaTitle,
      metaDescription,
      keywords,
      ogImage,
      status = 'DRAFT',
      publishedAt,
      featuredImageId,
      categoryIds = [],
      tagIds = [],
      featured = false,
    } = body

    if (!title || !content) {
      return NextResponse.json(
        { error: 'Title and content are required' },
        { status: 400 }
      )
    }

    // Generate slug from title
    let slug = generateSlug(title)
    
    // Ensure slug is unique
    let slugExists = await prisma.blogPost.findUnique({ where: { slug } })
    let counter = 1
    while (slugExists) {
      slug = `${generateSlug(title)}-${counter}`
      slugExists = await prisma.blogPost.findUnique({ where: { slug } })
      counter++
    }

    // Create blog post
    const post = await prisma.blogPost.create({
      data: {
        slug,
        title,
        excerpt,
        content,
        metaTitle: metaTitle || title,
        metaDescription,
        keywords,
        ogImage,
        status,
        // Automatically set publishedAt to now when status is PUBLISHED
        publishedAt: status === 'PUBLISHED' ? new Date() : null,
        authorId: userId,
        featuredImageId,
        featured,
        categories: {
          create: categoryIds.map((categoryId: string) => ({
            categoryId,
          })),
        },
        tags: {
          create: tagIds.map((tagId: string) => ({
            tagId,
          })),
        },
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
    console.error('Failed to create blog post:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create blog post' },
      { status: 500 }
    )
  }
}

