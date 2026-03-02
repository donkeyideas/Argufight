import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/auth/session-utils'
import { createDeepSeekClient } from '@/lib/ai/deepseek'
import { logApiUsage } from '@/lib/ai/api-tracking'

export const dynamic = 'force-dynamic'

// POST /api/admin/blog/generate - Generate blog content with AI (does NOT save to DB)
export async function POST(request: NextRequest) {
  try {
    const userId = await verifyAdmin()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { title } = body

    if (!title?.trim()) {
      return NextResponse.json(
        { error: 'Title is required' },
        { status: 400 }
      )
    }

    const client = await createDeepSeekClient()
    const startTime = Date.now()

    const prompt = `You are a content writer for "ArguFight", an AI-judged debate platform where users engage in structured debates on various topics.

Write a comprehensive, engaging blog post based on this title: "${title}"

Requirements:
- Content: 800-1200 words in HTML format using <h2>, <h3>, <p>, <ul>/<li>, <strong>, and <em> tags. Do NOT include <h1> or the title in the content.
- Excerpt: 2-3 compelling sentences summarizing the post (plain text, no HTML)
- Meta Description: Under 155 characters, SEO-optimized (plain text)
- Keywords: 5-8 comma-separated relevant keywords
- Suggested Tags: 3-5 short tag names relevant to the content
- Tone: Professional but approachable, conversational
- Internal links: Include 2-3 links to ArguFight pages using relative URLs like <a href="/debates">explore debates</a>, <a href="/signup">join ArguFight</a>, <a href="/blog">read more articles</a>
- External links: Include 1-2 links to reputable external sources (studies, articles, Wikipedia) relevant to the topic to add credibility
- Include a call-to-action encouraging readers to start a debate on ArguFight

Respond ONLY with valid JSON (no markdown code blocks):
{
  "content": "HTML content here",
  "excerpt": "Short excerpt here",
  "metaDescription": "SEO meta description here",
  "keywords": "keyword1, keyword2, keyword3",
  "suggestedTags": ["tag1", "tag2", "tag3"]
}`

    try {
      const completion = await client.chat.completions.create({
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 3000,
      })

      const responseTime = Date.now() - startTime
      const usage = completion.usage

      await logApiUsage({
        provider: 'deepseek',
        endpoint: 'chat/completions',
        model: 'deepseek-chat',
        promptTokens: usage?.prompt_tokens,
        completionTokens: usage?.completion_tokens,
        totalTokens: usage?.total_tokens,
        userId,
        success: true,
        responseTime,
      })

      const responseText = completion.choices[0].message.content || '{}'
      const cleaned = responseText
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim()

      let generated
      try {
        const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          generated = JSON.parse(jsonMatch[0])
        } else {
          throw new Error('No JSON found')
        }
      } catch {
        // Fallback: use raw response as content
        generated = {
          content: `<p>${cleaned}</p>`,
          excerpt: `Learn about ${title} on ArguFight`,
          metaDescription: `Discover insights about ${title} on ArguFight - the AI-judged debate platform`,
          keywords: title.toLowerCase().replace(/\s+/g, ', '),
          suggestedTags: [],
        }
      }

      return NextResponse.json({
        success: true,
        generated: {
          content: generated.content || '',
          excerpt: generated.excerpt || '',
          metaDescription: generated.metaDescription || '',
          keywords: generated.keywords || '',
          suggestedTags: Array.isArray(generated.suggestedTags) ? generated.suggestedTags : [],
        },
      })
    } catch (error: any) {
      const responseTime = Date.now() - startTime
      await logApiUsage({
        provider: 'deepseek',
        endpoint: 'chat/completions',
        model: 'deepseek-chat',
        userId,
        success: false,
        errorMessage: error.message || 'Unknown error',
        responseTime,
      })
      throw error
    }
  } catch (error: any) {
    console.error('Failed to generate blog content:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to generate blog content' },
      { status: 500 }
    )
  }
}
