import { NextRequest, NextResponse } from 'next/server'
import { verifyCronAuth } from '@/lib/auth/cron-auth'
import { prisma } from '@/lib/db/prisma'
import { getDeepSeekKey } from '@/lib/ai/deepseek'
import { publishPost } from '@/lib/social/publisher'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
// Schedule: 0 9 * * * (daily 9 AM UTC)

const PLATFORM_PROMPTS: Record<string, (topic: string) => string> = {
  TWITTER: (topic) =>
    `Create a concise Twitter/X post for Argu Fight (a debate platform). Under 280 chars, 2-3 hashtags. Topic: ${topic}`,
  LINKEDIN: (topic) =>
    `Create a professional LinkedIn post for Argu Fight. Under 3000 chars, 3-5 hashtags, professional tone. Topic: ${topic}`,
  FACEBOOK: (topic) =>
    `Create an engaging Facebook post for Argu Fight. Under 2000 chars, community-focused. Topic: ${topic}`,
  INSTAGRAM: (topic) =>
    `Create an Instagram caption for Argu Fight. Under 2200 chars, 8-10 hashtags, use emojis. Topic: ${topic}`,
}

function cleanContent(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^[-*]\s+/gm, '')
    .replace(/`(.+?)`/g, '$1')
    .replace(/\[(.+?)\]\(.+?\)/g, '$1')
    .trim()
}

function safeParseJson<T>(val: string | undefined, fallback: T): T {
  if (!val) return fallback
  try { return JSON.parse(val) as T } catch { return fallback }
}

export async function GET(request: NextRequest) {
  const authError = verifyCronAuth(request)
  if (authError) return authError

  let generated = 0
  let published = 0
  let failed = 0

  try {
    // 1. Read automation config
    const keys = [
      'SOCIAL_AUTO_ENABLED',
      'SOCIAL_AUTO_PLATFORMS',
      'SOCIAL_AUTO_HOUR_UTC',
      'SOCIAL_AUTO_TOPICS',
      'SOCIAL_AUTO_INCLUDE_DEBATES',
      'SOCIAL_AUTO_REQUIRE_APPROVAL',
    ]
    const rows = await prisma.adminSetting.findMany({ where: { key: { in: keys } } })
    const cfg: Record<string, string> = {}
    for (const r of rows) cfg[r.key] = r.value

    if (cfg['SOCIAL_AUTO_ENABLED'] === 'false') {
      return NextResponse.json({ message: 'Automation disabled', generated: 0, published: 0, failed: 0 })
    }

    const platforms: string[] = safeParseJson(cfg['SOCIAL_AUTO_PLATFORMS'], ['TWITTER', 'LINKEDIN', 'FACEBOOK'])
    const topics: string[] = safeParseJson(cfg['SOCIAL_AUTO_TOPICS'], ['ArguFight debate platform highlights'])
    const includeDebates = cfg['SOCIAL_AUTO_INCLUDE_DEBATES'] !== 'false'
    const requireApproval = cfg['SOCIAL_AUTO_REQUIRE_APPROVAL'] !== 'false'

    // 2. Determine today's topic
    let topic = topics[new Date().getDay() % Math.max(topics.length, 1)] ?? topics[0]

    if (includeDebates) {
      const recent = await prisma.debate.findFirst({
        where: { status: 'COMPLETED' },
        orderBy: { updatedAt: 'desc' },
        select: { topic: true },
      })
      if (recent?.topic) topic = recent.topic
    }

    // 3. Generate drafts
    let deepseekApiKey: string | null = null
    try { deepseekApiKey = await getDeepSeekKey() } catch { /* skip generation if no key */ }

    if (deepseekApiKey && platforms.length > 0) {
      const status = requireApproval ? 'DRAFT' : 'SCHEDULED'
      const scheduledAt = requireApproval ? null : new Date(Date.now() + 60 * 60 * 1000) // +1h

      const genResults = await Promise.allSettled(
        platforms.map(async (platform) => {
          const promptFn = PLATFORM_PROMPTS[platform]
          if (!promptFn) return null

          const maxTokens = platform === 'TWITTER' ? 150 : 600
          const resp = await fetch('https://api.deepseek.com/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${deepseekApiKey}` },
            body: JSON.stringify({
              model: 'deepseek-chat',
              messages: [
                { role: 'system', content: 'You are a social media content creator for Argu Fight, a debate platform.' },
                { role: 'user', content: promptFn(topic) },
              ],
              temperature: 0.8,
              max_tokens: maxTokens,
            }),
          })
          if (!resp.ok) throw new Error(`DeepSeek ${resp.status}`)
          const data = await resp.json()
          const content: string = cleanContent(data.choices?.[0]?.message?.content ?? '')
          const hashtags = content.match(/#\w+/g)?.join(' ') ?? ''

          await prisma.socialMediaPost.create({
            data: { platform, content, hashtags: hashtags || null, status, scheduledAt },
          })
          return platform
        }),
      )

      for (const r of genResults) {
        if (r.status === 'fulfilled' && r.value) generated++
      }
    }

    // 4. Publish scheduled posts that are due
    const now = new Date()
    const scheduledPosts = await prisma.socialMediaPost.findMany({
      where: { status: 'SCHEDULED', scheduledAt: { lte: now } },
    })

    for (const post of scheduledPosts) {
      const result = await publishPost(post.platform, post.content, post.hashtags)
      if (result.success) {
        await prisma.socialMediaPost.update({
          where: { id: post.id },
          data: { status: 'PUBLISHED', publishedAt: now },
        })
        published++
      } else {
        await prisma.socialMediaPost.update({ where: { id: post.id }, data: { status: 'FAILED' } })
        failed++
      }
    }

    return NextResponse.json({ generated, published, failed })
  } catch (error: any) {
    console.error('social-posts cron error:', error)
    return NextResponse.json({ error: error.message ?? 'Cron failed', generated, published, failed }, { status: 500 })
  }
}
