'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { Input, Textarea } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';
import { AdminStatCard } from '@/components/features/admin/admin-stat-card';
import { Plus, Pencil, Trash2 } from 'lucide-react';

interface Category {
  id: string;
  name: string;
  label: string;
  description: string | null;
  color: string | null;
  icon: string | null;
  isActive: boolean;
  sortOrder: number;
  _count?: { debates: number };
}

const labelCls = 'block text-[16px] font-[500] text-text-2 mb-1.5';

const defaultForm = { name: '', label: '', description: '', color: '#d4f050', isActive: true, sortOrder: 0 };

export default function AdminCategoriesPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);
  const [editing, setEditing] = useState<Category | null>(null);
  const [form, setForm] = useState(defaultForm);

  const { data: categories = [], isLoading } = useQuery<Category[]>({
    queryKey: ['admin-categories'],
    queryFn: async () => {
      const res = await fetch('/api/admin/categories');
      if (!res.ok) return [];
      const data = await res.json();
      return data.categories || [];
    },
    staleTime: 120_000,
  });

  const activeCount   = categories.filter(c => c.isActive).length;
  const inactiveCount = categories.filter(c => !c.isActive).length;

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin-categories'] });

  const openCreate = () => {
    setEditing(null);
    setForm({ ...defaultForm, sortOrder: categories.length });
    setModalOpen(true);
  };

  const openEdit = (category: Category) => {
    setEditing(category);
    setForm({
      name:        category.name,
      label:       category.label,
      description: category.description ?? '',
      color:       category.color ?? '#d4f050',
      isActive:    category.isActive,
      sortOrder:   category.sortOrder,
    });
    setModalOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: async (body: typeof form & { id?: string }) => {
      const url    = body.id ? `/api/admin/categories/${body.id}` : '/api/admin/categories';
      const method = body.id ? 'PUT' : 'POST';
      const { id: _id, ...rest } = body;
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rest),
      });
      if (!res.ok) throw new Error('Failed to save');
    },
    onSuccess: () => {
      toast({ type: 'success', title: editing ? 'Category updated' : 'Category created' });
      setModalOpen(false);
      setEditing(null);
      invalidate();
    },
    onError: () => toast({ type: 'error', title: 'Failed to save category' }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/categories/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
    },
    onSuccess: () => {
      toast({ type: 'success', title: 'Category deleted' });
      setDeleteTarget(null);
      invalidate();
    },
    onError: () => toast({ type: 'error', title: 'Failed to delete category' }),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const res = await fetch(`/api/admin/categories/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive }),
      });
      if (!res.ok) throw new Error('Failed to update');
    },
    onSuccess: () => { toast({ type: 'success', title: 'Category updated' }); invalidate(); },
    onError:   () => toast({ type: 'error', title: 'Failed to update category' }),
  });

  const handleSave = () => {
    if (!form.name.trim() || !form.label.trim()) {
      toast({ type: 'error', title: 'Name and label are required' });
      return;
    }
    saveMutation.mutate({ ...form, id: editing?.id });
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-[600] text-text tracking-[-0.3px]">Debate Categories</h1>
          <p className="text-[17px] text-text-3 mt-0.5">Manage the topic categories for debates</p>
        </div>
        <Button variant="accent" size="sm" onClick={openCreate}>
          <Plus size={13} className="mr-1.5" />
          Add Category
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <AdminStatCard label="Total categories" value={categories.length} />
        <AdminStatCard label="Active"   value={activeCount}   accent={activeCount > 0} />
        <AdminStatCard label="Inactive" value={inactiveCount} />
      </div>

      {/* Categories table */}
      <Card padding="none">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <p className="text-[17px] font-[500] text-text">All categories</p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <div className="h-6 w-6 rounded-full border-2 border-border border-t-accent animate-spin" />
          </div>
        ) : categories.length === 0 ? (
          <div className="px-4 py-12 text-center space-y-3">
            <p className="text-[17px] text-text-3">No categories yet. Add some to organize debates.</p>
            <Button variant="accent" size="sm" onClick={openCreate}>
              <Plus size={13} className="mr-1.5" />
              Add First Category
            </Button>
          </div>
        ) : (
          <div className="divide-y divide-border">
            <div className="grid grid-cols-[auto_2fr_2fr_1fr_1fr_1fr_auto] gap-3 px-4 py-2 bg-surface-2">
              {['Color', 'Name', 'Label', 'Debates', 'Sort', 'Status', ''].map(h => (
                <p key={h} className="text-[14px] font-[500] text-text-3 uppercase tracking-wide">{h}</p>
              ))}
            </div>

            {[...categories].sort((a, b) => a.sortOrder - b.sortOrder).map(cat => (
              <div key={cat.id} className="grid grid-cols-[auto_2fr_2fr_1fr_1fr_1fr_auto] gap-3 px-4 py-3 items-center hover:bg-surface-2/50 transition-colors">
                <div className="w-5 h-5 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color ?? '#d4f050' }} />
                <div className="min-w-0">
                  <p className="text-[16px] text-text font-[450] truncate">{cat.name}</p>
                  {cat.description && <p className="text-[14px] text-text-3 truncate">{cat.description}</p>}
                </div>
                <p className="text-[16px] text-text-2 truncate">{cat.label}</p>
                <p className="text-[16px] text-text-2">{cat._count?.debates ?? 0}</p>
                <p className="text-[16px] text-text-2">{cat.sortOrder}</p>
                <div>
                  <button
                    onClick={() => toggleActiveMutation.mutate({ id: cat.id, isActive: !cat.isActive })}
                    className={`relative w-9 h-5 rounded-full transition-colors ${cat.isActive ? 'bg-accent' : 'bg-surface-3'}`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${cat.isActive ? 'translate-x-4' : ''}`} />
                  </button>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" onClick={() => openEdit(cat)}>
                    <Pencil size={12} />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(cat)} className="text-[var(--red)] hover:text-[var(--red)]">
                    <Trash2 size={12} />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Create/Edit Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Category' : 'Add Category'}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Name * <span className="text-text-3 font-normal">(unique key)</span></label>
              <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="politics" disabled={!!editing} />
            </div>
            <div>
              <label className={labelCls}>Label * <span className="text-text-3 font-normal">(display name)</span></label>
              <Input value={form.label} onChange={e => setForm(p => ({ ...p, label: e.target.value }))} placeholder="Politics" />
            </div>
          </div>
          <div>
            <label className={labelCls}>Description</label>
            <Textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={2} placeholder="Brief description..." />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Color</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={form.color}
                  onChange={e => setForm(p => ({ ...p, color: e.target.value }))}
                  className="w-9 h-9 rounded-[var(--radius)] border border-border cursor-pointer bg-surface-2 p-0.5"
                />
                <Input value={form.color} onChange={e => setForm(p => ({ ...p, color: e.target.value }))} className="font-mono text-[15px]" />
              </div>
            </div>
            <div>
              <label className={labelCls}>Sort Order</label>
              <Input type="number" value={form.sortOrder.toString()} onChange={e => setForm(p => ({ ...p, sortOrder: parseInt(e.target.value) || 0 }))} min="0" />
            </div>
            <div>
              <label className={labelCls}>Active</label>
              <div className="flex items-center h-9">
                <button
                  onClick={() => setForm(p => ({ ...p, isActive: !p.isActive }))}
                  className={`relative w-10 h-5 rounded-full transition-colors ${form.isActive ? 'bg-accent' : 'bg-surface-3'}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${form.isActive ? 'translate-x-5' : ''}`} />
                </button>
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t border-border">
            <Button variant="secondary" size="sm" onClick={() => setModalOpen(false)} disabled={saveMutation.isPending}>Cancel</Button>
            <Button variant="accent" size="sm" onClick={handleSave} loading={saveMutation.isPending}>
              {editing ? 'Save Changes' : 'Create Category'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Modal */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Category">
        <div className="space-y-4">
          <p className="text-[17px] text-text-2">
            Delete <span className="text-text font-[500]">"{deleteTarget?.label}"</span>?
            {(deleteTarget?._count?.debates ?? 0) > 0 && (
              <span className="text-[var(--amber)]"> This category has {deleteTarget?._count?.debates} debates.</span>
            )}{' '}
            This cannot be undone.
          </p>
          <div className="flex justify-end gap-2 pt-4 border-t border-border">
            <Button variant="secondary" size="sm" onClick={() => setDeleteTarget(null)} disabled={deleteMutation.isPending}>Cancel</Button>
            <Button
              variant="secondary" size="sm"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              loading={deleteMutation.isPending}
              className="text-[var(--red)] border-[var(--red)]/30"
            >
              Delete
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
