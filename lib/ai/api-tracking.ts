import { prisma } from '@/lib/db/prisma'

// DeepSeek pricing (as of 2024)
// Input: $0.14 per 1M tokens
// Output: $0.28 per 1M tokens
const DEEPSEEK_PRICING = {
  input: 0.14 / 1_000_000,  // per token
  output: 0.28 / 1_000_000,  // per token
}

export interface ApiUsageData {
  provider: string
  endpoint: string
  model?: string
  promptTokens?: number
  completionTokens?: number
  totalTokens?: number
  debateId?: string
  userId?: string
  success?: boolean
  errorMessage?: string
  responseTime?: number
  metadata?: Record<string, any>
}

export async function logApiUsage(data: ApiUsageData) {
  try {
    // Calculate cost based on provider
    let cost = 0
    let costPer1kTokens: number | null = null

    if (data.provider === 'deepseek' && data.promptTokens && data.completionTokens) {
      const inputCost = data.promptTokens * DEEPSEEK_PRICING.input
      const outputCost = data.completionTokens * DEEPSEEK_PRICING.output
      cost = inputCost + outputCost
      costPer1kTokens = (cost / (data.totalTokens || 1)) * 1000
    }

    await prisma.apiUsage.create({
      data: {
        provider: data.provider,
        endpoint: data.endpoint,
        model: data.model,
        promptTokens: data.promptTokens,
        completionTokens: data.completionTokens,
        totalTokens: data.totalTokens,
        cost,
        costPer1kTokens,
        debateId: data.debateId,
        userId: data.userId,
        success: data.success ?? true,
        errorMessage: data.errorMessage,
        responseTime: data.responseTime,
        metadata: data.metadata ? JSON.stringify(data.metadata) : null,
      },
    })
  } catch (error) {
    // Don't throw - API tracking shouldn't break the main flow
    console.error('Failed to log API usage:', error)
  }
}

export async function getApiUsageStats(startDate?: Date, endDate?: Date) {
  const where: any = {}
  
  if (startDate || endDate) {
    where.createdAt = {}
    if (startDate) where.createdAt.gte = startDate
    if (endDate) where.createdAt.lte = endDate
  }

  const [totalCalls, successfulCalls, failedCalls, totalCost, totalTokens, usageByProvider] = await Promise.all([
    prisma.apiUsage.count({ where }),
    prisma.apiUsage.count({ where: { ...where, success: true } }),
    prisma.apiUsage.count({ where: { ...where, success: false } }),
    prisma.apiUsage.aggregate({
      where,
      _sum: { cost: true },
    }),
    prisma.apiUsage.aggregate({
      where,
      _sum: { totalTokens: true },
    }),
    prisma.apiUsage.groupBy({
      by: ['provider'],
      where,
      _count: { id: true },
      _sum: { cost: true, totalTokens: true },
    }),
  ])

  return {
    totalCalls,
    successfulCalls,
    failedCalls,
    totalCost: totalCost._sum.cost || 0,
    totalTokens: totalTokens._sum.totalTokens || 0,
    usageByProvider: usageByProvider.map((item) => ({
      provider: item.provider,
      calls: item._count.id,
      cost: item._sum.cost || 0,
      tokens: item._sum.totalTokens || 0,
    })),
  }
}










