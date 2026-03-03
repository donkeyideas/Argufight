'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
import { EmptyState } from '@/components/ui/empty-state';
import { useToast } from '@/components/ui/toast';
import { Send, MessageSquare, Plus, X, Search } from 'lucide-react';
import { cn } from '@/lib/cn';

/* eslint-disable @typescript-eslint/no-explicit-any */
interface MessagesUIProps {
  conversations: any[];
  currentUserId: string;
  initialConvId?: string | null;
}

// ── New Conversation modal ─────────────────────────────────────────────────
function NewConversationModal({
  onClose,
  onConversationCreated,
}: {
  onClose: () => void;
  onConversationCreated: (conv: any) => void;
}) {
  const [query, setQuery]         = useState('');
  const [results, setResults]     = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [creating, setCreating]   = useState<string | null>(null);
  const { error } = useToast();

  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/users/search?q=${encodeURIComponent(query.trim())}&limit=8`);
        if (res.ok) {
          const data = await res.json();
          setResults(data.users ?? []);
        }
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  async function startConversation(userId: string) {
    setCreating(userId);
    try {
      const res = await fetch('/api/messages/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ otherUserId: userId }),
      });
      if (!res.ok) { error('Failed to start conversation'); return; }
      const data = await res.json();
      onConversationCreated(data.conversation);
      onClose();
    } finally {
      setCreating(null);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-[rgba(0,0,0,0.7)] backdrop-blur-[2px]"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-surface border border-border rounded-[var(--radius)] w-full max-w-sm mx-4 shadow-2xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <p className="text-[15px] font-[500] text-text">New message</p>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full border border-border flex items-center justify-center text-text-3 hover:text-text hover:border-border-2 transition-colors cursor-pointer"
          >
            <X size={13} />
          </button>
        </div>
        <div className="p-4">
          <div className="relative mb-3">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-3 pointer-events-none" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by username..."
              className="pl-9"
              autoFocus
            />
          </div>
          <div className="space-y-1 max-h-60 overflow-y-auto">
            {searching && (
              <p className="text-[13px] text-text-3 text-center py-3">Searching...</p>
            )}
            {!searching && query && results.length === 0 && (
              <p className="text-[13px] text-text-3 text-center py-3">No users found</p>
            )}
            {results.map((user) => (
              <button
                key={user.id}
                onClick={() => startConversation(user.id)}
                disabled={creating === user.id}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-[var(--radius)] hover:bg-surface-2 transition-colors text-left cursor-pointer disabled:opacity-50"
              >
                <Avatar src={user.avatarUrl} fallback={user.username} size="sm" />
                <span className="text-[15px] text-text">{user.username}</span>
                {creating === user.id && (
                  <span className="ml-auto text-[13px] text-text-3">Starting...</span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────
export function MessagesUI({ conversations: initialConversations, currentUserId, initialConvId }: MessagesUIProps) {
  const router = useRouter();
  const [conversations, setConversations] = useState<any[]>(initialConversations);
  const [activeConvId, setActiveConvId]   = useState<string | null>(
    initialConvId ?? initialConversations[0]?.id ?? null
  );
  const [messages, setMessages]           = useState<any[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [message, setMessage]             = useState('');
  const [sending, setSending]             = useState(false);
  const [showNewModal, setShowNewModal]   = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const { error } = useToast();

  const activeConv = conversations.find((c) => c.id === activeConvId);
  const otherUser  = activeConv
    ? activeConv.user1Id === currentUserId ? activeConv.user2 : activeConv.user1
    : null;

  useEffect(() => {
    if (!activeConvId) return;
    setLoadingMessages(true);
    fetch(`/api/messages/conversations/${activeConvId}/messages`)
      .then((r) => r.json())
      .then((data) => setMessages(data.messages ?? []))
      .catch(() => error('Failed to load messages'))
      .finally(() => setLoadingMessages(false));
  }, [activeConvId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim() || !activeConvId || sending) return;
    setSending(true);
    try {
      const res = await fetch(`/api/messages/conversations/${activeConvId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: message }),
      });
      if (!res.ok) { error('Failed to send message'); return; }
      const data = await res.json();
      setMessages((prev) => [...prev, data.message]);
      setMessage('');
    } finally {
      setSending(false);
    }
  }

  function handleConversationCreated(conv: any) {
    setConversations((prev) => {
      const exists = prev.find((c) => c.id === conv.id);
      return exists ? prev : [conv, ...prev];
    });
    setActiveConvId(conv.id);
    router.replace(`/messages?conv=${conv.id}`, { scroll: false });
  }

  return (
    <>
      {showNewModal && (
        <NewConversationModal
          onClose={() => setShowNewModal(false)}
          onConversationCreated={handleConversationCreated}
        />
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* Conversation list */}
        <div className="w-64 border-r border-border flex-shrink-0 flex flex-col">
          <div className="p-3 border-b border-border flex-shrink-0">
            <button
              onClick={() => setShowNewModal(true)}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-[var(--radius)] border border-dashed border-border-2 hover:border-accent hover:bg-[rgba(212,240,80,0.03)] transition-colors text-text-3 hover:text-accent cursor-pointer"
            >
              <Plus size={14} />
              <span className="text-[14px] font-[500]">New message</span>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {conversations.length === 0 ? (
              <p className="text-[13px] text-text-3 text-center p-4">No conversations yet</p>
            ) : (
              conversations.map((conv) => {
                const other    = conv.user1Id === currentUserId ? conv.user2 : conv.user1;
                const isActive = conv.id === activeConvId;
                const lastReadAt = conv.user1Id === currentUserId
                  ? conv.user1LastReadAt
                  : conv.user2LastReadAt;
                const hasUnread = conv.lastMessageAt && lastReadAt
                  ? new Date(conv.lastMessageAt) > new Date(lastReadAt)
                  : !!conv.lastMessageAt && !lastReadAt;

                return (
                  <button
                    key={conv.id}
                    onClick={() => setActiveConvId(conv.id)}
                    className={cn(
                      'w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-surface-2 transition-colors border-b border-border',
                      isActive && 'bg-surface-2'
                    )}
                  >
                    <div className="relative flex-shrink-0">
                      <Avatar src={other?.avatarUrl} fallback={other?.username ?? '?'} size="sm" />
                      {hasUnread && (
                        <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-accent" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cn(
                        'text-xs leading-tight truncate',
                        hasUnread ? 'font-[500] text-text' : 'text-text-2'
                      )}>
                        {other?.username ?? 'Unknown'}
                      </p>
                      {conv.lastMessageAt && (
                        <p className="text-[12px] text-text-3 mt-0.5" suppressHydrationWarning>
                          {new Date(conv.lastMessageAt).toLocaleDateString('en-US', {
                            month: 'short', day: 'numeric',
                          })}
                        </p>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Message thread */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {!activeConvId ? (
            <div className="flex-1 flex items-center justify-center">
              <EmptyState
                icon={<MessageSquare size={28} />}
                title="Select a conversation"
                description='Click "New message" to start chatting with someone.'
              />
            </div>
          ) : (
            <>
              {otherUser && (
                <div className="h-12 border-b border-border flex items-center gap-3 px-4 flex-shrink-0">
                  <Avatar src={otherUser.avatarUrl} fallback={otherUser.username} size="sm" />
                  <p className="text-sm font-[450] text-text">{otherUser.username}</p>
                </div>
              )}

              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
                {loadingMessages ? (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-xs text-text-3">Loading...</p>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-xs text-text-3">No messages yet. Say hello.</p>
                  </div>
                ) : (
                  messages.map((msg: any) => {
                    const isMe = msg.senderId === currentUserId;
                    return (
                      <div key={msg.id} className={cn('flex gap-2', isMe ? 'flex-row-reverse' : 'flex-row')}>
                        <div className={cn('max-w-[70%]', isMe && 'items-end flex flex-col')}>
                          <div className={cn(
                            'px-3.5 py-2.5 rounded-[var(--radius)] text-xs leading-relaxed',
                            isMe
                              ? 'bg-accent text-accent-fg rounded-tr-[var(--radius-sm)]'
                              : 'bg-surface-2 text-text rounded-tl-[var(--radius-sm)]'
                          )}>
                            {msg.content}
                          </div>
                          <p className="text-[12px] text-text-3 mt-1" suppressHydrationWarning>
                            {new Date(msg.createdAt).toLocaleTimeString('en-US', {
                              hour: '2-digit', minute: '2-digit',
                            })}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={bottomRef} />
              </div>

              <form
                onSubmit={handleSend}
                className="border-t border-border p-4 flex-shrink-0 flex flex-col gap-2"
              >
                <Textarea
                  placeholder="Write a message..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={3}
                  className="w-full min-h-[80px] max-h-[160px] resize-none"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend(e as any);
                    }
                  }}
                />
                <Button
                  variant="accent"
                  size="md"
                  type="submit"
                  loading={sending}
                  disabled={!message.trim()}
                  className="self-end"
                >
                  <Send size={13} />
                </Button>
              </form>
            </>
          )}
        </div>
      </div>
    </>
  );
}
