export interface SeoSuggestion {
  id: string
  type: 'success' | 'warning' | 'error'
  message: string
  field: string
}

export interface SeoAnalysis {
  score: number
  grade: 'Excellent' | 'Good' | 'Needs Work' | 'Poor'
  suggestions: SeoSuggestion[]
}

interface SeoInput {
  title: string
  content: string
  excerpt: string
  metaTitle: string
  metaDescription: string
  keywords: string
  slug: string
}

function countWords(html: string): number {
  const text = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
  if (!text) return 0
  return text.split(' ').length
}

export function calculateSeoScore(input: SeoInput): SeoAnalysis {
  const suggestions: SeoSuggestion[] = []
  let score = 0

  // Title length (10 pts) — ideal 30-60 chars
  const titleLen = input.title.trim().length
  if (titleLen >= 30 && titleLen <= 60) {
    score += 10
    suggestions.push({ id: 'title-length', type: 'success', message: `Title length is ideal (${titleLen} chars).`, field: 'title' })
  } else if (titleLen > 0 && titleLen < 30) {
    score += 5
    suggestions.push({ id: 'title-length', type: 'warning', message: `Title is short (${titleLen}/30 chars). Aim for 30-60 characters.`, field: 'title' })
  } else if (titleLen > 60) {
    score += 5
    suggestions.push({ id: 'title-length', type: 'warning', message: `Title is long (${titleLen} chars). Keep it under 60 for best SEO.`, field: 'title' })
  } else {
    suggestions.push({ id: 'title-length', type: 'error', message: 'Title is required.', field: 'title' })
  }

  // Meta description (15 pts) — ideal 120-160 chars
  const metaLen = input.metaDescription.trim().length
  if (metaLen >= 120 && metaLen <= 160) {
    score += 15
    suggestions.push({ id: 'meta-desc', type: 'success', message: `Meta description length is ideal (${metaLen} chars).`, field: 'metaDescription' })
  } else if (metaLen > 0 && metaLen < 120) {
    score += 8
    suggestions.push({ id: 'meta-desc', type: 'warning', message: `Meta description is short (${metaLen}/120 chars). Aim for 120-160 characters.`, field: 'metaDescription' })
  } else if (metaLen > 160) {
    score += 8
    suggestions.push({ id: 'meta-desc', type: 'warning', message: `Meta description is too long (${metaLen}/160). Keep it under 160 characters.`, field: 'metaDescription' })
  } else {
    suggestions.push({ id: 'meta-desc', type: 'error', message: 'Add a meta description (120-160 characters) for better search visibility.', field: 'metaDescription' })
  }

  // Content length (15 pts) — 300+ words
  const wordCount = countWords(input.content)
  if (wordCount >= 300) {
    score += 15
    suggestions.push({ id: 'content-length', type: 'success', message: `Content has ${wordCount} words. Good length!`, field: 'content' })
  } else if (wordCount >= 150) {
    score += 8
    suggestions.push({ id: 'content-length', type: 'warning', message: `Content has ${wordCount} words. Aim for 300+ for better SEO.`, field: 'content' })
  } else if (wordCount > 0) {
    score += 3
    suggestions.push({ id: 'content-length', type: 'error', message: `Content is too short (${wordCount} words). Write at least 300 words.`, field: 'content' })
  } else {
    suggestions.push({ id: 'content-length', type: 'error', message: 'Content is empty. Add blog content.', field: 'content' })
  }

  // Has headings h2/h3 (10 pts)
  const headingCount = (input.content.match(/<h[23][^>]*>/gi) || []).length
  if (headingCount >= 2) {
    score += 10
  } else if (headingCount === 1) {
    score += 5
    suggestions.push({ id: 'headings', type: 'warning', message: 'Add more subheadings (H2/H3) to structure your content.', field: 'content' })
  } else if (wordCount > 0) {
    suggestions.push({ id: 'headings', type: 'error', message: 'Add subheadings (H2/H3) to break up your content.', field: 'content' })
  }

  // Keywords present (10 pts) — at least 3
  const keywordList = input.keywords.split(',').map(k => k.trim()).filter(Boolean)
  if (keywordList.length >= 3) {
    score += 10
    suggestions.push({ id: 'keywords', type: 'success', message: `${keywordList.length} keywords defined.`, field: 'keywords' })
  } else if (keywordList.length > 0) {
    score += 5
    suggestions.push({ id: 'keywords', type: 'warning', message: `Only ${keywordList.length} keyword(s). Add at least 3 for better targeting.`, field: 'keywords' })
  } else {
    suggestions.push({ id: 'keywords', type: 'error', message: 'Add keywords (comma-separated) for SEO targeting.', field: 'keywords' })
  }

  // Keywords appear in content (10 pts)
  if (keywordList.length > 0 && wordCount > 0) {
    const contentLower = input.content.toLowerCase()
    const found = keywordList.filter(kw => contentLower.includes(kw.toLowerCase()))
    const ratio = found.length / keywordList.length
    if (ratio >= 0.5) {
      score += 10
    } else if (found.length > 0) {
      score += 5
      suggestions.push({ id: 'keyword-usage', type: 'warning', message: `Only ${found.length}/${keywordList.length} keywords appear in content. Use more keywords naturally.`, field: 'content' })
    } else {
      suggestions.push({ id: 'keyword-usage', type: 'error', message: 'None of your keywords appear in the content. Include them naturally.', field: 'content' })
    }
  }

  // Excerpt present (10 pts) — 50-200 chars
  const excerptLen = input.excerpt.trim().length
  if (excerptLen >= 50 && excerptLen <= 200) {
    score += 10
  } else if (excerptLen > 0) {
    score += 5
    suggestions.push({ id: 'excerpt', type: 'warning', message: excerptLen < 50 ? `Excerpt is short (${excerptLen} chars). Aim for 50-200.` : `Excerpt is long (${excerptLen} chars). Keep it under 200.`, field: 'excerpt' })
  } else {
    suggestions.push({ id: 'excerpt', type: 'warning', message: 'Add an excerpt for better listing previews.', field: 'excerpt' })
  }

  // Has links (5 pts)
  const hasLinks = /<a\s/i.test(input.content)
  if (hasLinks) {
    score += 5
  } else if (wordCount > 0) {
    suggestions.push({ id: 'links', type: 'warning', message: 'Add internal or external links to improve SEO.', field: 'content' })
  }

  // Has images (5 pts)
  const hasImages = /<img\s/i.test(input.content)
  if (hasImages) {
    score += 5
  } else if (wordCount > 0) {
    suggestions.push({ id: 'images', type: 'warning', message: 'Add images to make your content more engaging.', field: 'content' })
  }

  // Meta title set (5 pts)
  if (input.metaTitle.trim()) {
    score += 5
  } else {
    suggestions.push({ id: 'meta-title', type: 'warning', message: 'Set a custom meta title for better search results.', field: 'metaTitle' })
  }

  // Slug is clean (5 pts)
  if (input.slug.trim()) {
    score += 5
  }

  // Determine grade
  let grade: SeoAnalysis['grade']
  if (score >= 80) grade = 'Excellent'
  else if (score >= 60) grade = 'Good'
  else if (score >= 40) grade = 'Needs Work'
  else grade = 'Poor'

  return { score, grade, suggestions }
}
