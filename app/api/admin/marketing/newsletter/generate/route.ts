import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/auth/session-utils'
import { prisma } from '@/lib/db/prisma'
import { generateWithDeepSeek } from '@/lib/ai/deepseek'

export const dynamic = 'force-dynamic'

// POST /api/admin/marketing/newsletter/generate - Generate email newsletter
export async function POST(request: NextRequest) {
  try {
    const userId = await verifyAdmin()
    if (!userId) {
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

    // Get recent platform activity for context
    const recentDebates = await prisma.debate.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: {
        topic: true,
        category: true,
      },
    })

    const debateTopics = recentDebates.map((d) => d.topic).join(', ')

    // Generate newsletter using AI
    const prompt = `Write an engaging email newsletter about "${topic}" for an AI-judged debate platform called "Argu Fight".

Context:
- Recent debate topics: ${debateTopics || 'Various topics'}
- Platform features: AI judges, ELO rating, tournaments, public debates

Requirements:
- Subject: Create a compelling email subject line
- Content: Write newsletter content (400-600 words) with:
  * Engaging introduction
  * Key highlights or updates
  * Call-to-action
  * Professional but friendly tone
- HTML: Format as HTML with proper structure

Format the response as JSON:
{
  "subject": "Email subject line",
  "content": "Plain text content",
  "htmlContent": "<html>Formatted HTML content</html>"
}`

    const response = await generateWithDeepSeek(prompt, {
      temperature: 0.7,
      maxTokens: 2000,
    })

    let newsletterData
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        newsletterData = JSON.parse(jsonMatch[0])
      } else {
        // Fallback
        newsletterData = {
          subject: `Argu Fight Update: ${topic}`,
          content: response,
          htmlContent: `<div>${response.replace(/\n/g, '<br>')}</div>`,
        }
      }
    } catch (error) {
      newsletterData = {
        subject: `Argu Fight Update: ${topic}`,
        content: response,
        htmlContent: `<div>${response.replace(/\n/g, '<br>')}</div>`,
      }
    }

    // Create newsletter
    const newsletter = await prisma.emailNewsletter.create({
      data: {
        subject: newsletterData.subject,
        content: newsletterData.content,
        htmlContent: newsletterData.htmlContent,
        status: 'DRAFT',
        strategyId: strategyId || null,
        calendarItemId: calendarItemId || null,
      },
    })

    return NextResponse.json({
      success: true,
      newsletter,
    })
  } catch (error: any) {
    console.error('Failed to generate newsletter:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to generate newsletter' },
      { status: 500 }
    )
  }
}

