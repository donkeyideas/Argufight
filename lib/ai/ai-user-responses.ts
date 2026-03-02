import { createDeepSeekClient } from './deepseek'
import { prisma } from '@/lib/db/prisma'
import { logApiUsage } from './api-tracking'

interface PersonalityPrompt {
  system: string
  style: string
}

const PERSONALITY_PROMPTS: Record<string, PersonalityPrompt> = {
  BALANCED: {
    system: 'You are a balanced debater who considers multiple perspectives and presents well-rounded arguments.',
    style: 'Present balanced, thoughtful arguments that consider both sides of the issue. Be fair and measured in your responses.',
  },
  SMART: {
    system: 'You are an intelligent, analytical debater who uses facts, logic, and evidence to support your arguments.',
    style: 'Use facts, statistics, and logical reasoning. Be precise and analytical. Cite evidence when possible.',
  },
  AGGRESSIVE: {
    system: 'You are an aggressive, assertive debater who takes strong positions and challenges opponents directly.',
    style: 'Be assertive and confrontational. Take strong positions. Challenge your opponent directly and forcefully.',
  },
  CALM: {
    system: 'You are a calm, composed debater who maintains composure and presents arguments in a measured way.',
    style: 'Stay calm and composed. Present arguments in a measured, thoughtful manner. Avoid emotional language.',
  },
  WITTY: {
    system: 'You are a witty, clever debater who uses humor, wordplay, and clever arguments to make your points.',
    style: 'Use humor, wordplay, and clever arguments. Be entertaining while making your points. Use wit to undermine opponents.',
  },
  ANALYTICAL: {
    system: 'You are an analytical debater who breaks down complex issues and provides detailed, data-driven analysis.',
    style: 'Provide detailed analysis. Break down complex issues. Use data and evidence. Be thorough and comprehensive.',
  },
}

export async function generateAIResponse(
  debateId: string,
  userId: string,
  round: number
): Promise<string> {
  try {
    // Get debate and AI user info
    const debate = await prisma.debate.findUnique({
      where: { id: debateId },
      include: {
        challenger: {
          select: {
            id: true,
            username: true,
          },
        },
        opponent: {
          select: {
            id: true,
            username: true,
          },
        },
        statements: {
          include: {
            author: {
              select: {
                id: true,
                username: true,
              },
            },
          },
          orderBy: {
            round: 'asc',
          },
        },
      },
    })

    if (!debate) {
      throw new Error('Debate not found')
    }

    const aiUser = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        username: true,
        aiPersonality: true,
      },
    })

    if (!aiUser || !aiUser.aiPersonality) {
      throw new Error('AI user not found or personality not set')
    }

    // Determine AI user's position
    const isChallenger = debate.challengerId === userId
    const aiPosition = isChallenger ? debate.challengerPosition : debate.opponentPosition
    const opponentId = isChallenger ? debate.opponentId : debate.challengerId
    const opponent = isChallenger ? debate.opponent : debate.challenger

    if (!opponent) {
      throw new Error('Opponent not found')
    }

    // Get personality prompt
    const personality = PERSONALITY_PROMPTS[aiUser.aiPersonality] || PERSONALITY_PROMPTS.BALANCED

    // Build debate context
    const previousStatements = debate.statements
      .filter(s => s.round < round)
      .map(s => ({
        round: s.round,
        author: s.author.username,
        position: s.author.id === debate.challengerId ? debate.challengerPosition : debate.opponentPosition,
        content: s.content,
      }))

    // Build prompt
    const systemPrompt = `${personality.system}

You are participating in a debate on the topic: "${debate.topic}"

Your position: ${aiPosition}
Your opponent: ${opponent.username} (arguing ${isChallenger ? debate.opponentPosition : debate.challengerPosition})

${personality.style}

Rules:
- Keep your response between 200-500 words
- Stay on topic and address the debate question
- Respond to your opponent's previous arguments
- Be persuasive and compelling
- Maintain your personality style: ${aiUser.aiPersonality.toLowerCase()}
- Do not use markdown formatting
- Write in first person
- NEVER start with pleasantries like "Thank you for your thoughtful...", "Thank you for the opportunity...", "I appreciate...", or "Great point...". Jump straight into your argument. You are a debater, not a diplomat.
- Sound natural and human. Avoid overly formal or robotic language.`

    const userPrompt = `DEBATE TOPIC: "${debate.topic}"
${debate.description ? `DESCRIPTION: ${debate.description}` : ''}

YOUR POSITION: ${aiPosition}
OPPONENT: ${opponent.username} (${isChallenger ? debate.opponentPosition : debate.challengerPosition})

PREVIOUS ARGUMENTS:
${previousStatements.length > 0
  ? previousStatements.map(s => `Round ${s.round} - ${s.author} (${s.position}): ${s.content}`).join('\n\n')
  : 'This is the first round. Present your opening argument.'}

Now, write your response for Round ${round}. ${previousStatements.length > 0 ? 'Respond to your opponent and strengthen your position.' : 'Present a strong opening argument for your position.'}`

    // Generate response using DeepSeek
    const client = await createDeepSeekClient()
    const startTime = Date.now()

    const completion = await client.chat.completions.create({
      model: 'deepseek-chat',
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content: userPrompt,
        },
      ],
      temperature: 0.8, // Higher temperature for more creative responses
      max_tokens: 1000,
    })

    const responseTime = Date.now() - startTime
    const usage = completion.usage

    // Log API usage
    await logApiUsage({
      provider: 'deepseek',
      endpoint: 'chat/completions',
      model: 'deepseek-chat',
      promptTokens: usage?.prompt_tokens,
      completionTokens: usage?.completion_tokens,
      totalTokens: usage?.total_tokens,
      debateId,
      userId,
      success: true,
      responseTime,
    })

    const response = completion.choices[0].message.content || ''
    
    if (!response.trim()) {
      throw new Error('Empty response from AI')
    }

    return response.trim()
  } catch (error: any) {
    console.error('Failed to generate AI response:', error)
    
    // Log failed API usage
    await logApiUsage({
      provider: 'deepseek',
      endpoint: 'chat/completions',
      model: 'deepseek-chat',
      debateId,
      userId,
      success: false,
      errorMessage: error.message || 'Unknown error',
      responseTime: 0,
    })
    
    throw error
  }
}

