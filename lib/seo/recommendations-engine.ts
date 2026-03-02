import type { AuditResult, AuditIssue } from './audit-engine'

export interface Recommendation {
  category: string
  severity: string
  title: string
  description: string
  impact: string
  effort: string
  pageUrl?: string
}

export function generateRecommendations(auditResult: AuditResult): Recommendation[] {
  const recommendations: Recommendation[] = []

  // Convert audit issues to recommendations with impact/effort ratings
  const allIssues: AuditIssue[] = [
    ...auditResult.categories.technical.issues,
    ...auditResult.categories.content.issues,
    ...auditResult.categories.performance.issues,
    ...auditResult.categories.geo.issues,
  ]

  for (const issue of allIssues) {
    recommendations.push({
      category: issue.category,
      severity: issue.severity,
      title: issue.title,
      description: issue.recommendation,
      impact: severityToImpact(issue.severity),
      effort: estimateEffort(issue),
      pageUrl: issue.pageUrl,
    })
  }

  // Add proactive recommendations based on scores
  if (auditResult.geoScore < 90) {
    const hasGeoRec = recommendations.some((r) => r.category === 'geo')
    if (!hasGeoRec) {
      recommendations.push({
        category: 'geo',
        severity: 'info',
        title: 'Optimize content for AI citation',
        description:
          'Structure blog posts with clear H2/H3 headings, bullet points, and concise definitions that AI engines can easily extract and cite.',
        impact: 'medium',
        effort: 'medium',
      })
    }
  }

  if (auditResult.contentScore < 80) {
    recommendations.push({
      category: 'content_seo',
      severity: 'info',
      title: 'Create pillar content for key topics',
      description:
        'Write comprehensive, in-depth articles (2000+ words) on core debate topics like "How AI Judging Works" or "Guide to Competitive Debating" to attract organic search traffic.',
      impact: 'high',
      effort: 'hard',
    })
  }

  if (auditResult.performanceScore < 90) {
    recommendations.push({
      category: 'performance',
      severity: 'info',
      title: 'Submit sitemap to Google Search Console',
      description:
        'Connect Google Search Console and submit the sitemap to monitor indexing status and discover crawl issues.',
      impact: 'high',
      effort: 'easy',
    })
  }

  // Sort: critical first, then by impact
  const impactOrder = { high: 0, medium: 1, low: 2 }
  const severityOrder = { critical: 0, warning: 1, info: 2 }
  recommendations.sort((a, b) => {
    const sevDiff =
      (severityOrder[a.severity as keyof typeof severityOrder] ?? 2) -
      (severityOrder[b.severity as keyof typeof severityOrder] ?? 2)
    if (sevDiff !== 0) return sevDiff
    return (
      (impactOrder[a.impact as keyof typeof impactOrder] ?? 2) -
      (impactOrder[b.impact as keyof typeof impactOrder] ?? 2)
    )
  })

  return recommendations
}

function severityToImpact(severity: string): string {
  switch (severity) {
    case 'critical':
      return 'high'
    case 'warning':
      return 'medium'
    default:
      return 'low'
  }
}

function estimateEffort(issue: AuditIssue): string {
  // Simple heuristic based on common SEO tasks
  const easyPatterns = [
    'configured',
    'verification',
    'meta title',
    'meta description',
    'alt text',
    'OG image',
    'excerpt',
    'canonical',
    'analytics',
    'keyword',
    'social',
  ]
  const hardPatterns = ['content', 'thin content', 'word count', 'structured data']

  const titleLower = issue.title.toLowerCase()
  if (easyPatterns.some((p) => titleLower.includes(p))) return 'easy'
  if (hardPatterns.some((p) => titleLower.includes(p))) return 'hard'
  return 'medium'
}
