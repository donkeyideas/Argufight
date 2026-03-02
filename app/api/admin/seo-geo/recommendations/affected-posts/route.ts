import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/auth/session-utils'
import { prisma } from '@/lib/db/prisma'

export const dynamic = 'force-dynamic'

interface AffectedPost {
  id: string
  title: string
  slug: string
  wordCount?: number
  status: string
  publishedAt: string | null
}

export async function GET(request: NextRequest) {
  try {
    const userId = await verifyAdmin()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')

    if (!type) {
      return NextResponse.json({ error: 'Missing type parameter' }, { status: 400 })
    }

    let posts: AffectedPost[] = []
    let description = ''

    switch (type) {
      case 'thin_content': {
        const allPosts = await prisma.blogPost.findMany({
          where: { status: 'PUBLISHED' },
          select: { id: true, title: true, slug: true, content: true, status: true, publishedAt: true },
        })
        posts = allPosts
          .map((p) => ({
            id: p.id,
            title: p.title,
            slug: p.slug,
            wordCount: p.content.replace(/<[^>]*>/g, '').split(/\s+/).filter(Boolean).length,
            status: p.status,
            publishedAt: p.publishedAt?.toISOString() ?? null,
          }))
          .filter((p) => p.wordCount < 300)
          .sort((a, b) => (a.wordCount ?? 0) - (b.wordCount ?? 0))
        description = 'Blog posts with fewer than 300 words. Expand to 500+ words for better SEO.'
        break
      }

      case 'missing_images': {
        const result = await prisma.blogPost.findMany({
          where: {
            status: 'PUBLISHED',
            OR: [{ ogImage: null }, { ogImage: '' }],
            featuredImageId: null,
          },
          select: { id: true, title: true, slug: true, status: true, publishedAt: true },
        })
        posts = result.map((p) => ({
          id: p.id,
          title: p.title,
          slug: p.slug,
          status: p.status,
          publishedAt: p.publishedAt?.toISOString() ?? null,
        }))
        description = 'Blog posts missing both OG image and featured image.'
        break
      }

      case 'missing_categories': {
        const result = await prisma.blogPost.findMany({
          where: {
            status: 'PUBLISHED',
            categories: { none: {} },
          },
          select: { id: true, title: true, slug: true, status: true, publishedAt: true },
        })
        posts = result.map((p) => ({
          id: p.id,
          title: p.title,
          slug: p.slug,
          status: p.status,
          publishedAt: p.publishedAt?.toISOString() ?? null,
        }))
        description = 'Blog posts without any assigned category.'
        break
      }

      case 'duplicate_titles': {
        const allPosts = await prisma.blogPost.findMany({
          where: { status: 'PUBLISHED' },
          select: { id: true, title: true, slug: true, status: true, publishedAt: true },
          orderBy: { createdAt: 'asc' },
        })
        const titleMap = new Map<string, typeof allPosts>()
        for (const post of allPosts) {
          const key = post.title.toLowerCase().trim()
          if (!titleMap.has(key)) titleMap.set(key, [])
          titleMap.get(key)!.push(post)
        }
        const dupes = [...titleMap.values()].filter((arr) => arr.length > 1).flat()
        posts = dupes.map((p) => ({
          id: p.id,
          title: p.title,
          slug: p.slug,
          status: p.status,
          publishedAt: p.publishedAt?.toISOString() ?? null,
        }))
        description = 'Blog posts with duplicate titles. Each post should have a unique title.'
        break
      }

      case 'missing_meta_titles': {
        const result = await prisma.blogPost.findMany({
          where: {
            status: 'PUBLISHED',
            OR: [{ metaTitle: null }, { metaTitle: '' }],
          },
          select: { id: true, title: true, slug: true, status: true, publishedAt: true },
        })
        posts = result.map((p) => ({
          id: p.id,
          title: p.title,
          slug: p.slug,
          status: p.status,
          publishedAt: p.publishedAt?.toISOString() ?? null,
        }))
        description = 'Blog posts missing custom meta titles (50-60 chars recommended).'
        break
      }

      case 'missing_meta_descriptions': {
        const result = await prisma.blogPost.findMany({
          where: {
            status: 'PUBLISHED',
            OR: [{ metaDescription: null }, { metaDescription: '' }],
          },
          select: { id: true, title: true, slug: true, status: true, publishedAt: true },
        })
        posts = result.map((p) => ({
          id: p.id,
          title: p.title,
          slug: p.slug,
          status: p.status,
          publishedAt: p.publishedAt?.toISOString() ?? null,
        }))
        description = 'Blog posts missing meta descriptions (120-160 chars recommended).'
        break
      }

      case 'missing_featured_images': {
        const result = await prisma.blogPost.findMany({
          where: {
            status: 'PUBLISHED',
            featuredImageId: null,
          },
          select: { id: true, title: true, slug: true, status: true, publishedAt: true },
        })
        posts = result.map((p) => ({
          id: p.id,
          title: p.title,
          slug: p.slug,
          status: p.status,
          publishedAt: p.publishedAt?.toISOString() ?? null,
        }))
        description = 'Blog posts without a featured image.'
        break
      }

      default:
        return NextResponse.json({ error: 'Unknown type' }, { status: 400 })
    }

    return NextResponse.json({ posts, description, count: posts.length })
  } catch (error) {
    console.error('Error fetching affected posts:', error)
    return NextResponse.json({ error: 'Failed to fetch affected posts' }, { status: 500 })
  }
}
