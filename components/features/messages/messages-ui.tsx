'use client';

import { useState, useRef, useEffect } from 'react';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/input';
import { EmptyState } from '@/components/ui/empty-state';
import { useToast } from '@/components/ui/toast';
import { Send, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/cn';

/* eslint-disable @typescript-eslint/no-explicit-any */
interface MessagesUIProps {
  conversations: any[];
  currentUserId: string;
}

export function MessagesUI({ conversations, currentUserId }: MessagesUIProps) {
  const [activeConvId, setActiveConvId] = useState<string | null>(
    conversations[0]?.id ?? null
  );
  const [messages, setMessages] = useState<any[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const { error } = useToast();

  const activeConv = conversations.find((c) => c.id === activeConvId);
  const otherUser = activeConv
    ? activeConv.user1Id === currentUserId
      ? activeConv.user2
      : activeConv.user1
    : null;

  useEffect(() => {
    if (!activeConvId) return;
    setLoadingMessages(true);
    fetch(`/api/messages/${activeConvId}`)
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
      const res = await fetch(`/api/messages/${activeConvId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: message }),
      });
      if (!res.ok) {
        error('Failed to send message');
        return;
      }
      const data = await res.json();
      setMessages((prev) => [...prev, data.message]);
      setMessage('');
    } finally {
      setSending(false);
    }
  }

  if (conversations.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <EmptyState
          icon={<MessageSquare size={28} />}
          title="No messages yet"
          description="Start a conversation from someone's profile."
        />
      </div>
    );
  }

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Conversation list */}
      <div className="w-64 border-r border-border flex-shrink-0 overflow-y-auto">
        {conversations.map((conv) => {
          const other = conv.user1Id === currentUserId ? conv.user2 : conv.user1;
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
                  <p className="text-[12px] text-text-3 mt-0.5">
                    {new Date(conv.lastMessageAt).toLocaleDateString('en-US', {
                      month: 'short', day: 'numeric',
                    })}
                  </p>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Message thread */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Thread header */}
        {otherUser && (
          <div className="h-12 border-b border-border flex items-center gap-3 px-4 flex-shrink-0">
            <Avatar src={otherUser.avatarUrl} fallback={otherUser.username} size="sm" />
            <p className="text-sm font-[450] text-text">{otherUser.username}</p>
          </div>
        )}

        {/* Messages */}
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
                <div
                  key={msg.id}
                  className={cn('flex gap-2', isMe ? 'flex-row-reverse' : 'flex-row')}
                >
                  <div className={cn('max-w-[70%]', isMe && 'items-end flex flex-col')}>
                    <div className={cn(
                      'px-3.5 py-2.5 rounded-[var(--radius)] text-xs leading-relaxed',
                      isMe
                        ? 'bg-accent text-accent-fg rounded-tr-[var(--radius-sm)]'
                        : 'bg-surface-2 text-text rounded-tl-[var(--radius-sm)]'
                    )}>
                      {msg.content}
                    </div>
                    <p className="text-[12px] text-text-3 mt-1">
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

        {/* Compose */}
        <form
          onSubmit={handleSend}
          className="border-t border-border p-4 flex-shrink-0 flex gap-2"
        >
          <Textarea
            placeholder="Write a message..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="flex-1 min-h-[44px] max-h-[120px] resize-none"
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
      </div>
    </div>
  );
}
