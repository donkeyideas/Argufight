'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Avatar } from '@/components/ui/avatar';
import { NotificationBell } from '@/components/layout/notification-bell';
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
}

const pillNav = [
  { href: '/dashboard',        label: 'Home' },
  { href: '/trending',         label: 'Arena' },
  { href: '/leaderboard',      label: 'Rankings' },
  { href: '/tournaments',      label: 'Tournaments' },
  { href: '/debates/history',  label: 'History' },
];

export function Topnav({ user }: TopnavProps) {
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
    <header className="sticky top-0 z-50 flex items-center h-[52px] lg:h-[58px] px-4 lg:px-8 border-b border-border bg-bg">
      {/* Logo */}
      <Link
        href="/dashboard"
        className="flex-shrink-0 text-[17px] lg:text-[19px] font-[300] uppercase text-text mr-auto"
        style={{ letterSpacing: '4px' }}
      >
        Argu<strong className="font-[600] text-accent">fight</strong>
      </Link>

      {/* Pill nav — hidden on mobile, absolutely centered on desktop */}
      <nav
        className="hidden lg:flex gap-[2px] bg-surface border border-border rounded-[20px] p-[3px] absolute left-1/2 -translate-x-1/2"
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
      <div className="flex items-center gap-2 lg:gap-3 ml-auto">
        {/* Coins */}
        {user && (
          <Link
            href="/upgrade"
            className="text-[13px] lg:text-[14px] font-[600] text-[var(--amber)] tracking-[0.3px] hover:text-[var(--amber-2)] transition-colors"
          >
            {user.coins.toLocaleString('en-US')} coins
          </Link>
        )}

        {/* Theme toggle — hidden on mobile to save space */}
        <div className="hidden sm:block">
          <ThemeToggle />
        </div>

        {/* Notifications */}
        <NotificationBell />

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
