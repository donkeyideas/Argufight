/**
 * Calculate word count from text content
 */
export function calculateWordCount(text: string): number {
  if (!text || !text.trim()) return 0
  // Split by whitespace and filter out empty strings
  return text.trim().split(/\s+/).filter(word => word.length > 0).length
}

/**
 * Update user analytics after statement submission
 */
export async function updateUserAnalyticsOnStatement(
  userId: string,
  wordCount: number
) {
  const { prisma } = await import('@/lib/db/prisma')
  
  // Update total word count and statement count
  await prisma.user.update({
    where: { id: userId },
    data: {
      totalWordCount: { increment: wordCount },
      totalStatements: { increment: 1 },
    },
  })
  
  // Recalculate average word count
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      totalWordCount: true,
      totalStatements: true,
    },
  })
  
  if (user && user.totalStatements > 0) {
    await prisma.user.update({
      where: { id: userId },
      data: {
        averageWordCount: user.totalWordCount / user.totalStatements,
      },
    })
  }
}

/**
 * Update user analytics after debate completion
 */
export async function updateUserAnalyticsOnDebateComplete(
  userId: string,
  rounds: number
) {
  const { prisma } = await import('@/lib/db/prisma')
  
  // Get user's current debate count
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      totalDebates: true,
      averageRounds: true,
    },
  })
  
  if (!user) return
  
  // Calculate new average rounds
  // Formula: (oldAverage * oldCount + newRounds) / (oldCount + 1)
  const oldCount = user.totalDebates
  const oldAverage = user.averageRounds || 0
  const newAverage = oldCount > 0
    ? (oldAverage * oldCount + rounds) / (oldCount + 1)
    : rounds
  
  await prisma.user.update({
    where: { id: userId },
    data: {
      averageRounds: newAverage,
    },
  })
}










