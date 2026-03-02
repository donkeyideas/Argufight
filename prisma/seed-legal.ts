import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding legal pages...')

  const pages = [
    {
      slug: 'terms',
      title: 'Terms of Service',
      content: `
        <h2>1. Acceptance of Terms</h2>
        <p>By accessing and using Honorable AI, you accept and agree to be bound by the terms and provision of this agreement.</p>
        
        <h2>2. Use License</h2>
        <p>Permission is granted to temporarily access the materials on Honorable AI's website for personal, non-commercial transitory viewing only.</p>
        
        <h2>3. User Accounts</h2>
        <p>You are responsible for maintaining the confidentiality of your account and password. You agree to accept responsibility for all activities that occur under your account.</p>
        
        <h2>4. Debate Conduct</h2>
        <p>Users must engage in debates respectfully and follow community guidelines. Harassment, hate speech, or inappropriate content will result in account suspension or termination.</p>
        
        <h2>5. AI Judging</h2>
        <p>Debates are judged by AI personalities. While we strive for fairness, AI judgments are final and not subject to human review except through the appeal process.</p>
        
        <h2>6. Limitation of Liability</h2>
        <p>Honorable AI shall not be liable for any indirect, incidental, special, consequential, or punitive damages resulting from your use of the platform.</p>
      `,
      metaTitle: 'Terms of Service - Honorable AI',
      metaDescription: 'Terms of Service for Honorable AI - AI-Judged Debate Platform',
      isVisible: true,
    },
    {
      slug: 'privacy',
      title: 'Privacy Policy',
      content: `
        <h2>1. Information We Collect</h2>
        <p>We collect information you provide directly to us, such as when you create an account, participate in debates, or contact us for support.</p>
        
        <h2>2. How We Use Your Information</h2>
        <p>We use the information we collect to:</p>
        <ul>
          <li>Provide, maintain, and improve our services</li>
          <li>Process transactions and send related information</li>
          <li>Send technical notices and support messages</li>
          <li>Respond to your comments and questions</li>
        </ul>
        
        <h2>3. Information Sharing</h2>
        <p>We do not sell, trade, or rent your personal information to third parties. We may share your information only in the following circumstances:</p>
        <ul>
          <li>With your consent</li>
          <li>To comply with legal obligations</li>
          <li>To protect our rights and safety</li>
        </ul>
        
        <h2>4. Data Security</h2>
        <p>We implement appropriate technical and organizational measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction.</p>
        
        <h2>5. Your Rights</h2>
        <p>You have the right to access, update, or delete your personal information at any time through your account settings.</p>
        
        <h2>6. Changes to This Policy</h2>
        <p>We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page.</p>
      `,
      metaTitle: 'Privacy Policy - Honorable AI',
      metaDescription: 'Privacy Policy for Honorable AI - AI-Judged Debate Platform',
      isVisible: true,
    },
  ]

  for (const page of pages) {
    await prisma.legalPage.upsert({
      where: { slug: page.slug },
      update: page,
      create: page,
    })
    console.log(`✓ Created/updated legal page: ${page.slug}`)
  }

  console.log('Legal pages seeded successfully!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })










