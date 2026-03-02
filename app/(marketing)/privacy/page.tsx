import type { Metadata } from 'next'
import { prisma } from '@/lib/db/prisma'

export const metadata: Metadata = {
  title: 'Privacy Policy | ArguFight',
  description: 'Privacy Policy for ArguFight.',
}

async function getPage() {
  try {
    return await prisma.legalPage.findUnique({ where: { slug: 'privacy-policy' } })
      ?? await prisma.legalPage.findUnique({ where: { slug: 'privacy' } })
  } catch {
    return null
  }
}

export default async function PrivacyPage() {
  const page = await getPage()

  return (
    <div className="max-w-3xl mx-auto px-6 py-16">
      <div className="mb-10">
        <p className="text-[13px] font-[500] text-accent uppercase tracking-widest mb-4">Legal</p>
        <h1 className="text-[40px] font-[700] tracking-[-1.5px] text-text mb-3">
          {page?.title ?? 'Privacy Policy'}
        </h1>
        <p className="text-[14px] text-text-3">Last updated: March 2026</p>
      </div>

      <div className="h-px bg-border mb-10" />

      {page?.content ? (
        <div
          className="prose prose-sm max-w-none prose-headings:text-text prose-headings:font-[600] prose-headings:tracking-[-0.3px] prose-p:text-text-2 prose-p:leading-relaxed prose-strong:text-text prose-ul:text-text-2 prose-ol:text-text-2 prose-li:text-text-2 prose-a:text-accent prose-a:no-underline hover:prose-a:underline prose-hr:border-border"
          dangerouslySetInnerHTML={{ __html: page.content }}
        />
      ) : (
        <div className="prose prose-sm max-w-none text-text-2 space-y-8">

          <section>
            <h2 className="text-[20px] font-[600] text-text mb-3">1. Information We Collect</h2>
            <p className="text-[15px] leading-relaxed mb-3">
              When you create an account, we collect your email address, username, and password (hashed).
              You may optionally provide a profile picture and bio.
            </p>
            <p className="text-[15px] leading-relaxed">
              We automatically collect usage data such as debate history, ELO scores, login timestamps,
              and IP addresses for security purposes.
            </p>
          </section>

          <section>
            <h2 className="text-[20px] font-[600] text-text mb-3">2. How We Use Your Information</h2>
            <ul className="list-disc list-inside space-y-2 text-[15px] leading-relaxed text-text-3 ml-2">
              <li>To operate and improve the ArguFight platform</li>
              <li>To process debate verdicts via AI systems</li>
              <li>To send account-related notifications and updates</li>
              <li>To detect and prevent fraud and abuse</li>
              <li>To comply with legal obligations</li>
            </ul>
          </section>

          <section>
            <h2 className="text-[20px] font-[600] text-text mb-3">3. Information Sharing</h2>
            <p className="text-[15px] leading-relaxed">
              We do not sell your personal information. We may share data with trusted service providers
              (hosting, payment processing, AI services) strictly for operating the Platform. We may disclose
              information if required by law or to protect the rights and safety of users.
            </p>
          </section>

          <section>
            <h2 className="text-[20px] font-[600] text-text mb-3">4. Public Information</h2>
            <p className="text-[15px] leading-relaxed">
              Your username, debate history, ELO rank, and championship belts are publicly visible on the
              Platform. Avoid including sensitive personal information in debate content.
            </p>
          </section>

          <section>
            <h2 className="text-[20px] font-[600] text-text mb-3">5. Cookies and Tracking</h2>
            <p className="text-[15px] leading-relaxed">
              We use essential cookies for authentication and session management. We may use analytics
              tools to understand usage patterns. You can disable non-essential cookies in your browser
              settings, though this may affect Platform functionality.
            </p>
          </section>

          <section>
            <h2 className="text-[20px] font-[600] text-text mb-3">6. Data Retention</h2>
            <p className="text-[15px] leading-relaxed">
              We retain your account data for as long as your account is active. If you delete your account,
              we will remove your personal information within 30 days, except where retention is required
              by law or for legitimate business purposes (e.g., fraud prevention).
            </p>
          </section>

          <section>
            <h2 className="text-[20px] font-[600] text-text mb-3">7. Security</h2>
            <p className="text-[15px] leading-relaxed">
              We implement industry-standard security measures including encryption at rest and in transit,
              hashed passwords, and regular security audits. However, no system is completely secure and
              we cannot guarantee absolute security.
            </p>
          </section>

          <section>
            <h2 className="text-[20px] font-[600] text-text mb-3">8. Your Rights</h2>
            <p className="text-[15px] leading-relaxed mb-3">
              Depending on your location, you may have rights to access, correct, delete, or export your
              personal data. To exercise these rights, contact us at{' '}
              <a href="mailto:info@argufight.com" className="text-accent hover:underline">
                info@argufight.com
              </a>.
            </p>
          </section>

          <section>
            <h2 className="text-[20px] font-[600] text-text mb-3">9. Children&apos;s Privacy</h2>
            <p className="text-[15px] leading-relaxed">
              ArguFight is not intended for users under 13. We do not knowingly collect personal information
              from children under 13. If we become aware that we have collected such information, we will
              delete it promptly.
            </p>
          </section>

          <section>
            <h2 className="text-[20px] font-[600] text-text mb-3">10. Changes to This Policy</h2>
            <p className="text-[15px] leading-relaxed">
              We may update this Privacy Policy from time to time. We will notify you of significant changes
              via email or in-platform notice. Continued use of the Platform after changes constitutes
              acceptance of the updated policy.
            </p>
          </section>

          <section>
            <h2 className="text-[20px] font-[600] text-text mb-3">11. Contact Us</h2>
            <p className="text-[15px] leading-relaxed">
              For privacy-related questions or requests, contact us at{' '}
              <a href="mailto:info@argufight.com" className="text-accent hover:underline">
                info@argufight.com
              </a>.
            </p>
          </section>

        </div>
      )}
    </div>
  )
}
