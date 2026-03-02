import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/auth/session-utils'
import { prisma } from '@/lib/db/prisma'
import { getDeepSeekKey } from '@/lib/ai/deepseek'

export const dynamic = 'force-dynamic'

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

// POST /api/admin/social-posts/generate - Generate AI-powered social media post
export async function POST(request: NextRequest) {
  try {
    const userId = await verifyAdmin()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { topic, platform } = body

    if (!platform) {
      return NextResponse.json(
        { error: 'platform is required' },
        { status: 400 }
      )
    }

    if (!['INSTAGRAM', 'LINKEDIN', 'TWITTER', 'FACEBOOK', 'TIKTOK'].includes(platform)) {
      return NextResponse.json(
        { error: 'platform must be INSTAGRAM, LINKEDIN, TWITTER, FACEBOOK, or TIKTOK' },
        { status: 400 }
      )
    }

    // Use provided topic or default to general platform content
    const postTopic = topic?.trim() || 'Argu Fight platform and community'

    // Get DeepSeek API key from database (or env fallback)
    let deepseekApiKey: string
    try {
      deepseekApiKey = await getDeepSeekKey()
    } catch (error: any) {
      return NextResponse.json(
        { error: error.message || 'DeepSeek API key not configured. Please add it in Admin Settings.' },
        { status: 500 }
      )
    }

    // Build platform-specific prompt for company/platform posts
    const platformPrompts: Record<string, string> = {
      INSTAGRAM: `Create an engaging Instagram post for Argu Fight, a debate platform where users engage in structured debates. Requirements:
- Visual and engaging tone
- Include relevant hashtags (5-10) like #ArguFight #Debate #Discussion
- Keep it under 2,200 characters
- Make it shareable and attention-grabbing
- Include emojis where appropriate
- Focus on the platform's value: structured debates, AI judges, community engagement
- Topic/Theme: ${postTopic}
- Include a call-to-action to join the platform`,

      LINKEDIN: `Create a professional LinkedIn post for Argu Fight, a debate platform where professionals engage in structured, thought-provoking debates. Requirements:
- Professional and thought-provoking tone
- Include relevant hashtags (3-5) like #ArguFight #Debate #ProfessionalDiscussion
- Keep it under 3,000 characters
- Focus on insights, professional value, and discussion quality
- Encourage engagement and comments
- Professional language suitable for LinkedIn
- Topic/Theme: ${postTopic}
- Highlight the platform's features: structured format, AI-powered judging, community`,

      TWITTER: `Create a concise Twitter/X post for Argu Fight, a debate platform. Requirements:
- Concise and engaging (under 280 characters)
- Include 2-3 relevant hashtags like #ArguFight #Debate
- Make it tweetable and shareable
- Use trending topic language if applicable
- Focus on the key value proposition
- Topic/Theme: ${postTopic}
- Include a brief call-to-action`,

      FACEBOOK: `Create an engaging Facebook post for Argu Fight, a debate platform. Requirements:
- Conversational, community-focused tone
- Under 2,000 characters
- Include 3-5 relevant hashtags like #ArguFight #Debate
- Encourage shares and comments
- Topic/Theme: ${postTopic}
- Include a call-to-action to join the platform`,

      TIKTOK: `Create a TikTok caption for Argu Fight, a debate platform. Requirements:
- Short and punchy (under 300 characters)
- 3-5 trending hashtags like #ArguFight #Debate #FYP
- High energy, casual, Gen-Z friendly tone
- Topic/Theme: ${postTopic}`,
    }

    const systemPrompt = platformPrompts[platform] || platformPrompts.INSTAGRAM

    // Generate post content using DeepSeek
    const deepseekResponse = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${deepseekApiKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          {
            role: 'system',
            content: 'You are a social media content creator specializing in creating engaging, platform-specific posts for Argu Fight, a debate platform where users engage in structured debates with AI-powered judging. Create posts that highlight the platform\'s value, community, and features.',
          },
          {
            role: 'user',
            content: systemPrompt,
          },
        ],
        temperature: 0.8,
        max_tokens: platform === 'TWITTER' || platform === 'TIKTOK' ? 150 : 500,
      }),
    })

    if (!deepseekResponse.ok) {
      const errorData = await deepseekResponse.text()
      console.error('DeepSeek API error:', errorData)
      return NextResponse.json(
        { error: 'Failed to generate post content' },
        { status: 500 }
      )
    }

    const deepseekData = await deepseekResponse.json()
    const generatedContent = cleanContent(deepseekData.choices?.[0]?.message?.content || '')

    // Extract hashtags from content
    const hashtagRegex = /#\w+/g
    const extractedHashtags = generatedContent.match(hashtagRegex)?.join(' ') || ''

    // Generate Sora image prompt for the platform/topic
    const imagePrompt = `A dynamic, engaging visual representation for Argu Fight platform content about "${postTopic}". Modern, clean design suitable for social media, featuring debate elements, community engagement, and platform branding. Professional and eye-catching.`

    // Generate image prompt using AI
    const imagePromptResponse = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${deepseekApiKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          {
            role: 'system',
            content: 'You are an expert at creating detailed image generation prompts for Sora (video generation) and other AI image tools. Create vivid, detailed prompts that capture the essence of social media content for a debate platform.',
          },
          {
            role: 'user',
            content: `Create a detailed Sora image generation prompt for Argu Fight platform social media content about: "${postTopic}". Make it visually engaging, modern, and suitable for social media. Include elements that represent debate, discussion, community, and the platform's brand.`,
          },
        ],
        temperature: 0.7,
        max_tokens: 200,
      }),
    })

    let aiImagePrompt = imagePrompt
    if (imagePromptResponse.ok) {
      const imagePromptData = await imagePromptResponse.json()
      aiImagePrompt = imagePromptData.choices?.[0]?.message?.content || imagePrompt
    }

    return NextResponse.json({
      content: generatedContent,
      imagePrompt: aiImagePrompt.trim(),
      hashtags: extractedHashtags,
      platform,
      topic: postTopic,
    })
  } catch (error: any) {
    console.error('Failed to generate social post:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to generate social post' },
      { status: error.status || 500 }
    )
  }
}

