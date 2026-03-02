'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { useToast } from '@/components/ui/toast';
import { AdminStatCard } from '@/components/features/admin/admin-stat-card';
import { Avatar } from '@/components/ui/avatar';
import { ArrowLeft, Send } from 'lucide-react';

type TicketStatus   = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
type TicketPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
type BadgeColor     = 'amber' | 'blue' | 'green' | 'muted' | 'red';

const statusColors:   Record<TicketStatus,   BadgeColor> = { OPEN: 'amber', IN_PROGRESS: 'blue', RESOLVED: 'green', CLOSED: 'muted' };
const priorityColors: Record<TicketPriority, BadgeColor> = { LOW: 'muted', MEDIUM: 'blue', HIGH: 'amber', URGENT: 'red' };

interface Ticket {
  id: string;
  subject: string;
  description: string;
  category: string | null;
  status: TicketStatus;
  priority: TicketPriority;
  createdAt: string;
  updatedAt: string;
  user: { id: string; username: string; email: string; avatarUrl: string | null };
  replies?: Array<{
    id: string;
    content: string;
    isInternal: boolean;
    createdAt: string;
    author: { id: string; username: string; avatarUrl: string | null; isAdmin: boolean };
  }>;
}

const selectCls = 'h-8 px-2 bg-surface-2 border border-border rounded-[var(--radius)] text-[16px] text-text focus:outline-none focus:border-border-2';

export default function AdminSupportPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [statusFilter,   setStatusFilter]   = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [replyContent,   setReplyContent]   = useState('');
  const [isInternal,     setIsInternal]     = useState(false);

  const { data: tickets = [], isLoading } = useQuery<Ticket[]>({
    queryKey: ['admin-support-tickets', statusFilter, priorityFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter   !== 'all') params.set('status',   statusFilter);
      if (priorityFilter !== 'all') params.set('priority', priorityFilter);
      const res = await fetch(`/api/admin/support/tickets?${params}`);
      if (!res.ok) return [];
      const data = await res.json();
      return data.tickets || [];
    },
    staleTime: 30_000,
  });

  const openCount     = tickets.filter(t => t.status === 'OPEN').length;
  const inProgressCount = tickets.filter(t => t.status === 'IN_PROGRESS').length;
  const resolvedCount = tickets.filter(t => t.status === 'RESOLVED').length;

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin-support-tickets'] });

  const viewTicketMutation = useMutation({
    mutationFn: async (ticketId: string) => {
      const res = await fetch(`/api/admin/support/tickets/${ticketId}`);
      if (!res.ok) throw new Error('Failed to load ticket');
      const data = await res.json();
      return data.ticket as Ticket;
    },
    onSuccess: (ticket) => setSelectedTicket(ticket),
    onError: () => toast({ type: 'error', title: 'Failed to load ticket' }),
  });

  const replyMutation = useMutation({
    mutationFn: async ({ ticketId, content, isInternal }: { ticketId: string; content: string; isInternal: boolean }) => {
      const res = await fetch(`/api/support/tickets/${ticketId}/replies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, isInternal }),
      });
      if (!res.ok) throw new Error('Failed to send reply');
      return res.json();
    },
    onSuccess: () => {
      toast({ type: 'success', title: 'Reply sent' });
      setReplyContent('');
      // Refresh ticket
      if (selectedTicket) viewTicketMutation.mutate(selectedTicket.id);
      invalidate();
    },
    onError: () => toast({ type: 'error', title: 'Failed to send reply' }),
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ ticketId, status }: { ticketId: string; status: TicketStatus }) => {
      const res = await fetch(`/api/admin/support/tickets/${ticketId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error('Failed to update status');
      return res.json();
    },
    onSuccess: (_, vars) => {
      toast({ type: 'success', title: 'Status updated' });
      if (selectedTicket) viewTicketMutation.mutate(selectedTicket.id);
      invalidate();
    },
    onError: () => toast({ type: 'error', title: 'Failed to update status' }),
  });

  const handleSendReply = () => {
    if (!replyContent.trim() || !selectedTicket) return;
    replyMutation.mutate({ ticketId: selectedTicket.id, content: replyContent, isInternal });
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        {selectedTicket ? (
          <div className="flex items-center gap-3">
            <button onClick={() => setSelectedTicket(null)} className="text-text-3 hover:text-text-2 transition-colors">
              <ArrowLeft size={18} />
            </button>
            <div>
              <h1 className="text-xl font-[600] text-text tracking-[-0.3px]">{selectedTicket.subject}</h1>
              <p className="text-[17px] text-text-3">Ticket #{selectedTicket.id.slice(0, 8)} — {selectedTicket.user.username}</p>
            </div>
          </div>
        ) : (
          <div>
            <h1 className="text-xl font-[600] text-text tracking-[-0.3px]">Support Tickets</h1>
            <p className="text-[17px] text-text-3 mt-0.5">{tickets.length} tickets matching filters</p>
          </div>
        )}

        {selectedTicket && (
          <div className="flex items-center gap-2">
            <select
              value={selectedTicket.status}
              onChange={e => updateStatusMutation.mutate({ ticketId: selectedTicket.id, status: e.target.value as TicketStatus })}
              className={selectCls}
              disabled={updateStatusMutation.isPending}
            >
              <option value="OPEN">Open</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="RESOLVED">Resolved</option>
              <option value="CLOSED">Closed</option>
            </select>
          </div>
        )}
      </div>

      {!selectedTicket ? (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <AdminStatCard label="Open"        value={openCount}     accent={openCount > 0} sub={openCount > 0 ? 'Awaiting response' : 'None'} />
            <AdminStatCard label="In Progress" value={inProgressCount} />
            <AdminStatCard label="Resolved"    value={resolvedCount.toLocaleString()} />
          </div>

          {/* Filters */}
          <div className="flex gap-2">
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className={selectCls}>
              <option value="all">All statuses</option>
              <option value="OPEN">Open</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="RESOLVED">Resolved</option>
              <option value="CLOSED">Closed</option>
            </select>
            <select value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)} className={selectCls}>
              <option value="all">All priorities</option>
              <option value="URGENT">Urgent</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </select>
          </div>

          {/* Ticket List */}
          <Card padding="none" className="overflow-hidden">
            <div className="grid grid-cols-[2fr_3fr_1fr_1fr_1fr_1fr] gap-4 px-4 py-2.5 border-b border-border bg-surface-2">
              {['User', 'Subject', 'Category', 'Priority', 'Status', 'Date'].map(h => (
                <p key={h} className="text-[14px] font-[500] text-text-3 uppercase tracking-wide">{h}</p>
              ))}
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center h-32">
                <div className="h-6 w-6 rounded-full border-2 border-border border-t-accent animate-spin" />
              </div>
            ) : tickets.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <p className="text-[17px] text-text-3">No support tickets found.</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {tickets.map(ticket => (
                  <div
                    key={ticket.id}
                    onClick={() => viewTicketMutation.mutate(ticket.id)}
                    className="grid grid-cols-[2fr_3fr_1fr_1fr_1fr_1fr] gap-4 px-4 py-3 items-center hover:bg-surface-2/50 transition-colors cursor-pointer"
                  >
                    <p className="text-[16px] text-text font-[450] truncate">{ticket.user?.username ?? '—'}</p>
                    <p className="text-[16px] text-text-2 line-clamp-1">
                      {ticket.subject?.length > 60 ? ticket.subject.slice(0, 60) + '…' : ticket.subject ?? '—'}
                    </p>
                    <div>
                      {ticket.category
                        ? <Badge color="muted" size="sm">{ticket.category}</Badge>
                        : <span className="text-[15px] text-text-3">—</span>}
                    </div>
                    <Badge color={priorityColors[ticket.priority] ?? 'muted'} size="sm">{ticket.priority}</Badge>
                    <Badge color={statusColors[ticket.status] ?? 'muted'} size="sm" dot>{ticket.status.replace('_', ' ')}</Badge>
                    <p className="text-[15px] text-text-3">
                      {new Date(ticket.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </>
      ) : (
        /* Ticket Detail View */
        <div className="space-y-4">
          {/* Ticket info */}
          <div className="grid grid-cols-1 md:grid-cols-[1fr_280px] gap-4">
            <div className="space-y-4">
              {/* Original message */}
              <Card padding="md">
                <div className="flex items-center gap-3 mb-3">
                  <Avatar src={selectedTicket.user.avatarUrl} alt={selectedTicket.user.username} fallback={selectedTicket.user.username} size="sm" />
                  <div>
                    <p className="text-[17px] font-[500] text-text">{selectedTicket.user.username}</p>
                    <p className="text-[15px] text-text-3">{selectedTicket.user.email}</p>
                  </div>
                  <p className="ml-auto text-[15px] text-text-3">
                    {new Date(selectedTicket.createdAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}
                  </p>
                </div>
                <div className="h-px bg-border mb-3" />
                <p className="text-[17px] text-text-2 leading-relaxed whitespace-pre-wrap">{selectedTicket.description}</p>
              </Card>

              {/* Replies */}
              {(selectedTicket.replies ?? []).map(reply => (
                <Card
                  key={reply.id}
                  padding="md"
                  className={reply.isInternal ? 'border-[var(--amber)]/30 bg-[rgba(255,207,77,0.05)]' : reply.author.isAdmin ? 'border-accent/20 bg-[rgba(212,240,80,0.03)]' : ''}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <Avatar src={reply.author.avatarUrl} alt={reply.author.username} fallback={reply.author.username} size="sm" />
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-[17px] font-[500] text-text">{reply.author.username}</p>
                        {reply.author.isAdmin && <Badge color="accent" size="sm">Admin</Badge>}
                        {reply.isInternal && <Badge color="amber" size="sm">Internal</Badge>}
                      </div>
                    </div>
                    <p className="ml-auto text-[15px] text-text-3">
                      {new Date(reply.createdAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}
                    </p>
                  </div>
                  <div className="h-px bg-border mb-3" />
                  <p className="text-[17px] text-text-2 leading-relaxed whitespace-pre-wrap">{reply.content}</p>
                </Card>
              ))}

              {/* Reply box */}
              <Card padding="md">
                <p className="text-[17px] font-[500] text-text mb-3">Send Reply</p>
                <textarea
                  value={replyContent}
                  onChange={e => setReplyContent(e.target.value)}
                  rows={5}
                  placeholder="Write your reply..."
                  className="w-full px-3 py-2.5 bg-surface-2 border border-border rounded-[var(--radius)] text-[17px] text-text placeholder:text-text-3 focus:outline-none focus:border-border-2 resize-y"
                />
                <div className="flex items-center justify-between mt-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isInternal}
                      onChange={e => setIsInternal(e.target.checked)}
                      className="w-3.5 h-3.5 rounded border-border"
                    />
                    <span className="text-[16px] text-text-2">Internal note (not visible to user)</span>
                  </label>
                  <Button
                    variant="accent"
                    size="sm"
                    onClick={handleSendReply}
                    disabled={!replyContent.trim()}
                    loading={replyMutation.isPending}
                  >
                    <Send size={12} className="mr-1.5" />
                    Send Reply
                  </Button>
                </div>
              </Card>
            </div>

            {/* Sidebar */}
            <div className="space-y-4">
              <Card padding="md">
                <h3 className="text-[17px] font-[500] text-text mb-3">Ticket Info</h3>
                <div className="space-y-2.5">
                  {[
                    { label: 'Status',   value: <Badge color={statusColors[selectedTicket.status]} size="sm" dot>{selectedTicket.status.replace('_', ' ')}</Badge> },
                    { label: 'Priority', value: <Badge color={priorityColors[selectedTicket.priority]} size="sm">{selectedTicket.priority}</Badge> },
                    { label: 'Category', value: <span className="text-[16px] text-text-2">{selectedTicket.category ?? '—'}</span> },
                    { label: 'Opened',   value: <span className="text-[16px] text-text-2">{new Date(selectedTicket.createdAt).toLocaleDateString()}</span> },
                    { label: 'Updated',  value: <span className="text-[16px] text-text-2">{new Date(selectedTicket.updatedAt).toLocaleDateString()}</span> },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex items-center justify-between gap-2">
                      <span className="text-[15px] text-text-3">{label}</span>
                      {value}
                    </div>
                  ))}
                </div>
              </Card>

              <Card padding="md">
                <h3 className="text-[17px] font-[500] text-text mb-3">Quick Actions</h3>
                <div className="space-y-2">
                  {(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'] as TicketStatus[]).map(status => (
                    <button
                      key={status}
                      onClick={() => updateStatusMutation.mutate({ ticketId: selectedTicket.id, status })}
                      disabled={selectedTicket.status === status || updateStatusMutation.isPending}
                      className={`w-full px-3 py-2 text-left text-[16px] rounded-[var(--radius)] transition-colors ${
                        selectedTicket.status === status
                          ? 'bg-accent/10 text-accent cursor-default'
                          : 'bg-surface-2 text-text-2 hover:bg-surface-3 hover:text-text'
                      }`}
                    >
                      Mark as {status.replace('_', ' ').toLowerCase()}
                    </button>
                  ))}
                </div>
              </Card>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
