'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/avatar';
import { Modal } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';
import { AdminStatCard } from '@/components/features/admin/admin-stat-card';
import { Search, UserPlus, Trash2 } from 'lucide-react';

interface UserData {
  id: string;
  username: string;
  email: string;
  avatarUrl: string | null;
  eloRating: number;
  totalDebates: number;
  debatesWon: number;
  debatesLost: number;
  isAdmin: boolean;
  isBanned: boolean;
  bannedUntil: string | null;
  isAI: boolean;
  employeeRole: string | null;
  coins?: number;
  createdAt: string;
  subscription?: { tier: string; status: string } | null;
  isCreator?: boolean;
}

const labelCls = 'block text-[16px] font-[500] text-text-2 mb-1.5';

export default function AdminUsersPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'all' | 'ai' | 'employees'>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Modals
  const [suspendUser, setSuspendUser] = useState<UserData | null>(null);
  const [deleteUser, setDeleteUser] = useState<UserData | null>(null);
  const [suspendDays, setSuspendDays] = useState('7');
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  const { data: allUsers = [], isLoading } = useQuery<UserData[]>({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const res = await fetch('/api/admin/users');
      if (!res.ok) throw new Error('Failed to load users');
      const data = await res.json();
      return data.users || [];
    },
    staleTime: 60_000,
  });

  const aiUsers       = useMemo(() => allUsers.filter(u => u.isAI), [allUsers]);
  const employees     = useMemo(() => allUsers.filter(u => !u.isAI && (u.isAdmin || u.employeeRole)), [allUsers]);
  const regularUsers  = useMemo(() => allUsers.filter(u => !u.isAI && !u.isAdmin && !u.employeeRole), [allUsers]);

  const displayList = useMemo(() => {
    const base = tab === 'ai' ? aiUsers : tab === 'employees' ? employees : [...employees, ...regularUsers, ...aiUsers];
    if (!search.trim()) return base;
    const q = search.toLowerCase();
    return base.filter(u =>
      u.username?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q)
    );
  }, [tab, search, aiUsers, employees, regularUsers]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-users'] });
  };

  const actionMutation = useMutation({
    mutationFn: async ({ userId, type, days }: { userId: string; type: 'delete' | 'suspend' | 'unsuspend'; days?: number }) => {
      if (type === 'delete') {
        const res = await fetch(`/api/admin/users/${userId}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Delete failed');
      } else {
        const res = await fetch(`/api/admin/users/${userId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ suspendDays: type === 'suspend' ? days : 0 }),
        });
        if (!res.ok) throw new Error('Action failed');
      }
    },
    onSuccess: (_, vars) => {
      const msg = vars.type === 'delete' ? 'User deleted' : vars.type === 'suspend' ? 'User suspended' : 'User unsuspended';
      toast({ type: 'success', title: msg });
      setSuspendUser(null);
      setDeleteUser(null);
      invalidate();
    },
    onError: () => toast({ type: 'error', title: 'Action failed', description: 'Please try again' }),
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (userIds: string[]) => {
      const res = await fetch('/api/admin/users/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userIds }),
      });
      if (!res.ok) throw new Error('Bulk delete failed');
    },
    onSuccess: () => {
      toast({ type: 'success', title: 'Users deleted', description: `${selectedIds.size} user(s) removed` });
      setSelectedIds(new Set());
      setBulkDeleteOpen(false);
      invalidate();
    },
    onError: () => toast({ type: 'error', title: 'Bulk delete failed' }),
  });

  const toggleCreatorMutation = useMutation({
    mutationFn: async ({ userId, enabled }: { userId: string; enabled: boolean }) => {
      const res = await fetch(`/api/admin/users/${userId}/creator/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      });
      if (!res.ok) throw new Error('Failed to toggle creator');
    },
    onSuccess: () => { toast({ type: 'success', title: 'Creator mode updated' }); invalidate(); },
    onError: () => toast({ type: 'error', title: 'Failed to toggle creator mode' }),
  });

  const handleSuspend = (user: UserData) => {
    const isSuspended = user.bannedUntil && new Date(user.bannedUntil) > new Date();
    if (isSuspended) {
      actionMutation.mutate({ userId: user.id, type: 'unsuspend' });
    } else {
      setSuspendUser(user);
      setSuspendDays('7');
    }
  };

  const confirmSuspend = () => {
    if (!suspendUser) return;
    const days = parseInt(suspendDays);
    if (isNaN(days) || days < 1) {
      toast({ type: 'error', title: 'Enter a valid number of days' });
      return;
    }
    actionMutation.mutate({ userId: suspendUser.id, type: 'suspend', days });
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    const regularIds = regularUsers.map(u => u.id);
    setSelectedIds(prev =>
      prev.size === regularIds.length ? new Set() : new Set(regularIds)
    );
  };

  const TABS = [
    { key: 'all' as const,       label: `All (${allUsers.length})` },
    { key: 'employees' as const, label: `Employees (${employees.length})` },
    { key: 'ai' as const,        label: `AI Users (${aiUsers.length})` },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-[600] text-text tracking-[-0.3px]">User Management</h1>
          <p className="text-[17px] text-text-3 mt-0.5">Manage platform users and employees</p>
        </div>
        <Button variant="accent" size="sm">
          <UserPlus size={14} className="mr-1.5" />
          Add Employee
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <AdminStatCard label="Total users"    value={allUsers.filter(u => !u.isAI).length.toLocaleString()} />
        <AdminStatCard label="AI users"       value={aiUsers.length} />
        <AdminStatCard label="Suspended"      value={allUsers.filter(u => u.bannedUntil && new Date(u.bannedUntil) > new Date()).length} accent={allUsers.some(u => u.bannedUntil && new Date(u.bannedUntil) > new Date())} />
        <AdminStatCard label="Employees"      value={employees.length} />
      </div>

      {/* Search + Tabs + Bulk */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        {/* Tabs */}
        <div className="flex gap-1 bg-surface-2 p-1 rounded-[var(--radius)] border border-border">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-3 py-1.5 rounded-[6px] text-[16px] font-[500] transition-colors ${
                tab === t.key ? 'bg-surface text-text border border-border' : 'text-text-3 hover:text-text-2'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-3" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by username or email..."
            className="w-full pl-8 pr-3 h-8 bg-surface border border-border rounded-[var(--radius)] text-[16px] text-text placeholder:text-text-3 focus:outline-none focus:border-border-2"
          />
        </div>

        {/* Bulk delete */}
        {selectedIds.size > 0 && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setBulkDeleteOpen(true)}
            className="text-[var(--red)] border-[var(--red)]/30 hover:border-[var(--red)]/60"
          >
            <Trash2 size={13} className="mr-1.5" />
            Delete ({selectedIds.size})
          </Button>
        )}
      </div>

      {/* Table */}
      <Card padding="none" className="overflow-hidden">
        <div className="grid grid-cols-[auto_2fr_2fr_1fr_1fr_1fr_1fr_auto] gap-3 px-4 py-2.5 border-b border-border bg-surface-2">
          <div className="w-4" />
          {['User', 'Email', 'ELO', 'W/L', 'Joined', 'Status', 'Actions'].map(h => (
            <p key={h} className="text-[14px] font-[500] text-text-3 uppercase tracking-wide">{h}</p>
          ))}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-48">
            <div className="h-6 w-6 rounded-full border-2 border-border border-t-accent animate-spin" />
          </div>
        ) : displayList.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <p className="text-[17px] text-text-3">No users found.</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {/* Select all row (regular users tab only) */}
            {tab === 'all' && regularUsers.length > 0 && !search && (
              <div className="px-4 py-2 bg-surface-2/50 flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={selectedIds.size === regularUsers.length && regularUsers.length > 0}
                  onChange={selectAll}
                  className="w-3.5 h-3.5 rounded border-border"
                />
                <span className="text-[15px] text-text-3">Select all regular users ({regularUsers.length})</span>
              </div>
            )}

            {displayList.map(user => {
              const isSuspended = user.bannedUntil && new Date(user.bannedUntil) > new Date();
              return (
                <div
                  key={user.id}
                  className="grid grid-cols-[auto_2fr_2fr_1fr_1fr_1fr_1fr_auto] gap-3 px-4 py-3 items-center hover:bg-surface-2/50 transition-colors"
                >
                  {/* Checkbox (only for regular users) */}
                  <div className="w-4">
                    {!user.isAdmin && !user.isAI && !user.employeeRole ? (
                      <input
                        type="checkbox"
                        checked={selectedIds.has(user.id)}
                        onChange={() => toggleSelect(user.id)}
                        className="w-3.5 h-3.5 rounded border-border"
                      />
                    ) : <div />}
                  </div>

                  {/* User */}
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Avatar src={user.avatarUrl} alt={user.username ?? ''} fallback={user.username ?? ''} size="sm" />
                    <div className="min-w-0">
                      <p className="text-[17px] text-text font-[450] truncate">{user.username ?? '—'}</p>
                      {user.isAI && <p className="text-[14px] text-text-3">AI account</p>}
                      {user.employeeRole && <p className="text-[14px] text-accent">{user.employeeRole}</p>}
                    </div>
                  </div>

                  {/* Email */}
                  <p className="text-[16px] text-text-2 truncate">{user.email ?? '—'}</p>

                  {/* ELO */}
                  <p className="text-[16px] text-text">{user.eloRating ?? 1000}</p>

                  {/* W/L */}
                  <p className="text-[16px] text-text">
                    <span className="text-[var(--green)]">{user.debatesWon ?? 0}</span>
                    <span className="text-text-3 mx-0.5">/</span>
                    <span className="text-[var(--red)]">{user.debatesLost ?? 0}</span>
                  </p>

                  {/* Joined */}
                  <p className="text-[15px] text-text-3">
                    {new Date(user.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}
                  </p>

                  {/* Status */}
                  <div className="flex flex-wrap gap-1">
                    {user.isAdmin && <Badge color="accent" size="sm">Admin</Badge>}
                    {user.isAI && <Badge color="blue" size="sm">AI</Badge>}
                    {user.isCreator && <Badge color="green" size="sm">Creator</Badge>}
                    {user.subscription?.tier === 'PRO' && user.subscription?.status === 'ACTIVE' && (
                      <Badge color="blue" size="sm">PRO</Badge>
                    )}
                    {isSuspended ? (
                      <Badge color="red" size="sm">Suspended</Badge>
                    ) : !user.isAdmin && !user.isAI ? (
                      <Badge color="muted" size="sm">Active</Badge>
                    ) : null}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5">
                    {!user.isAI && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSuspend(user)}
                        loading={actionMutation.isPending && (suspendUser?.id === user.id || actionMutation.variables?.userId === user.id)}
                        className="text-[15px]"
                      >
                        {isSuspended ? 'Unsuspend' : 'Suspend'}
                      </Button>
                    )}
                    {user.isCreator !== undefined && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleCreatorMutation.mutate({ userId: user.id, enabled: !user.isCreator })}
                        className="text-[15px]"
                      >
                        {user.isCreator ? 'Remove Creator' : 'Make Creator'}
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeleteUser(user)}
                      className="text-[15px] text-[var(--red)] hover:text-[var(--red)]"
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {displayList.length >= 50 && (
        <p className="text-[15px] text-text-3 text-center">Showing first 50 results. Use search to narrow results.</p>
      )}

      {/* Suspend Modal */}
      <Modal open={!!suspendUser} onClose={() => setSuspendUser(null)} title="Suspend User">
        <div className="space-y-4">
          <p className="text-[17px] text-text-2">
            Suspend <span className="text-text font-[500]">{suspendUser?.username}</span> from debating. They can still log in and browse.
          </p>
          <div>
            <label className={labelCls}>Suspension Duration (Days)</label>
            <Input
              type="number"
              min="1"
              max="365"
              value={suspendDays}
              onChange={e => setSuspendDays(e.target.value)}
              placeholder="Enter number of days"
            />
            <p className="text-[15px] text-text-3 mt-1">User will be suspended from debating for this many days.</p>
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t border-border">
            <Button variant="secondary" size="sm" onClick={() => setSuspendUser(null)} disabled={actionMutation.isPending}>Cancel</Button>
            <Button variant="accent" size="sm" onClick={confirmSuspend} loading={actionMutation.isPending}>Suspend User</Button>
          </div>
        </div>
      </Modal>

      {/* Delete Modal */}
      <Modal open={!!deleteUser} onClose={() => setDeleteUser(null)} title="Delete User">
        <div className="space-y-4">
          <p className="text-[17px] text-text-2">
            Permanently delete <span className="text-text font-[500]">{deleteUser?.username}</span>? This removes all their data and cannot be undone.
          </p>
          <div className="flex justify-end gap-2 pt-4 border-t border-border">
            <Button variant="secondary" size="sm" onClick={() => setDeleteUser(null)} disabled={actionMutation.isPending}>Cancel</Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => deleteUser && actionMutation.mutate({ userId: deleteUser.id, type: 'delete' })}
              loading={actionMutation.isPending}
              className="text-[var(--red)] border-[var(--red)]/30 hover:border-[var(--red)]/60"
            >
              Delete Permanently
            </Button>
          </div>
        </div>
      </Modal>

      {/* Bulk Delete Modal */}
      <Modal open={bulkDeleteOpen} onClose={() => setBulkDeleteOpen(false)} title="Delete Selected Users">
        <div className="space-y-4">
          <p className="text-[17px] text-text-2">
            Permanently delete <span className="text-text font-[500]">{selectedIds.size}</span> user(s)? This cannot be undone.
          </p>
          <div className="flex justify-end gap-2 pt-4 border-t border-border">
            <Button variant="secondary" size="sm" onClick={() => setBulkDeleteOpen(false)} disabled={bulkDeleteMutation.isPending}>Cancel</Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => bulkDeleteMutation.mutate(Array.from(selectedIds))}
              loading={bulkDeleteMutation.isPending}
              className="text-[var(--red)] border-[var(--red)]/30 hover:border-[var(--red)]/60"
            >
              Delete {selectedIds.size} User(s)
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
