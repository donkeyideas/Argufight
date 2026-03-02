import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/get-session';
import { SupportForm } from '@/components/features/support/support-form';
import { Card } from '@/components/ui/card';
import { MessageSquare, Book, Mail } from 'lucide-react';

export const metadata: Metadata = { title: 'Support' };

const FAQS = [
  {
    q: 'How are debates judged?',
    a: 'An AI judge evaluates each debate based on argument quality, evidence, logic, and persuasiveness. Judges have different personalities — some are strict logicians, others value creativity.',
  },
  {
    q: 'How does ELO rating work?',
    a: 'Your ELO adjusts after each debate. Beating a higher-rated opponent gains more points; losing to a lower-rated opponent costs more. Starting ELO is 1200.',
  },
  {
    q: 'What are championship belts?',
    a: 'Belts are awarded in specific categories. You can challenge the current holder. Lose your belt if you go too long without defending it.',
  },
  {
    q: 'Can I appeal a verdict?',
    a: 'Yes. Pro and above subscribers can appeal verdicts. An independent AI judge reviews the debate and may overturn the decision.',
  },
  {
    q: 'How do I report a user?',
    a: 'Use the report button on any debate or profile. Our moderation team reviews all reports within 24 hours.',
  },
];

export default async function SupportPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  return (
    <div className="p-5 max-w-3xl mx-auto">
      <h1 className="text-sm font-[500] text-text mb-6">Support</h1>

      <div className="grid sm:grid-cols-3 gap-3 mb-6">
        {[
          { icon: <Book size={14} />,          title: 'Documentation', desc: 'Rules, guides, and how-to articles', href: '/about' },
          { icon: <MessageSquare size={14} />,  title: 'Community',     desc: 'Ask questions in our Discord server', href: '#' },
          { icon: <Mail size={14} />,           title: 'Email us',      desc: 'support@argufight.com',               href: 'mailto:support@argufight.com' },
        ].map((item) => (
          <a key={item.title} href={item.href}
            className="bg-surface border border-border rounded-[var(--radius)] p-4 hover:border-border-2 transition-colors group">
            <div className="text-text-3 mb-2 group-hover:text-text-2 transition-colors">{item.icon}</div>
            <p className="text-xs font-[450] text-text mb-1">{item.title}</p>
            <p className="text-[13px] text-text-3">{item.desc}</p>
          </a>
        ))}
      </div>

      {/* FAQ */}
      <Card padding="lg" className="mb-4">
        <p className="label mb-4">Frequently asked</p>
        <div className="space-y-4">
          {FAQS.map((faq) => (
            <div key={faq.q}>
              <p className="text-xs font-[450] text-text mb-1">{faq.q}</p>
              <p className="text-[13px] text-text-2 leading-relaxed">{faq.a}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* Contact form */}
      <Card padding="lg">
        <p className="label mb-4">Send a message</p>
        <SupportForm userEmail={session.userId} />
      </Card>
    </div>
  );
}
