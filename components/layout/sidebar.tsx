'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Swords,
  Trophy,
  Users,
  MessageSquare,
  User,
  Settings,
  TrendingUp,
  BookMarked,
  ChevronLeft,
  ChevronRight,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { ThemeToggle } from './theme-toggle';

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  exact?: boolean;
  badge?: string | number;
}

const navItems: NavItem[] = [
  { href: '/dashboard',      label: 'Dashboard',   icon: <LayoutDashboard size={16} />, exact: true },
  { href: '/leaderboard',    label: 'Leaderboard', icon: <Trophy size={16} /> },
  { href: '/tournaments',    label: 'Tournaments', icon: <Zap size={16} /> },
  { href: '/trending',       label: 'Trending',    icon: <TrendingUp size={16} /> },
  { href: '/debates/saved',  label: 'Saved',       icon: <BookMarked size={16} /> },
  { href: '/messages',       label: 'Messages',    icon: <MessageSquare size={16} /> },
];

const bottomItems: NavItem[] = [
  { href: '/profile',  label: 'Profile',  icon: <User size={16} /> },
  { href: '/settings', label: 'Settings', icon: <Settings size={16} /> },
];

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();

  function isActive(item: NavItem) {
    if (item.exact) return pathname === item.href;
    return pathname.startsWith(item.href);
  }

  return (
    <aside
      className={cn(
        'flex flex-col h-screen sticky top-0',
        'bg-surface border-r border-border',
        'transition-all duration-200 ease-in-out flex-shrink-0',
        collapsed ? 'w-14' : 'w-52'
      )}
    >
      {/* Logo */}
      <div
        className={cn(
          'flex items-center h-14 border-b border-border px-3 flex-shrink-0',
          collapsed ? 'justify-center' : 'px-4 gap-2'
        )}
      >
        <div className="h-6 w-6 rounded bg-accent flex items-center justify-center flex-shrink-0">
          <Swords size={12} className="text-accent-fg" />
        </div>
        {!collapsed && (
          <span className="text-sm font-[300] tracking-[3px] uppercase text-text">
            Argu<strong className="font-[600] text-accent">Fight</strong>
          </span>
        )}
      </div>

      {/* Main nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2" aria-label="Main navigation">
        <ul className="space-y-0.5">
          {navItems.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className={cn(
                  'flex items-center rounded-[var(--radius-sm)]',
                  'transition-colors duration-100 group relative',
                  collapsed ? 'h-9 w-9 justify-center mx-auto' : 'h-9 px-3 gap-3',
                  isActive(item)
                    ? 'bg-surface-3 text-text'
                    : 'text-text-3 hover:bg-surface-2 hover:text-text-2'
                )}
                aria-current={isActive(item) ? 'page' : undefined}
              >
                <span className="flex-shrink-0">{item.icon}</span>
                {!collapsed && (
                  <span className="text-xs font-[450] leading-none flex-1">{item.label}</span>
                )}
                {!collapsed && item.badge && (
                  <span className="text-[12px] font-medium bg-accent text-accent-fg px-1.5 py-0.5 rounded-full leading-none">
                    {item.badge}
                  </span>
                )}
                {/* Tooltip when collapsed */}
                {collapsed && (
                  <div className="absolute left-full ml-2 px-2 py-1 bg-surface-3 border border-border rounded text-xs text-text whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50">
                    {item.label}
                  </div>
                )}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {/* Bottom nav */}
      <div className="border-t border-border py-3 px-2 space-y-0.5">
        {bottomItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex items-center rounded-[var(--radius-sm)]',
              'transition-colors duration-100',
              collapsed ? 'h-9 w-9 justify-center mx-auto' : 'h-9 px-3 gap-3',
              isActive(item)
                ? 'bg-surface-3 text-text'
                : 'text-text-3 hover:bg-surface-2 hover:text-text-2'
            )}
          >
            <span className="flex-shrink-0">{item.icon}</span>
            {!collapsed && (
              <span className="text-xs font-[450] leading-none">{item.label}</span>
            )}
          </Link>
        ))}

        {/* Theme toggle */}
        <div className={cn('pt-1', collapsed ? 'flex justify-center' : '')}>
          <ThemeToggle showLabel={!collapsed} />
        </div>

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={cn(
            'flex items-center text-text-3 hover:text-text-2 transition-colors',
            'rounded-[var(--radius-sm)] hover:bg-surface-2',
            'cursor-pointer mt-1',
            collapsed ? 'h-9 w-9 justify-center mx-auto' : 'h-9 px-3 gap-3 w-full'
          )}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <span className="flex-shrink-0">
            {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </span>
          {!collapsed && <span className="text-xs font-[450]">Collapse</span>}
        </button>
      </div>
    </aside>
  );
}
