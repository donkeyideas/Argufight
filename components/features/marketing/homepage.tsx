import Link from 'next/link';
import { ArrowRight, Swords, Trophy, Zap, Shield, Star, CheckCircle, BarChart2, Smartphone, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import { prisma } from '@/lib/db/prisma';

// ─── DB sections (optional overrides) ─────────────────────────────────────────

async function getSections() {
  try {
    const rows = await prisma.homepageSection.findMany({
      where: { isVisible: true },
      include: {
        images: { orderBy: { order: 'asc' } },
        buttons: { where: { isVisible: true }, orderBy: { order: 'asc' } },
      },
      orderBy: { order: 'asc' },
    });
    return Object.fromEntries(rows.map(r => [r.key, r])) as Record<string, any>;
  } catch {
    return {} as Record<string, any>;
  }
}

// ─── Static content ────────────────────────────────────────────────────────────

const HOW_IT_WORKS = [
  { n: '1', title: 'Create Your Challenge',   desc: 'Choose a topic that fires you up. Pick FOR or AGAINST. Select standard (5 rounds, 24h) or speed mode (3 rounds, 1h). Hit create. Your challenge goes live in the Arena.' },
  { n: '2', title: 'Someone Accepts',         desc: 'Your challenge appears in the Open Challenges panel. Another debater sees it, likes the topic, accepts. You get notified. Round 1 begins. The battle is on.' },
  { n: '3', title: 'Trade Arguments',         desc: 'You have 100–500 characters per round. Make every word count. Submit your argument. Your opponent submits theirs. Round advances. Spectators watch live.' },
  { n: '4', title: 'AI Judges Deliberate',    desc: 'After the final round, 3 AI judges analyze every argument. The Empiricist checks facts. The Logician hunts fallacies. The Rhetorician measures persuasion. Each scores 0–100.' },
  { n: '5', title: 'Winner Takes ELO',        desc: 'Majority vote wins. ELO adjusts. Both debaters get detailed feedback. Learn, improve, challenge again. Become legendary.' },
];

const FEATURES = [
  { icon: <Swords size={20} />,   title: 'AI-Judged Debates',    desc: 'Every debate is evaluated by 3 AI judges with distinct personalities — objective, detailed verdicts every time.' },
  { icon: <Trophy size={20} />,   title: 'Championship Belts',   desc: 'Win and defend championship belts across debate categories. Lose them if you stop competing.' },
  { icon: <Zap size={20} />,      title: 'Tournaments',          desc: 'Bracket tournaments with ELO-based seeding. Compete for prizes, coins, and bragging rights.' },
  { icon: <Shield size={20} />,   title: 'ELO Rankings',         desc: 'Your rating adjusts after every debate based on outcome and opponent skill level.' },
  { icon: <Star size={20} />,     title: 'Spectator Mode',       desc: "Don't want to debate? Watch live battles, vote on who's winning, and mark \"That's The One\" moments." },
  { icon: <BarChart2 size={20} />,title: 'Deep Stats',           desc: 'Track your win rate, ELO progression, argument strength, and category performance over time.' },
];

const TESTIMONIALS = [
  { quote: 'This is fun; I love the challenge of debating people.', author: 'RiceSzn' },
  { quote: 'Waiting for the results is suspenseful.', author: 'Soccergod' },
  { quote: 'This is a very competitive platform.', author: 'kubancane' },
];

const STATS = [
  { value: '50K+', label: 'Debates completed' },
  { value: '12K+', label: 'Active debaters' },
  { value: '340+', label: 'Championship belts' },
  { value: '98%',  label: 'Verdict accuracy' },
];

const NAV_LINKS = [
  { href: '/blog',        label: 'Blog' },
  { href: '/leaderboard', label: 'Leaderboard' },
  { href: '/tournaments', label: 'Tournaments' },
];

const FOOTER_COLS = [
  {
    title: 'Platform',
    links: [
      { href: '/',            label: 'Home' },
      { href: '/dashboard',   label: 'Arena' },
      { href: '/leaderboard', label: 'Leaderboard' },
      { href: '/tournaments', label: 'Tournaments' },
      { href: '/blog',        label: 'Blog' },
    ],
  },
  {
    title: 'Resources',
    links: [
      { href: '/about',   label: 'About Us' },
      { href: '/support', label: 'Support' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { href: '/terms',   label: 'Terms of Service' },
      { href: '/privacy', label: 'Privacy Policy' },
    ],
  },
];

// ─── Component ────────────────────────────────────────────────────────────────

export async function MarketingHomePage() {
  const db = await getSections();
  const hero = db['hero'];
  const cta  = db['cta'];

  return (
    <div className="min-h-screen flex flex-col bg-bg text-text">

      {/* ══ Nav ══════════════════════════════════════════════════════════════════ */}
      <header className="h-14 border-b border-border flex items-center px-6 sticky top-0 z-40 bg-bg/95 backdrop-blur-sm">
        <Link href="/" className="flex items-center gap-2.5 flex-shrink-0">
          <div className="h-6 w-6 rounded bg-accent flex items-center justify-center">
            <Swords size={12} className="text-[#0c0c0c]" />
          </div>
          <span className="text-sm font-[300] tracking-[3px] uppercase select-none">
            Argu<strong className="font-[700] text-accent">Fight</strong>
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-0.5 ml-8">
          {NAV_LINKS.map(item => (
            <Link
              key={item.href}
              href={item.href}
              className="text-[15px] text-text-3 hover:text-text transition-colors px-3 py-2 rounded hover:bg-surface-2"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2 ml-auto">
          <ThemeToggle />
          <Link href="/login" className="text-[15px] text-text-2 hover:text-text transition-colors px-3 py-1.5">
            Login
          </Link>
          <Button variant="accent" size="sm" href="/signup">Sign Up</Button>
        </div>
      </header>

      {/* ══ Hero ════════════════════════════════════════════════════════════════ */}
      <section className="relative overflow-hidden border-b border-border">
        {/* subtle grid background */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] bg-[size:40px_40px] opacity-30" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-bg" />

        <div className="relative max-w-5xl mx-auto px-6 pt-24 pb-28">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-accent/30 bg-accent/5 text-accent text-[13px] font-[500] mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
            Now live — AI-judged debate platform
          </div>

          <h1 className="text-[56px] md:text-[72px] font-[700] leading-[1.05] tracking-[-2px] text-text mb-6 max-w-3xl">
            {hero?.title
              ? <span dangerouslySetInnerHTML={{ __html: hero.title }} />
              : <>Argue.<br />Win.<br />Prove&nbsp;<span className="text-accent">it.</span></>
            }
          </h1>

          <p className="text-[19px] text-text-2 font-[300] leading-relaxed mb-10 max-w-xl">
            {hero?.content
              ? <span dangerouslySetInnerHTML={{ __html: hero.content.replace(/<[^>]+>/g, '') }} />
              : 'The premier AI-judged debate platform. Issue challenges, submit arguments, and let our AI judges deliver fair, detailed verdicts. Earn belts. Climb ranks.'
            }
          </p>

          <div className="flex items-center gap-3 flex-wrap">
            {hero?.buttons?.length > 0
              ? hero.buttons.map((btn: any, i: number) => (
                  <Button key={btn.id} variant={i === 0 ? 'accent' : 'secondary'} size="lg" href={btn.url}>
                    {btn.text}{i === 0 && <ArrowRight size={15} />}
                  </Button>
                ))
              : <>
                  <Button variant="accent" size="lg" href="/signup">Start debating <ArrowRight size={15} /></Button>
                  <Button variant="secondary" size="lg" href="/login">Sign in</Button>
                </>
            }
          </div>

          <div className="flex items-center gap-6 mt-10">
            <div className="flex items-center gap-2">
              <CheckCircle size={14} className="text-accent" />
              <span className="text-[15px] text-text-3">Free to start</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle size={14} className="text-accent" />
              <span className="text-[15px] text-text-3">AI verdicts on every debate</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle size={14} className="text-accent" />
              <span className="text-[15px] text-text-3">Real-time ELO rankings</span>
            </div>
          </div>
        </div>
      </section>

      {/* ══ Stats bar ═══════════════════════════════════════════════════════════ */}
      <section className="border-b border-border bg-surface">
        <div className="max-w-5xl mx-auto px-6 py-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {STATS.map(s => (
              <div key={s.label} className="text-center">
                <p className="text-[32px] font-[200] text-text tracking-tight">{s.value}</p>
                <p className="text-[15px] text-text-3 mt-1">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ Features ════════════════════════════════════════════════════════════ */}
      <section className="max-w-5xl mx-auto px-6 py-20">
        <div className="mb-12 text-center">
          <p className="text-[13px] font-[500] text-accent uppercase tracking-widest mb-3">Platform features</p>
          <h2 className="text-[36px] font-[600] text-text tracking-[-1px]">Built for serious debate</h2>
          <p className="text-[17px] text-text-3 mt-3 max-w-lg mx-auto">
            Everything you need to compete, improve, and dominate the debate arena.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map(f => (
            <div
              key={f.title}
              className="bg-surface border border-border rounded-xl p-6 hover:border-border-2 hover:bg-surface-2 transition-all duration-200 group"
            >
              <div className="w-10 h-10 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center text-accent mb-4 group-hover:bg-accent/15 transition-colors">
                {f.icon}
              </div>
              <h3 className="text-[17px] font-[600] text-text mb-2">{f.title}</h3>
              <p className="text-[15px] text-text-3 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ══ How it works ════════════════════════════════════════════════════════ */}
      <section className="border-t border-border bg-surface">
        <div className="max-w-5xl mx-auto px-6 py-20">
          <div className="mb-12 text-center">
            <p className="text-[13px] font-[500] text-accent uppercase tracking-widest mb-3">Process</p>
            <h2 className="text-[36px] font-[600] text-text tracking-[-1px]">How it works</h2>
          </div>
          <div className="space-y-0">
            {HOW_IT_WORKS.map((step, i) => (
              <div key={step.n} className={`flex gap-8 py-8 ${i < HOW_IT_WORKS.length - 1 ? 'border-b border-border' : ''}`}>
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center">
                  <span className="text-[15px] font-[700] text-accent">{step.n}</span>
                </div>
                <div className="flex-1 pt-1">
                  <h3 className="text-[19px] font-[600] text-text mb-2">{step.title}</h3>
                  <p className="text-[16px] text-text-3 leading-relaxed max-w-2xl">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ Championship Belts ══════════════════════════════════════════════════ */}
      <section className="border-t border-border">
        <div className="max-w-5xl mx-auto px-6 py-20">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <p className="text-[13px] font-[500] text-accent uppercase tracking-widest mb-4">Competition</p>
              <h2 className="text-[36px] font-[600] text-text tracking-[-1px] mb-4">
                Compete for<br />Championship Belts
              </h2>
              <p className="text-[17px] text-text-3 leading-relaxed mb-6">
                Earn exclusive championship belts by dominating debates in your category. Each belt represents mastery in topics like Science, Sports, Politics, and more.
              </p>
              <ul className="space-y-3 mb-8">
                {[
                  'Challenge current belt holders to earn their title',
                  'Defend your belt or lose it to challengers',
                  'Stake your belt in high-stakes debates',
                  'Build your legacy as a top debater',
                ].map(item => (
                  <li key={item} className="flex items-start gap-3">
                    <CheckCircle size={16} className="text-accent flex-shrink-0 mt-0.5" />
                    <span className="text-[15px] text-text-2">{item}</span>
                  </li>
                ))}
              </ul>
              <Button variant="accent" size="lg" href="/signup">
                Claim your first belt <Trophy size={15} />
              </Button>
            </div>
            <div className="bg-surface border border-border rounded-2xl p-8 text-center">
              <div className="w-16 h-16 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center mx-auto mb-4">
                <Trophy size={32} className="text-accent" />
              </div>
              <p className="text-[22px] font-[600] text-text mb-2">Championship System</p>
              <p className="text-[15px] text-text-3 mb-6">Active belts across 7 debate categories</p>
              <div className="grid grid-cols-3 gap-3">
                {['SPORTS', 'POLITICS', 'TECH', 'SCIENCE', 'MUSIC', 'ENTERTAINMENT', 'OTHER'].map(cat => (
                  <div key={cat} className="bg-surface-2 border border-border rounded-lg px-2 py-2 text-center">
                    <p className="text-[12px] font-[500] text-text-3">{cat.charAt(0) + cat.slice(1).toLowerCase()}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══ Testimonials ════════════════════════════════════════════════════════ */}
      <section className="border-t border-border bg-surface">
        <div className="max-w-5xl mx-auto px-6 py-20">
          <div className="mb-12 text-center">
            <p className="text-[13px] font-[500] text-accent uppercase tracking-widest mb-3">Community</p>
            <h2 className="text-[36px] font-[600] text-text tracking-[-1px]">What debaters say</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            {TESTIMONIALS.map(t => (
              <div key={t.author} className="bg-bg border border-border rounded-xl p-6">
                <div className="flex gap-0.5 mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} size={13} className="text-accent fill-accent" />
                  ))}
                </div>
                <p className="text-[16px] text-text leading-relaxed mb-4">"{t.quote}"</p>
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-accent/20 flex items-center justify-center">
                    <span className="text-[12px] font-[700] text-accent uppercase">{t.author.charAt(0)}</span>
                  </div>
                  <p className="text-[14px] font-[500] text-text-2">{t.author}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ App coming soon ═════════════════════════════════════════════════════ */}
      <section className="border-t border-border">
        <div className="max-w-5xl mx-auto px-6 py-16 text-center">
          <p className="text-[13px] font-[500] text-accent uppercase tracking-widest mb-4">Mobile app</p>
          <h2 className="text-[30px] font-[600] text-text mb-3">App Coming Soon</h2>
          <p className="text-[17px] text-text-3 mb-8">Get the ArguFight app on your mobile device and debate on the go!</p>
          <div className="flex items-center justify-center gap-4">
            <div className="flex items-center gap-3 px-5 py-3 bg-surface border border-border rounded-xl">
              <div className="w-9 h-9 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center">
                <Smartphone size={18} className="text-accent" />
              </div>
              <div className="text-left">
                <p className="text-[11px] text-text-3">Coming soon on</p>
                <p className="text-[15px] font-[600] text-text">App Store</p>
              </div>
            </div>
            <div className="flex items-center gap-3 px-5 py-3 bg-surface border border-border rounded-xl">
              <div className="w-9 h-9 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center">
                <Play size={18} className="text-accent" />
              </div>
              <div className="text-left">
                <p className="text-[11px] text-text-3">Coming soon on</p>
                <p className="text-[15px] font-[600] text-text">Google Play</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══ CTA banner ══════════════════════════════════════════════════════════ */}
      <section className="border-t border-border bg-accent/5">
        <div className="max-w-5xl mx-auto px-6 py-20 text-center">
          <h2 className="text-[40px] font-[700] text-text tracking-[-1px] mb-4">
            {cta?.title ?? 'Ready to enter the arena?'}
          </h2>
          <p className="text-[19px] text-text-3 mb-8 max-w-md mx-auto">
            {cta?.content
              ? cta.content.replace(/<[^>]+>/g, '')
              : 'Create your account and issue your first challenge in under two minutes. No credit card required.'}
          </p>
          <div className="flex items-center justify-center gap-3">
            <Button variant="accent" size="lg" href="/signup">
              Get started free <ArrowRight size={15} />
            </Button>
            <Button variant="secondary" size="lg" href="/login">Sign in</Button>
          </div>
        </div>
      </section>

      {/* ══ Footer ══════════════════════════════════════════════════════════════ */}
      <footer className="border-t border-border bg-surface">
        <div className="max-w-5xl mx-auto px-6 py-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
            {/* Brand col */}
            <div>
              <Link href="/" className="flex items-center gap-2 mb-4">
                <div className="h-5 w-5 rounded bg-accent flex items-center justify-center">
                  <Swords size={10} className="text-[#0c0c0c]" />
                </div>
                <span className="text-sm font-[300] tracking-[2px] uppercase">
                  Argu<strong className="font-[700] text-accent">Fight</strong>
                </span>
              </Link>
              <p className="text-[14px] text-text-3 leading-relaxed">
                The world's first AI-judged debate platform.
              </p>
              <p className="text-[13px] text-text-3 mt-3">info@argufight.com</p>
              <div className="flex items-center gap-2 mt-3">
                {[
                  { label: 'X', href: '#' },
                  { label: 'IG', href: '#' },
                  { label: 'LI', href: '#' },
                ].map(s => (
                  <a
                    key={s.label}
                    href={s.href}
                    className="w-8 h-8 rounded border border-border flex items-center justify-center text-[11px] font-[600] text-text-3 hover:text-text hover:border-border-2 transition-colors"
                  >
                    {s.label}
                  </a>
                ))}
              </div>
            </div>

            {/* Link cols */}
            {FOOTER_COLS.map(col => (
              <div key={col.title}>
                <p className="text-[13px] font-[600] text-text uppercase tracking-wider mb-4">{col.title}</p>
                <ul className="space-y-2.5">
                  {col.links.map(l => (
                    <li key={l.href}>
                      <Link href={l.href} className="text-[14px] text-text-3 hover:text-text transition-colors">
                        {l.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="pt-6 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-[13px] text-text-3">&copy; {new Date().getFullYear()} ArguFight. All rights reserved.</p>
            <div className="flex items-center gap-4">
              <Link href="/terms"   className="text-[13px] text-text-3 hover:text-text transition-colors">Terms</Link>
              <Link href="/privacy" className="text-[13px] text-text-3 hover:text-text transition-colors">Privacy</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
