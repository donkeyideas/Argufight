import Link from 'next/link';
import { Swords } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import { Providers } from '@/lib/providers';

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <Providers>
      <div className="min-h-screen flex flex-col bg-bg">
        {/* Header */}
        <header className="h-14 border-b border-border flex items-center px-6 sticky top-0 z-40 bg-bg">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="h-6 w-6 rounded bg-accent flex items-center justify-center">
              <Swords size={12} className="text-accent-fg" />
            </div>
            <span className="text-sm font-[300] tracking-[3px] uppercase">
              Argu<strong className="font-[600] text-accent">Fight</strong>
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-1 ml-8" aria-label="Site navigation">
            {[
              { href: '/blog',        label: 'Blog' },
              { href: '/about',       label: 'About' },
              { href: '/leaderboard', label: 'Leaderboard' },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-xs text-text-3 hover:text-text-2 transition-colors px-3 py-2 rounded-[var(--radius-sm)] hover:bg-surface-2"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2 ml-auto">
            <ThemeToggle />
            <Button variant="ghost" size="sm" href="/login">
              Sign in
            </Button>
            <Button variant="accent" size="sm" href="/signup">
              Get started
            </Button>
          </div>
        </header>

        {/* Page content */}
        <main id="main-content" className="flex-1">
          {children}
        </main>

        {/* Footer */}
        <footer className="border-t border-border py-8 px-6">
          <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs text-text-3">
              &copy; {new Date().getFullYear()} ArguFight. All rights reserved.
            </p>
            <div className="flex items-center gap-4">
              {[
                { href: '/about',   label: 'About' },
                { href: '/privacy', label: 'Privacy' },
                { href: '/terms',   label: 'Terms' },
              ].map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="text-xs text-text-3 hover:text-text-2 transition-colors"
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        </footer>
      </div>
    </Providers>
  );
}
