import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/auth/session-utils'
import { prisma } from '@/lib/db/prisma'
import { generateWithDeepSeek } from '@/lib/ai/deepseek'
import { getUserIdFromSession } from '@/lib/auth/session-utils'
import { verifySession } from '@/lib/auth/session'

export const dynamic = 'force-dynamic'

// POST /api/admin/marketing/blog/generate - Generate blog post
export async function POST(request: NextRequest) {
  try {
    const session = await verifySession()
    const userId = getUserIdFromSession(session)
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is admin
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { isAdmin: true },
    })

    if (!user?.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { topic, strategyId, calendarItemId } = body

    if (!topic) {
      return NextResponse.json(
        { error: 'Topic is required' },
        { status: 400 }
      )
    }

    // Generate blog post using AI
    const prompt = `Write a comprehensive, SEO-optimized blog post about "${topic}" for an AI-judged debate platform called "Argu Fight".

Requirements:
- Title: Create an engaging, SEO-friendly title
- Excerpt: Write a compelling 2-3 sentence excerpt
- Content: Write a full blog post (800-1200 words) with:
  * Introduction that hooks the reader
  * Well-structured sections with subheadings
  * Engaging, informative content
  * Call-to-action at the end
- SEO: Include relevant keywords naturally
- Tone: Professional but approachable, informative

Format the response as JSON:
{
  "title": "Blog post title",
  "excerpt": "Short excerpt",
  "content": "Full blog post content in HTML format",
  "keywords": "keyword1, keyword2, keyword3",
  "metaDescription": "SEO meta description"
}`

    const response = await generateWithDeepSeek(prompt, {
      temperature: 0.7,
      maxTokens: 3000,
    })

    let blogData
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        blogData = JSON.parse(jsonMatch[0])
      } else {
        // Fallback
        const lines = response.split('\n')
        blogData = {
          title: lines[0] || topic,
          excerpt: lines.slice(1, 3).join(' ') || `Learn about ${topic} on Argu Fight`,
          content: response,
          keywords: topic.toLowerCase().replace(/\s+/g, ', '),
          metaDescription: `Discover ${topic} on Argu Fight - the AI-judged debate platform`,
        }
      }
    } catch (error) {
      blogData = {
        title: topic,
        excerpt: `Learn about ${topic} on Argu Fight`,
        content: response,
        keywords: topic.toLowerCase().replace(/\s+/g, ', '),
        metaDescription: `Discover ${topic} on Argu Fight`,
      }
    }

    // Generate slug from title
    const slug = blogData.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')

    // Check if slug exists
    const existingPost = await prisma.blogPost.findUnique({
      where: { slug },
    })

    const finalSlug = existingPost ? `${slug}-${Date.now()}` : slug

    // Create blog post
    const blogPost = await prisma.blogPost.create({
      data: {
        title: blogData.title,
        slug: finalSlug,
        excerpt: blogData.excerpt,
        content: blogData.content,
        keywords: blogData.keywords,
        metaDescription: blogData.metaDescription,
        authorId: userId,
        status: 'DRAFT',
        strategyId: strategyId || null,
        calendarItemId: calendarItemId || null,
      },
    })

    return NextResponse.json({
      success: true,
      blogPost,
    })
  } catch (error: any) {
    console.error('Failed to generate blog post:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to generate blog post' },
      { status: 500 }
    )
  }
}

