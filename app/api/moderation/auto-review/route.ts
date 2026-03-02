import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { moderateReport, moderateStatement } from '@/lib/ai/moderation'

/**
 * POST /api/moderation/auto-review
 * Automatically review pending reports and flagged statements using AI
 * This endpoint can be called:
 * 1. When a new report is submitted (webhook/trigger)
 * 2. Periodically via cron job
 * 3. Manually by admin
 */
export async function POST(request: NextRequest) {
  try {
    const { reportId, statementId } = await request.json()

    if (reportId) {
      return await autoReviewReport(reportId)
    }

    if (statementId) {
      return await autoReviewStatement(statementId)
    }

    // If no specific ID, review all pending items
    const [pendingReports, flaggedStatements] = await Promise.all([
      prisma.report.findMany({
        where: {
          status: 'PENDING',
          aiModerated: false,
        },
        take: 10, // Process in batches
      }),
      prisma.statement.findMany({
        where: {
          flagged: true,
          aiModerated: false,
        },
        include: {
          author: { select: { username: true } },
          debate: { select: { topic: true } },
        },
        take: 10,
      }),
    ])

    const results = {
      reportsReviewed: 0,
      statementsReviewed: 0,
      autoResolved: 0,
      escalated: 0,
    }

    // Review reports
    for (const report of pendingReports) {
      const response = await autoReviewReport(report.id)
      const result = await response.json()
      if (result.success && result.autoResolved) results.autoResolved++
      if (result.success && result.escalated) results.escalated++
      results.reportsReviewed++
    }

    // Review statements
    for (const statement of flaggedStatements) {
      const response = await autoReviewStatement(statement.id)
      const result = await response.json()
      if (result.success && result.autoResolved) results.autoResolved++
      if (result.success && result.escalated) results.escalated++
      results.statementsReviewed++
    }

    return NextResponse.json({
      success: true,
      ...results,
    })
  } catch (error) {
    console.error('Auto-review failed:', error)
    return NextResponse.json(
      { error: 'Failed to auto-review content' },
      { status: 500 }
    )
  }
}

async function autoReviewReport(reportId: string) {
  const report = await prisma.report.findUnique({
    where: { id: reportId },
    include: {
      debate: { select: { topic: true } },
      reporter: { select: { username: true } },
    },
  })

  if (!report || report.status !== 'PENDING' || report.aiModerated) {
    return NextResponse.json({ error: 'Report not found or already reviewed' }, { status: 400 })
  }

  // Get the content being reported (if it's a statement)
  let reportedContent: string | undefined
  if (report.debateId) {
    // Could fetch the specific statement if report includes statementId
    // For now, we'll use the debate topic as context
  }

  const moderationResult = await moderateReport(
    {
      reportReason: report.reason,
      reportDescription: report.description || undefined,
      content: reportedContent,
      authorUsername: report.reporter.username,
      debateTopic: report.debate?.topic,
    },
    reportId
  )

  // Update report with AI moderation results
  await prisma.report.update({
    where: { id: reportId },
    data: {
      aiModerated: true,
      aiAction: moderationResult.action,
      aiConfidence: moderationResult.confidence,
      aiReasoning: moderationResult.reasoning,
      aiSeverity: moderationResult.severity,
      aiModeratedAt: new Date(),
    },
  })

  let autoResolved = false
  let escalated = false

  // Auto-resolve if high confidence
  if (moderationResult.confidence >= 80) {
    if (moderationResult.action === 'APPROVE') {
      await prisma.report.update({
        where: { id: reportId },
        data: {
          status: 'DISMISSED',
          reviewedAt: new Date(),
          resolution: `Auto-dismissed by AI (${moderationResult.confidence}% confidence): ${moderationResult.reasoning}`,
        },
      })
      autoResolved = true
    } else if (moderationResult.action === 'REMOVE') {
      // For REMOVE action, we still need admin to confirm and take action
      // But we can mark it as high priority
      await prisma.report.update({
        where: { id: reportId },
        data: {
          status: 'REVIEWING', // Move to reviewing for admin to take action
        },
      })
      autoResolved = true
    }
  } else {
    // Low confidence - escalate for human review
    escalated = true
  }

  return NextResponse.json({
    success: true,
    reportId,
    action: moderationResult.action,
    confidence: moderationResult.confidence,
    autoResolved,
    escalated,
  })
}

async function autoReviewStatement(statementId: string) {
  const statement = await prisma.statement.findUnique({
    where: { id: statementId },
    include: {
      author: { select: { username: true } },
      debate: { select: { topic: true } },
    },
  })

  if (!statement || !statement.flagged || statement.aiModerated) {
    return NextResponse.json({ error: 'Statement not found or already reviewed' }, { status: 400 })
  }

  const moderationResult = await moderateStatement(
    {
      content: statement.content,
      authorUsername: statement.author.username,
      debateTopic: statement.debate.topic,
      round: statement.round,
    },
    statementId
  )

  // Update statement with AI moderation results
  await prisma.statement.update({
    where: { id: statementId },
    data: {
      aiModerated: true,
      aiAction: moderationResult.action,
      aiConfidence: moderationResult.confidence,
      aiReasoning: moderationResult.reasoning,
      aiSeverity: moderationResult.severity,
      aiModeratedAt: new Date(),
    },
  })

  let autoResolved = false
  let escalated = false

  // Auto-resolve if high confidence
  if (moderationResult.confidence >= 80) {
    if (moderationResult.action === 'APPROVE') {
      // Unflag the statement
      await prisma.statement.update({
        where: { id: statementId },
        data: {
          flagged: false,
          moderatedAt: new Date(),
        },
      })
      autoResolved = true
    } else if (moderationResult.action === 'REMOVE') {
      // Delete the statement
      await prisma.statement.delete({
        where: { id: statementId },
      })
      autoResolved = true
    }
  } else {
    // Low confidence - escalate for human review
    escalated = true
  }

  return NextResponse.json({
    success: true,
    statementId,
    action: moderationResult.action,
    confidence: moderationResult.confidence,
    autoResolved,
    escalated,
  })
}

