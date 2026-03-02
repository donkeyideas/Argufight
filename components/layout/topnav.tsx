'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Bell } from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { Dropdown, DropdownTrigger, DropdownMenu, DropdownItem, DropdownSeparator } from '@/components/ui/dropdown';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import { cn } from '@/lib/cn';

interface TopnavProps {
  user?: {
    id: string;
    username: string;
    avatarUrl?: string | null;
    coins: number;
    eloRating: number;
    isAdmin?: boolean;
  } | null;
  notificationCount?: number;
}

const pillNav = [
  { href: '/dashboard',        label: 'Home' },
  { href: '/trending',         label: 'Arena' },
  { href: '/leaderboard',      label: 'Rankings' },
  { href: '/tournaments',      label: 'Tournaments' },
  { href: '/debates/history',  label: 'History' },
];

export function Topnav({ user, notificationCount = 0 }: TopnavProps) {
  const pathname = usePathname();
  const router = useRouter();

  function isActive(href: string) {
    if (href === '/dashboard') return pathname === '/dashboard';
    return pathname.startsWith(href);
  }

  async function handleSignOut() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  const initials = user?.username
    ? user.username.slice(0, 2).toUpperCase()
    : 'U';

  return (
    <header className="sticky top-0 z-50 flex items-center h-[58px] px-8 border-b border-border bg-bg">
      {/* Logo */}
      <Link
        href="/dashboard"
        className="flex-shrink-0 text-[19px] font-[300] uppercase text-text mr-auto"
        style={{ letterSpacing: '4px' }}
      >
        Argu<strong className="font-[600] text-accent">fight</strong>
      </Link>

      {/* Pill nav — absolutely centered */}
      <nav
        className="flex gap-[2px] bg-surface border border-border rounded-[20px] p-[3px] absolute left-1/2 -translate-x-1/2"
        aria-label="Main navigation"
      >
        {pillNav.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'px-4 py-[5px] text-[15px] font-[500] rounded-[16px] transition-colors duration-150 whitespace-nowrap tracking-[0.3px]',
              isActive(item.href)
                ? 'bg-surface-3 text-text'
                : 'text-text-3 hover:text-text-2'
            )}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      {/* Right: coins + notifications + avatar */}
      <div className="flex items-center gap-3 ml-auto">
        {/* Coins */}
        {user && (
          <Link
            href="/upgrade"
            className="text-[14px] font-[500] text-[var(--amber)] tracking-[0.3px] border border-[rgba(255,207,77,0.2)] rounded-[20px] px-3 py-1 bg-[rgba(255,207,77,0.05)] hover:border-[rgba(255,207,77,0.4)] transition-colors"
          >
            {user.coins.toLocaleString()} coins
          </Link>
        )}

        {/* Theme toggle */}
        <ThemeToggle />

        {/* Notifications */}
        <button
          className="relative w-8 h-8 rounded-full border border-border flex items-center justify-center text-text-2 hover:border-border-2 transition-colors cursor-pointer"
          aria-label={`Notifications${notificationCount > 0 ? `, ${notificationCount} unread` : ''}`}
        >
          <Bell size={14} strokeWidth={1.5} />
          {notificationCount > 0 && (
            <span className="absolute top-[6px] right-[6px] w-1.5 h-1.5 bg-[var(--red)] rounded-full border-[1.5px] border-bg" />
          )}
        </button>

        {/* Profile dropdown */}
        {user && (
          <Dropdown>
            <DropdownTrigger>
              <button
                className="w-8 h-8 rounded-full border border-border-2 bg-surface-2 flex items-center justify-center text-[13px] font-[600] text-text-2 hover:border-accent hover:text-accent transition-colors cursor-pointer overflow-hidden"
                aria-label="Account menu"
              >
                {user.avatarUrl ? (
                  <Avatar src={user.avatarUrl} fallback={user.username} size="sm" />
                ) : (
                  initials
                )}
              </button>
            </DropdownTrigger>
            <DropdownMenu align="right">
              <div className="px-3 py-2 border-b border-border">
                <p className="text-xs font-[500] text-text">{user.username}</p>
                <p className="text-[12px] text-text-3 mt-0.5">{user.eloRating} ELO</p>
              </div>
              <DropdownItem icon={null}>
                <Link href="/profile" className="flex-1">Profile</Link>
              </DropdownItem>
              <DropdownItem icon={null}>
                <Link href="/messages" className="flex-1">Messages</Link>
              </DropdownItem>
              <DropdownItem icon={null}>
                <Link href="/settings" className="flex-1">Settings</Link>
              </DropdownItem>
              <DropdownItem icon={null}>
                <Link href="/settings/subscription" className="flex-1">Subscription</Link>
              </DropdownItem>
              {user.isAdmin && (
                <>
                  <DropdownSeparator />
                  <DropdownItem icon={null}>
                    <Link href="/admin" className="flex-1 text-accent">Admin Panel</Link>
                  </DropdownItem>
                </>
              )}
              <DropdownSeparator />
              <DropdownItem danger icon={null} onClick={handleSignOut}>
                Sign out
              </DropdownItem>
            </DropdownMenu>
          </Dropdown>
        )}
      </div>
    </header>
  );
}
