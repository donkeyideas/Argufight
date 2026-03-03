import { prisma } from '@/lib/db/prisma'
import { TwitterApi } from 'twitter-api-v2'

// ─── Credential helpers ───────────────────────────────────────────────────────

const PLATFORM_KEYS: Record<string, string[]> = {
  TWITTER: [
    'SOCIAL_TWITTER_API_KEY',
    'SOCIAL_TWITTER_API_SECRET',
    'SOCIAL_TWITTER_ACCESS_TOKEN',
    'SOCIAL_TWITTER_ACCESS_SECRET',
  ],
  LINKEDIN: ['SOCIAL_LINKEDIN_ACCESS_TOKEN', 'SOCIAL_LINKEDIN_PERSON_URN'],
  FACEBOOK: ['SOCIAL_FACEBOOK_PAGE_ACCESS_TOKEN', 'SOCIAL_FACEBOOK_PAGE_ID'],
  INSTAGRAM: ['SOCIAL_INSTAGRAM_ACCESS_TOKEN', 'SOCIAL_INSTAGRAM_ACCOUNT_ID'],
}

export async function getCredentials(platform: string): Promise<Record<string, string>> {
  const keys = PLATFORM_KEYS[platform] ?? []
  if (keys.length === 0) return {}
  const rows = await prisma.adminSetting.findMany({ where: { key: { in: keys } } })
  const map: Record<string, string> = {}
  for (const row of rows) map[row.key] = row.value
  return map
}

// ─── Publisher ────────────────────────────────────────────────────────────────

export interface PublishResult {
  success: boolean
  postId?: string
  url?: string
  error?: string
}

export async function publishPost(
  platform: string,
  content: string,
  hashtags?: string | null,
): Promise<PublishResult> {
  const text = buildText(content, hashtags)

  switch (platform) {
    case 'TWITTER':  return publishTwitter(text)
    case 'LINKEDIN': return publishLinkedIn(text)
    case 'FACEBOOK': return publishFacebook(text)
    case 'INSTAGRAM':
      return { success: false, error: 'Instagram requires an image — use the imagePrompt to generate one first' }
    case 'TIKTOK':
      return { success: false, error: 'TikTok publishing coming soon' }
    default:
      return { success: false, error: `Unknown platform: ${platform}` }
  }
}

// ─── Connection tester ────────────────────────────────────────────────────────

export async function testConnection(platform: string): Promise<{ success: boolean; error?: string }> {
  const creds = await getCredentials(platform)

  switch (platform) {
    case 'TWITTER': {
      const { SOCIAL_TWITTER_API_KEY, SOCIAL_TWITTER_API_SECRET, SOCIAL_TWITTER_ACCESS_TOKEN, SOCIAL_TWITTER_ACCESS_SECRET } = creds
      if (!SOCIAL_TWITTER_API_KEY || !SOCIAL_TWITTER_API_SECRET || !SOCIAL_TWITTER_ACCESS_TOKEN || !SOCIAL_TWITTER_ACCESS_SECRET) {
        return { success: false, error: 'Missing Twitter credentials' }
      }
      try {
        const client = new TwitterApi({
          appKey: SOCIAL_TWITTER_API_KEY,
          appSecret: SOCIAL_TWITTER_API_SECRET,
          accessToken: SOCIAL_TWITTER_ACCESS_TOKEN,
          accessSecret: SOCIAL_TWITTER_ACCESS_SECRET,
        })
        await client.v2.me()
        return { success: true }
      } catch (e: any) {
        return { success: false, error: e.message ?? 'Twitter auth failed' }
      }
    }

    case 'LINKEDIN': {
      const { SOCIAL_LINKEDIN_ACCESS_TOKEN } = creds
      if (!SOCIAL_LINKEDIN_ACCESS_TOKEN) return { success: false, error: 'Missing LinkedIn access token' }
      try {
        // Use userinfo endpoint (works with OpenID Connect scopes)
        const res = await fetch('https://api.linkedin.com/v2/userinfo', {
          headers: { Authorization: `Bearer ${SOCIAL_LINKEDIN_ACCESS_TOKEN}` },
        })
        if (!res.ok) return { success: false, error: `LinkedIn returned ${res.status}` }
        return { success: true }
      } catch (e: any) {
        return { success: false, error: e.message ?? 'LinkedIn auth failed' }
      }
    }

    case 'FACEBOOK': {
      const { SOCIAL_FACEBOOK_PAGE_ACCESS_TOKEN, SOCIAL_FACEBOOK_PAGE_ID } = creds
      if (!SOCIAL_FACEBOOK_PAGE_ACCESS_TOKEN || !SOCIAL_FACEBOOK_PAGE_ID) {
        return { success: false, error: 'Missing Facebook credentials' }
      }
      try {
        const res = await fetch(
          `https://graph.facebook.com/v19.0/${SOCIAL_FACEBOOK_PAGE_ID}?access_token=${SOCIAL_FACEBOOK_PAGE_ACCESS_TOKEN}`,
        )
        if (!res.ok) return { success: false, error: `Facebook returned ${res.status}` }
        return { success: true }
      } catch (e: any) {
        return { success: false, error: e.message ?? 'Facebook auth failed' }
      }
    }

    case 'INSTAGRAM':
      return { success: false, error: 'Instagram: text-only posts are not supported. Image required.' }

    case 'TIKTOK':
      return { success: false, error: 'TikTok integration coming soon' }

    default:
      return { success: false, error: `Unknown platform: ${platform}` }
  }
}

// ─── Private helpers ──────────────────────────────────────────────────────────

function buildText(content: string, hashtags?: string | null): string {
  if (!hashtags) return content
  const tags = hashtags.trim()
  if (!tags) return content
  // Avoid duplicating hashtags already in content
  return content.includes('#') ? content : `${content}\n\n${tags}`
}

async function publishTwitter(text: string): Promise<PublishResult> {
  const creds = await getCredentials('TWITTER')
  const { SOCIAL_TWITTER_API_KEY, SOCIAL_TWITTER_API_SECRET, SOCIAL_TWITTER_ACCESS_TOKEN, SOCIAL_TWITTER_ACCESS_SECRET } = creds
  if (!SOCIAL_TWITTER_API_KEY || !SOCIAL_TWITTER_API_SECRET || !SOCIAL_TWITTER_ACCESS_TOKEN || !SOCIAL_TWITTER_ACCESS_SECRET) {
    return { success: false, error: 'Twitter credentials not configured' }
  }
  try {
    const client = new TwitterApi({
      appKey: SOCIAL_TWITTER_API_KEY,
      appSecret: SOCIAL_TWITTER_API_SECRET,
      accessToken: SOCIAL_TWITTER_ACCESS_TOKEN,
      accessSecret: SOCIAL_TWITTER_ACCESS_SECRET,
    })
    const trimmed = text.slice(0, 280)
    const result = await client.v2.tweet(trimmed)
    const tweetId = result.data.id
    return {
      success: true,
      postId: tweetId,
      url: `https://twitter.com/i/web/status/${tweetId}`,
    }
  } catch (e: any) {
    return { success: false, error: e.message ?? 'Twitter publish failed' }
  }
}

async function publishLinkedIn(text: string): Promise<PublishResult> {
  const creds = await getCredentials('LINKEDIN')
  const { SOCIAL_LINKEDIN_ACCESS_TOKEN, SOCIAL_LINKEDIN_PERSON_URN } = creds
  if (!SOCIAL_LINKEDIN_ACCESS_TOKEN || !SOCIAL_LINKEDIN_PERSON_URN) {
    return { success: false, error: 'LinkedIn credentials not configured' }
  }
  try {
    // Use the current Posts API (w_member_social scope)
    const body = {
      author: SOCIAL_LINKEDIN_PERSON_URN,
      lifecycleState: 'PUBLISHED',
      visibility: 'PUBLIC',
      distribution: {
        feedDistribution: 'MAIN_FEED',
        targetEntities: [],
        thirdPartyDistributionChannels: [],
      },
      commentary: text,
    }
    const res = await fetch('https://api.linkedin.com/rest/posts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SOCIAL_LINKEDIN_ACCESS_TOKEN}`,
        'LinkedIn-Version': '202601',
        'X-Restli-Protocol-Version': '2.0.0',
      },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const err = await res.text()
      return { success: false, error: `LinkedIn error ${res.status}: ${err}` }
    }
    // Posts API returns the post URN in the x-restli-id header
    const postId = res.headers.get('x-restli-id') ?? ''
    return { success: true, postId, url: `https://www.linkedin.com/feed/update/${postId}` }
  } catch (e: any) {
    return { success: false, error: e.message ?? 'LinkedIn publish failed' }
  }
}

async function publishFacebook(text: string): Promise<PublishResult> {
  const creds = await getCredentials('FACEBOOK')
  const { SOCIAL_FACEBOOK_PAGE_ACCESS_TOKEN, SOCIAL_FACEBOOK_PAGE_ID } = creds
  if (!SOCIAL_FACEBOOK_PAGE_ACCESS_TOKEN || !SOCIAL_FACEBOOK_PAGE_ID) {
    return { success: false, error: 'Facebook credentials not configured' }
  }
  try {
    const res = await fetch(`https://graph.facebook.com/v19.0/${SOCIAL_FACEBOOK_PAGE_ID}/feed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text, access_token: SOCIAL_FACEBOOK_PAGE_ACCESS_TOKEN }),
    })
    if (!res.ok) {
      const err = await res.text()
      return { success: false, error: `Facebook error ${res.status}: ${err}` }
    }
    const data = await res.json()
    return { success: true, postId: data.id }
  } catch (e: any) {
    return { success: false, error: e.message ?? 'Facebook publish failed' }
  }
}
