import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/auth/session-utils'
import { prisma } from '@/lib/db/prisma'
import { JUDGE_PERSONALITIES } from '@/lib/ai/judges'

export const dynamic = 'force-dynamic'

// POST /api/admin/seed - Seed database with initial data (admin only)
export async function POST(request: NextRequest) {
  try {
    // Verify admin access
    const userId = await verifyAdmin()
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 401 }
      )
    }

    console.log('🌱 Starting database seeding via API...')

    // 1. Seed Categories
    console.log('📁 Seeding Categories...')
    const INITIAL_CATEGORIES = [
      { name: 'SPORTS', label: 'Sports', icon: '🏈', color: '#10B981', sortOrder: 1 },
      { name: 'POLITICS', label: 'Politics', icon: '🏛️', color: '#3B82F6', sortOrder: 2 },
      { name: 'TECH', label: 'Tech', icon: '💻', color: '#8B5CF6', sortOrder: 3 },
      { name: 'ENTERTAINMENT', label: 'Entertainment', icon: '🎬', color: '#F59E0B', sortOrder: 4 },
      { name: 'SCIENCE', label: 'Science', icon: '🔬', color: '#06B6D4', sortOrder: 5 },
      { name: 'OTHER', label: 'Other', icon: '💭', color: '#6B7280', sortOrder: 6 },
    ]

    const seededCategories = []
    for (const category of INITIAL_CATEGORIES) {
      const result = await prisma.category.upsert({
        where: { name: category.name },
        update: { ...category, isActive: true },
        create: { ...category, isActive: true },
      })
      seededCategories.push(result)
    }

    // 2. Seed Judges
    console.log('⚖️  Seeding AI Judges...')
    const seededJudges = []
    for (const judge of JUDGE_PERSONALITIES) {
      const result = await prisma.judge.upsert({
        where: { name: judge.name },
        update: judge,
        create: judge,
      })
      seededJudges.push(result)
    }

    // 3. Seed Homepage Sections
    console.log('📄 Seeding Homepage Sections...')
    const sections = [
      {
        key: 'hero',
        title: 'Welcome to Argu Fight',
        content: '<p>The world\'s first AI-judged debate platform. Engage in structured debates and get judged by AI personalities.</p>',
        order: 0,
        isVisible: true,
        metaTitle: 'Argu Fight - AI-Judged Debate Platform',
        metaDescription: 'Engage in structured debates judged by AI personalities. Climb the ELO leaderboard and prove your argumentation skills.',
      },
      {
        key: 'features',
        title: 'Features',
        content: '<p>Discover what makes Argu Fight unique:</p><ul><li>AI-powered judges with distinct personalities</li><li>ELO ranking system</li><li>Structured debate format</li><li>Real-time chat and engagement</li></ul>',
        order: 1,
        isVisible: true,
      },
      {
        key: 'how-it-works',
        title: 'How It Works',
        content: '<p>1. Create or accept a debate challenge<br/>2. Submit your arguments over 5 rounds<br/>3. Get judged by AI personalities<br/>4. Climb the ELO leaderboard</p>',
        order: 2,
        isVisible: true,
      },
      {
        key: 'testimonials',
        title: 'What Users Say',
        content: '<p>Join thousands of debaters who are improving their argumentation skills every day.</p>',
        order: 3,
        isVisible: true,
      },
      {
        key: 'app-download',
        title: 'Download Our App',
        content: '<p>Get the Argu Fight app on your mobile device and debate on the go!</p>',
        order: 4,
        isVisible: true,
      },
      {
        key: 'footer',
        title: null,
        content: null,
        order: 999,
        isVisible: true,
      },
    ]

    const seededSections = []
    for (const section of sections) {
      const result = await prisma.homepageSection.upsert({
        where: { key: section.key },
        update: section,
        create: section,
      })
      seededSections.push(result)
    }

    // 4. Seed Legal Pages
    console.log('📜 Seeding Legal Pages...')
    const pages = [
      {
        slug: 'terms',
        title: 'Terms of Service',
        content: `<h2>1. Acceptance of Terms</h2><p>By accessing and using Argu Fight, you accept and agree to be bound by the terms and provision of this agreement.</p><h2>2. Use License</h2><p>Permission is granted to temporarily access the materials on Argu Fight's website for personal, non-commercial transitory viewing only.</p><h2>3. User Accounts</h2><p>You are responsible for maintaining the confidentiality of your account and password. You agree to accept responsibility for all activities that occur under your account.</p><h2>4. Debate Conduct</h2><p>Users must engage in debates respectfully and follow community guidelines. Harassment, hate speech, or inappropriate content will result in account suspension or termination.</p><h2>5. AI Judging</h2><p>Debates are judged by AI personalities. While we strive for fairness, AI judgments are final and not subject to human review except through the appeal process.</p><h2>6. Limitation of Liability</h2><p>Argu Fight shall not be liable for any indirect, incidental, special, consequential, or punitive damages resulting from your use of the platform.</p>`,
        metaTitle: 'Terms of Service - Argu Fight',
        metaDescription: 'Terms of Service for Argu Fight - AI-Judged Debate Platform',
        isVisible: true,
      },
      {
        slug: 'privacy',
        title: 'Privacy Policy',
        content: `<h2>1. Information We Collect</h2><p>We collect information you provide directly to us, such as when you create an account, participate in debates, or contact us for support.</p><h2>2. How We Use Your Information</h2><p>We use the information we collect to:</p><ul><li>Provide, maintain, and improve our services</li><li>Process transactions and send related information</li><li>Send technical notices and support messages</li><li>Respond to your comments and questions</li></ul><h2>3. Information Sharing</h2><p>We do not sell, trade, or rent your personal information to third parties. We may share your information only in the following circumstances:</p><ul><li>With your consent</li><li>To comply with legal obligations</li><li>To protect our rights and safety</li></ul><h2>4. Data Security</h2><p>We implement appropriate technical and organizational measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction.</p><h2>5. Your Rights</h2><p>You have the right to access, update, or delete your personal information at any time through your account settings.</p><h2>6. Changes to This Policy</h2><p>We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page.</p>`,
        metaTitle: 'Privacy Policy - Argu Fight',
        metaDescription: 'Privacy Policy for Argu Fight - AI-Judged Debate Platform',
        isVisible: true,
      },
    ]

    const seededPages = []
    for (const page of pages) {
      const result = await prisma.legalPage.upsert({
        where: { slug: page.slug },
        update: page,
        create: page,
      })
      seededPages.push(result)
    }

    return NextResponse.json({
      success: true,
      message: 'Database seeded successfully',
      results: {
        categories: seededCategories.length,
        judges: seededJudges.length,
        homepageSections: seededSections.length,
        legalPages: seededPages.length,
      },
    })
  } catch (error: any) {
    console.error('Failed to seed database:', error)
    return NextResponse.json(
      {
        error: 'Failed to seed database',
        details: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      { status: 500 }
    )
  }
}










