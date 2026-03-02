import { createDeepSeekClient, getDeepSeekKey } from './deepseek'
import { logApiUsage } from './api-tracking'

export interface ModerationResult {
  action: 'APPROVE' | 'REMOVE' | 'ESCALATE'
  confidence: number // 0-100
  reasoning: string
  severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
}

export interface ReportContext {
  reportReason: string
  reportDescription?: string
  content?: string
  authorUsername?: string
  debateTopic?: string
}

export interface StatementContext {
  content: string
  authorUsername: string
  debateTopic: string
  round: number
}

/**
 * AI-powered moderation for user reports
 * Returns action recommendation with confidence score
 */
export async function moderateReport(
  context: ReportContext,
  reportId: string
): Promise<ModerationResult> {
  const client = await createDeepSeekClient()
  
  const prompt = `You are an AI content moderator for a debate platform. Analyze this user report and determine the appropriate action.

REPORT DETAILS:
- Reason: ${context.reportReason}
${context.reportDescription ? `- Description: ${context.reportDescription}` : ''}
${context.content ? `- Reported Content: ${context.content}` : ''}
${context.authorUsername ? `- Author: ${context.authorUsername}` : ''}
${context.debateTopic ? `- Debate Topic: ${context.debateTopic}` : ''}

MODERATION GUIDELINES:
1. **APPROVE** (dismiss report) if:
   - Content is within platform guidelines
   - Report appears to be false/spam/abuse of reporting system
   - Content is controversial but not violating rules
   - Confidence: 80%+

2. **REMOVE** (take action) if:
   - Clear violation: harassment, hate speech, threats, spam
   - Explicit content, illegal activity
   - Clear terms of service violation
   - Confidence: 80%+

3. **ESCALATE** (human review needed) if:
   - Ambiguous case requiring context
   - Edge case not clearly covered by guidelines
   - Confidence: < 80% for either action
   - Potential false positive/negative

SEVERITY LEVELS:
- LOW: Minor violations, first-time offenses
- MEDIUM: Moderate violations, repeated patterns
- HIGH: Serious violations, potential harm
- CRITICAL: Immediate threat, illegal content

Respond in JSON format:
{
  "action": "APPROVE" | "REMOVE" | "ESCALATE",
  "confidence": 0-100,
  "reasoning": "Brief explanation",
  "severity": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" (only if REMOVE)
}`

  const startTime = Date.now()
  let success = false
  let errorMessage: string | undefined
  let promptTokens = 0
  let completionTokens = 0
  let totalTokens = 0
  let cost = 0

  try {
    const completion = await client.chat.completions.create({
      model: 'deepseek-chat',
      messages: [
        {
          role: 'system',
          content: 'You are a fair and consistent content moderator. Analyze reports objectively and follow platform guidelines strictly.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.3, // Lower temperature for more consistent moderation
      max_tokens: 500,
    })

    const responseText = completion.choices[0].message.content || '{}'
    
    promptTokens = completion.usage?.prompt_tokens || 0
    completionTokens = completion.usage?.completion_tokens || 0
    totalTokens = completion.usage?.total_tokens || 0

    // DeepSeek pricing: $0.14/1M input tokens, $0.28/1M output tokens
    const inputCostPerMillion = 0.14
    const outputCostPerMillion = 0.28
    cost = (promptTokens / 1_000_000) * inputCostPerMillion + (completionTokens / 1_000_000) * outputCostPerMillion

    const cleanedResponse = responseText
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim()

    try {
      const result = JSON.parse(cleanedResponse) as ModerationResult
      
      // Validate result
      if (!['APPROVE', 'REMOVE', 'ESCALATE'].includes(result.action)) {
        throw new Error('Invalid action')
      }
      if (result.confidence < 0 || result.confidence > 100) {
        throw new Error('Invalid confidence')
      }
      
      result.confidence = Math.max(0, Math.min(100, result.confidence))
      success = true
      return result
    } catch (error: any) {
      errorMessage = `Failed to parse moderation response: ${error.message}`
      console.error(errorMessage, 'Response:', cleanedResponse)
      // Return safe default: escalate for human review
      return {
        action: 'ESCALATE',
        confidence: 0,
        reasoning: 'AI moderation failed to parse response. Escalating for human review.',
      }
    }
  } catch (error: any) {
    errorMessage = `DeepSeek API call failed: ${error.message}`
    console.error(errorMessage, error)
    // Return safe default: escalate for human review
    return {
      action: 'ESCALATE',
      confidence: 0,
      reasoning: 'AI moderation service unavailable. Escalating for human review.',
    }
  } finally {
    const responseTimeMs = Date.now() - startTime
    await logApiUsage({
      provider: 'DeepSeek',
      endpoint: 'chat.completions',
      model: 'deepseek-chat',
      promptTokens,
      completionTokens,
      totalTokens,
      success,
      errorMessage,
      responseTime: responseTimeMs,
      debateId: undefined, // Reports might not have debateId
    })
  }
}

/**
 * AI-powered moderation for flagged statements
 */
export async function moderateStatement(
  context: StatementContext,
  statementId: string
): Promise<ModerationResult> {
  const client = await createDeepSeekClient()
  
  const prompt = `You are an AI content moderator for a debate platform. Analyze this flagged statement and determine if it should be removed.

STATEMENT DETAILS:
- Content: ${context.content}
- Author: ${context.authorUsername}
- Debate Topic: ${context.debateTopic}
- Round: ${context.round}

MODERATION GUIDELINES:
1. **APPROVE** (keep statement) if:
   - Content is within platform guidelines
   - Strong but respectful argumentation
   - Controversial but not violating rules
   - Confidence: 80%+

2. **REMOVE** (delete statement) if:
   - Clear violation: harassment, hate speech, threats, spam
   - Explicit content, illegal activity
   - Clear terms of service violation
   - Confidence: 80%+

3. **ESCALATE** (human review needed) if:
   - Ambiguous case requiring context
   - Edge case not clearly covered by guidelines
   - Confidence: < 80% for either action

SEVERITY LEVELS:
- LOW: Minor violations, first-time offenses
- MEDIUM: Moderate violations, repeated patterns
- HIGH: Serious violations, potential harm
- CRITICAL: Immediate threat, illegal content

Respond in JSON format:
{
  "action": "APPROVE" | "REMOVE" | "ESCALATE",
  "confidence": 0-100,
  "reasoning": "Brief explanation",
  "severity": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" (only if REMOVE)
}`

  const startTime = Date.now()
  let success = false
  let errorMessage: string | undefined
  let promptTokens = 0
  let completionTokens = 0
  let totalTokens = 0
  let cost = 0

  try {
    const completion = await client.chat.completions.create({
      model: 'deepseek-chat',
      messages: [
        {
          role: 'system',
          content: 'You are a fair and consistent content moderator. Analyze statements objectively and follow platform guidelines strictly.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.3,
      max_tokens: 500,
    })

    const responseText = completion.choices[0].message.content || '{}'
    
    promptTokens = completion.usage?.prompt_tokens || 0
    completionTokens = completion.usage?.completion_tokens || 0
    totalTokens = completion.usage?.total_tokens || 0

    const inputCostPerMillion = 0.14
    const outputCostPerMillion = 0.28
    cost = (promptTokens / 1_000_000) * inputCostPerMillion + (completionTokens / 1_000_000) * outputCostPerMillion

    const cleanedResponse = responseText
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim()

    try {
      const result = JSON.parse(cleanedResponse) as ModerationResult
      
      if (!['APPROVE', 'REMOVE', 'ESCALATE'].includes(result.action)) {
        throw new Error('Invalid action')
      }
      if (result.confidence < 0 || result.confidence > 100) {
        throw new Error('Invalid confidence')
      }
      
      result.confidence = Math.max(0, Math.min(100, result.confidence))
      success = true
      return result
    } catch (error: any) {
      errorMessage = `Failed to parse moderation response: ${error.message}`
      console.error(errorMessage, 'Response:', cleanedResponse)
      return {
        action: 'ESCALATE',
        confidence: 0,
        reasoning: 'AI moderation failed to parse response. Escalating for human review.',
      }
    }
  } catch (error: any) {
    errorMessage = `DeepSeek API call failed: ${error.message}`
    console.error(errorMessage, error)
    return {
      action: 'ESCALATE',
      confidence: 0,
      reasoning: 'AI moderation service unavailable. Escalating for human review.',
    }
  } finally {
    const responseTimeMs = Date.now() - startTime
    await logApiUsage({
      provider: 'DeepSeek',
      endpoint: 'chat.completions',
      model: 'deepseek-chat',
      promptTokens,
      completionTokens,
      totalTokens,
      success,
      errorMessage,
      responseTime: responseTimeMs,
      debateId: undefined,
    })
  }
}

