import { NextRequest, NextResponse } from 'next/server'
import { verifySession } from '@/lib/auth/session'
import { prisma } from '@/lib/db/prisma'
import { createDeepSeekClient } from '@/lib/ai/deepseek'
import { getUserIdFromSession } from '@/lib/auth/session-utils'

export const dynamic = 'force-dynamic'

// POST /api/admin/settings/test-deepseek - Test DeepSeek API connection
export async function POST(request: NextRequest) {
  try {
    const session = await verifySession()

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify admin
    const userId = getUserIdFromSession(session)
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { isAdmin: true },
    })

    if (!user?.isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Test the API key
    const client = await createDeepSeekClient()

    const testPrompt = 'Say "API connection successful" if you can read this.'

    const completion = await client.chat.completions.create({
      model: 'deepseek-chat',
      messages: [
        {
          role: 'user',
          content: testPrompt,
        },
      ],
      max_tokens: 50,
    })

    const response = completion.choices[0].message.content

    return NextResponse.json({
      success: true,
      message: 'API connection successful',
      response,
      model: completion.model,
      tokensUsed: completion.usage?.total_tokens || 0,
    })
  } catch (error: any) {
    console.error('DeepSeek API test failed:', error)
    
    let errorMessage = 'Failed to connect to DeepSeek API'
    if (error.status === 401) {
      errorMessage = 'Invalid API key. Please check your DeepSeek API key.'
    } else if (error.message?.includes('not configured')) {
      errorMessage = 'DeepSeek API key not configured. Please add it in settings.'
    } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      errorMessage = 'Network error. Please check your internet connection.'
    }

    return NextResponse.json(
      { 
        success: false,
        error: errorMessage,
        details: error.message 
      },
      { status: 500 }
    )
  }
}

