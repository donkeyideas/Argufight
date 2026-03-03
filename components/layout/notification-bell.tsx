'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { Bell, Check, CheckCheck } from 'lucide-react';
import { cn } from '@/lib/cn';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  debateId: string | null;
  read: boolean;
  createdAt: string;
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function NotificationBell() {
  const [open, setOpen]                     = useState(false);
  const [notifications, setNotifications]   = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount]       = useState(0);
  const [markingAll, setMarkingAll]         = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications?limit=20');
      if (!res.ok) return;
      const data: Notification[] = await res.json();
      setNotifications(data);
      setUnreadCount(data.filter((n) => !n.read).length);
    } catch {}
  }, []);

  // Fetch on mount + every 30s
  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60_000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // Close on outside click / Escape
  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  async function markRead(id: string) {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
    setUnreadCount((c) => Math.max(0, c - 1));
    await fetch(`/api/notifications/${id}/read`, { method: 'POST' });
  }

  async function markAllRead() {
    if (markingAll || unreadCount === 0) return;
    setMarkingAll(true);
    try {
      await fetch('/api/notifications/read-all', { method: 'POST' });
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } finally {
      setMarkingAll(false);
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative w-8 h-8 rounded-full border border-border flex items-center justify-center text-text-2 hover:border-border-2 transition-colors cursor-pointer"
        aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
      >
        <Bell size={14} strokeWidth={1.5} />
        {unreadCount > 0 && (
          <span className="absolute top-[5px] right-[5px] w-2 h-2 bg-[var(--red)] rounded-full border-[1.5px] border-bg" />
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 z-50 w-80 bg-surface border border-border rounded-[var(--radius)] shadow-xl overflow-hidden animate-fade-in">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <p className="text-xs font-[500] text-text">Notifications</p>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                disabled={markingAll}
                className="flex items-center gap-1.5 text-[12px] text-text-3 hover:text-text transition-colors cursor-pointer disabled:opacity-50"
              >
                <CheckCheck size={12} />
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-[380px] overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="text-[13px] text-text-3 text-center py-8">No notifications yet</p>
            ) : (
              notifications.map((n) => {
                const inner = (
                  <div
                    className={cn(
                      'flex gap-3 px-4 py-3 border-b border-border last:border-0 transition-colors',
                      n.read ? 'bg-transparent hover:bg-surface-2' : 'bg-[rgba(212,240,80,0.04)] hover:bg-[rgba(212,240,80,0.07)]'
                    )}
                  >
                    {/* Unread dot */}
                    <div className="flex-shrink-0 mt-1.5">
                      <span className={cn(
                        'block w-1.5 h-1.5 rounded-full',
                        n.read ? 'bg-transparent' : 'bg-accent'
                      )} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cn('text-xs leading-snug', n.read ? 'text-text-2' : 'text-text font-[450]')}>
                        {n.title}
                      </p>
                      <p className="text-[12px] text-text-3 mt-0.5 leading-snug line-clamp-2">{n.message}</p>
                      <p className="text-[11px] text-text-3 mt-1">{timeAgo(n.createdAt)}</p>
                    </div>
                    {!n.read && (
                      <button
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); markRead(n.id); }}
                        className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full hover:bg-surface-3 text-text-3 hover:text-text transition-colors cursor-pointer mt-0.5"
                        title="Mark as read"
                      >
                        <Check size={11} />
                      </button>
                    )}
                  </div>
                );

                return n.debateId ? (
                  <Link
                    key={n.id}
                    href={`/debates/${n.debateId}`}
                    onClick={() => { if (!n.read) markRead(n.id); setOpen(false); }}
                    className="block"
                  >
                    {inner}
                  </Link>
                ) : (
                  <div key={n.id} onClick={() => { if (!n.read) markRead(n.id); }}>
                    {inner}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
