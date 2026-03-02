import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/auth/session-utils'
import { prisma } from '@/lib/db/prisma'
import { getDeepSeekKey } from '@/lib/ai/deepseek'

export const dynamic = 'force-dynamic'

function cleanContent(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1')   // **bold** → bold
    .replace(/\*(.+?)\*/g, '$1')        // *italic* → italic
    .replace(/^#{1,6}\s+/gm, '')        // ## headings
    .replace(/^[-*]\s+/gm, '')          // bullet list markers
    .replace(/`(.+?)`/g, '$1')          // `code` → code
    .replace(/\[(.+?)\]\(.+?\)/g, '$1') // [link](url) → link text
    .trim()
}

const PLATFORM_PROMPTS: Record<string, (topic: string, tone: string) => string> = {
  TWITTER: (topic, tone) =>
    `Create a concise Twitter/X post for Argu Fight (a debate platform). Tone: ${tone}. Requirements:
- Under 280 characters total (including hashtags)
- 2-3 hashtags like #ArguFight #Debate
- Direct, punchy, shareable
- Topic: ${topic}`,

  LINKEDIN: (topic, tone) =>
    `Create a professional LinkedIn post for Argu Fight (a structured debate platform). Tone: ${tone}. Requirements:
- Under 3,000 characters
- 3-5 hashtags like #ArguFight #Debate #CriticalThinking
- Professional, thought-provoking, encourages comments
- Topic: ${topic}`,

  FACEBOOK: (topic, tone) =>
    `Create an engaging Facebook post for Argu Fight. Tone: ${tone}. Requirements:
- Conversational and community-focused
- Under 2,000 characters
- Include 3-5 relevant hashtags
- Encourage shares and comments
- Topic: ${topic}`,

  INSTAGRAM: (topic, tone) =>
    `Create an Instagram caption for Argu Fight. Tone: ${tone}. Requirements:
- Under 2,200 characters
- 8-10 hashtags including #ArguFight #Debate #Discussion
- Engaging, visual-friendly language
- Include emojis where appropriate
- Topic: ${topic}`,

  TIKTOK: (topic, tone) =>
    `Create a TikTok video caption for Argu Fight. Tone: ${tone}. Requirements:
- Very short and punchy (under 300 characters)
- 3-5 trending hashtags
- High energy, conversational
- Topic: ${topic}`,
}

const CHAR_LIMITS: Record<string, number> = {
  TWITTER: 280,
  LINKEDIN: 3000,
  FACEBOOK: 2000,
  INSTAGRAM: 2200,
  TIKTOK: 300,
}

async function generateForPlatform(
  platform: string,
  topic: string,
  tone: string,
  deepseekApiKey: string,
): Promise<{ content: string; hashtags: string; imagePrompt: string }> {
  const promptFn = PLATFORM_PROMPTS[platform]
  if (!promptFn) throw new Error(`No prompt for platform ${platform}`)

  const maxTokens = platform === 'TWITTER' || platform === 'TIKTOK' ? 150 : 600

  const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${deepseekApiKey}`,
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        {
          role: 'system',
          content:
            'You are a social media content creator for Argu Fight, a debate platform with AI-powered judging. Write platform-native posts that feel authentic and drive engagement.',
        },
        { role: 'user', content: promptFn(topic, tone) },
      ],
      temperature: 0.8,
      max_tokens: maxTokens,
    }),
  })

  if (!response.ok) throw new Error(`DeepSeek error: ${response.status}`)
  const data = await response.json()
  const content: string = cleanContent(data.choices?.[0]?.message?.content ?? '')

  const hashtagRegex = /#\w+/g
  const hashtags = content.match(hashtagRegex)?.join(' ') ?? ''
  const imagePrompt = `Modern, dynamic visual for Argu Fight social media post about "${topic}". Clean design, debate theme, community energy. Suitable for ${platform}.`

  return { content, hashtags, imagePrompt }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await verifyAdmin()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const {
      topic,
      tone = 'Engaging',
      platforms,
      saveAsDraft = true,
      debateId,
    }: {
      topic: string
      tone?: string
      platforms: string[]
      saveAsDraft?: boolean
      debateId?: string
    } = body

    if (!topic?.trim()) return NextResponse.json({ error: 'topic is required' }, { status: 400 })
    if (!Array.isArray(platforms) || platforms.length === 0) {
      return NextResponse.json({ error: 'platforms array is required' }, { status: 400 })
    }

    let deepseekApiKey: string
    try {
      deepseekApiKey = await getDeepSeekKey()
    } catch (e: any) {
      return NextResponse.json({ error: e.message ?? 'DeepSeek API key not configured' }, { status: 500 })
    }

    const results = await Promise.allSettled(
      platforms.map((p) => generateForPlatform(p, topic.trim(), tone, deepseekApiKey)),
    )

    const posts: any[] = []
    const errors: any[] = []

    for (let i = 0; i < platforms.length; i++) {
      const platform = platforms[i]
      const result = results[i]
      if (result.status === 'fulfilled') {
        const { content, hashtags, imagePrompt } = result.value
        let savedId: string | undefined

        if (saveAsDraft) {
          const saved = await prisma.socialMediaPost.create({
            data: {
              platform,
              content,
              hashtags: hashtags || null,
              imagePrompt: imagePrompt || null,
              status: 'DRAFT',
              debateId: debateId || null,
            },
          })
          savedId = saved.id
        }

        posts.push({
          platform,
          content,
          hashtags,
          imagePrompt,
          savedId,
          charLimit: CHAR_LIMITS[platform] ?? 0,
        })
      } else {
        errors.push({ platform, error: (result.reason as Error).message })
      }
    }

    return NextResponse.json({ posts, errors })
  } catch (error: any) {
    console.error('bulk-generate error:', error)
    return NextResponse.json({ error: error.message ?? 'Failed to generate posts' }, { status: 500 })
  }
}
