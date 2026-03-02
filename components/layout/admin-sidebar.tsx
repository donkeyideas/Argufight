'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Users, Swords, Shield, Award, Trophy, Gavel, BarChart2, DollarSign,
  Coins, FileText, Megaphone, Globe, Share2, Settings, Bell, HelpCircle,
  Bot, Radio, Store, Receipt, CreditCard, LayoutGrid, MessageSquare,
  AlertTriangle, Tag, ChevronLeft, ChevronRight, PenSquare,
} from 'lucide-react';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import { cn } from '@/lib/cn';
import { useState } from 'react';

const NAV_ITEMS = [
  { href: '/admin',                    label: 'Overview',           icon: LayoutGrid },
  { href: '/admin/users',              label: 'Users',              icon: Users },
  { href: '/admin/debates',            label: 'Debates',            icon: Swords },
  { href: '/admin/moderation',         label: 'Moderation',         icon: Shield },
  { href: '/admin/belts',              label: 'Belts',              icon: Award },
  { href: '/admin/tournaments',        label: 'Tournaments',        icon: Trophy },
  { href: '/admin/judges',             label: 'AI Judges',          icon: Gavel },
  { href: '/admin/analytics',          label: 'Analytics',          icon: BarChart2 },
  { href: '/admin/finances',           label: 'Finances',           icon: DollarSign },
  { href: '/admin/coins',              label: 'Coins',              icon: Coins },
  { href: '/admin/subscriptions',      label: 'Subscriptions',      icon: CreditCard },
  { href: '/admin/plans',              label: 'Plans',              icon: LayoutGrid },
  { href: '/admin/appeals',            label: 'Appeals',            icon: AlertTriangle },
  { href: '/admin/categories',         label: 'Categories',         icon: Tag },
  { href: '/admin/blog',               label: 'Blog',               icon: FileText },
  { href: '/admin/marketing',          label: 'Marketing',          icon: Megaphone },
  { href: '/admin/content',            label: 'Content Manager',    icon: PenSquare },
  { href: '/admin/seo',                label: 'SEO',                icon: Globe },
  { href: '/admin/social-posts',       label: 'Social Posts',       icon: Share2 },
  { href: '/admin/notifications',      label: 'Notifications',      icon: Bell },
  { href: '/admin/support',            label: 'Support',            icon: HelpCircle },
  { href: '/admin/llm-models',         label: 'LLM Models',         icon: Bot },
  { href: '/admin/settings',           label: 'Settings',           icon: Settings },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className={cn(
      'h-screen border-r border-border flex flex-col flex-shrink-0 transition-all duration-200 bg-bg',
      collapsed ? 'w-14' : 'w-52'
    )}>
      {/* Brand */}
      <div className={cn(
        'h-12 flex items-center border-b border-border flex-shrink-0',
        collapsed ? 'justify-center px-0' : 'px-4 gap-2'
      )}>
        <div className="h-5 w-5 rounded bg-accent flex items-center justify-center flex-shrink-0">
          <Shield size={10} className="text-accent-fg" />
        </div>
        {!collapsed && (
          <span className="text-[14px] font-[500] text-text-3 uppercase tracking-widest">
            Admin
          </span>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-2 scrollbar-thin">
        {NAV_ITEMS.map((item) => {
          const isActive = item.href === '/admin'
            ? pathname === '/admin'
            : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className={cn(
                'flex items-center gap-2.5 h-9 transition-colors text-[17px]',
                collapsed ? 'justify-center px-0' : 'px-4',
                isActive
                  ? 'text-accent bg-[rgba(212,240,80,0.06)]'
                  : 'text-text-3 hover:text-text-2 hover:bg-surface-2'
              )}
            >
              <Icon size={15} className="flex-shrink-0" />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Theme toggle + collapse */}
      <div className="border-t border-border flex items-center">
        <ThemeToggle
          className={cn('flex-1 h-10 rounded-none justify-center', collapsed && 'px-0')}
          showLabel={!collapsed}
        />
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="h-10 w-10 flex-shrink-0 flex items-center justify-center border-l border-border text-text-3 hover:text-text-2 transition-colors"
        >
          {collapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
        </button>
      </div>
    </div>
  );
}
