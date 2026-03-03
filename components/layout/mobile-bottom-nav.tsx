'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Swords, Trophy, Medal, Clock } from 'lucide-react';
import { cn } from '@/lib/cn';

const tabs = [
  { href: '/dashboard',       label: 'Home',        icon: Home },
  { href: '/trending',        label: 'Arena',       icon: Swords },
  { href: '/leaderboard',     label: 'Rankings',    icon: Trophy },
  { href: '/tournaments',     label: 'Tourneys',    icon: Medal },
  { href: '/debates/history', label: 'History',     icon: Clock },
];

export function MobileBottomNav() {
  const pathname = usePathname();

  function isActive(href: string) {
    if (href === '/dashboard') return pathname === '/dashboard';
    return pathname.startsWith(href);
  }

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 lg:hidden border-t border-border bg-bg/95 backdrop-blur-md"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      aria-label="Mobile navigation"
    >
      <div className="flex items-center justify-around h-14">
        {tabs.map((tab) => {
          const active = isActive(tab.href);
          const Icon = tab.icon;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                'flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors',
                active ? 'text-accent' : 'text-text-3'
              )}
            >
              <Icon size={20} strokeWidth={active ? 2.2 : 1.6} />
              <span className="text-[10px] font-[500] leading-none">{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
