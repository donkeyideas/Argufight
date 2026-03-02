'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { useToast } from '@/components/ui/toast';
import { AdminStatCard } from '@/components/features/admin/admin-stat-card';
import { Plus, Trash2 } from 'lucide-react';

type SubTier    = 'FREE' | 'PRO' | 'CHAMPION' | 'ELITE';
type SubStatus  = 'ACTIVE' | 'CANCELLED' | 'PAST_DUE' | 'TRIALING' | 'EXPIRED';
type BadgeColor = 'muted' | 'blue' | 'amber' | 'accent' | 'green' | 'red';

const tierColors:   Record<SubTier,   BadgeColor> = { FREE: 'muted', PRO: 'blue', CHAMPION: 'amber', ELITE: 'accent' };
const statusColors: Record<SubStatus, BadgeColor> = { ACTIVE: 'green', CANCELLED: 'muted', PAST_DUE: 'red', TRIALING: 'blue', EXPIRED: 'muted' };

interface Subscription {
  id: string;
  status: string;
  billingCycle?: string | null;
  currentPeriodEnd?: string | null;
  tier?: string;
  user?: { username: string; email: string } | null;
}

interface PromoCode {
  id: string;
  code: string;
  description: string | null;
  discountType: 'PERCENTAGE' | 'FIXED_AMOUNT';
  discountValue: number;
  maxUses: number | null;
  currentUses: number;
  validFrom: string;
  validUntil: string | null;
  applicableTo: string;
  isActive: boolean;
  createdAt: string;
}

const labelCls  = 'block text-[16px] font-[500] text-text-2 mb-1.5';
const selectCls = 'w-full h-9 px-3 bg-surface-2 border border-border rounded-[var(--radius)] text-[17px] text-text focus:outline-none focus:border-border-2';
const TABS = [
  { key: 'overview',    label: 'Subscriptions' },
  { key: 'pricing',     label: 'Pricing' },
  { key: 'promo-codes', label: 'Promo Codes' },
];

export default function AdminSubscriptionsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState('overview');
  const [promoModalOpen, setPromoModalOpen] = useState(false);
  const [deletePromo, setDeletePromo] = useState<PromoCode | null>(null);

  // Pricing form
  const [pricingForm, setPricingForm] = useState({ monthly: '9.99', yearly: '89.00' });

  // Promo code form
  const [promoForm, setPromoForm] = useState({
    code: '', description: '',
    discountType: 'PERCENTAGE' as 'PERCENTAGE' | 'FIXED_AMOUNT',
    discountValue: '',
    maxUses: '',
    validFrom: new Date().toISOString().split('T')[0],
    validUntil: '',
    applicableTo: 'PRO',
  });

  const { data: subs = [], isLoading: subsLoading } = useQuery<Subscription[]>({
    queryKey: ['admin-subscriptions'],
    queryFn: async () => {
      const res = await fetch('/api/admin/subscriptions');
      if (!res.ok) return [];
      const data = await res.json();
      return data.subscriptions || data || [];
    },
    staleTime: 60_000,
    enabled: tab === 'overview',
  });

  const { data: pricing } = useQuery<{ monthly: number; yearly: number }>({
    queryKey: ['subscriptions-pricing'],
    queryFn: async () => {
      const res = await fetch('/api/subscriptions/pricing');
      if (!res.ok) return { monthly: 9.99, yearly: 89 };
      return res.json();
    },
    staleTime: 60_000,
    enabled: tab === 'pricing',
  });

  useEffect(() => {
    if (pricing) {
      setPricingForm({ monthly: pricing.monthly.toString(), yearly: pricing.yearly.toString() });
    }
  }, [pricing]);

  const { data: promoCodes = [], isLoading: promoLoading } = useQuery<PromoCode[]>({
    queryKey: ['admin-promo-codes'],
    queryFn: async () => {
      const res = await fetch('/api/admin/promo-codes');
      if (!res.ok) return [];
      const data = await res.json();
      return data.promoCodes || [];
    },
    staleTime: 60_000,
    enabled: tab === 'promo-codes',
  });

  const total     = subs.length;
  const active    = subs.filter(s => s.status === 'ACTIVE').length;
  const cancelled = subs.filter(s => s.status === 'CANCELLED').length;

  const savePricingMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/admin/subscriptions/pricing', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ monthly: parseFloat(pricingForm.monthly), yearly: parseFloat(pricingForm.yearly) }),
      });
      if (!res.ok) throw new Error('Failed to save pricing');
    },
    onSuccess: () => {
      toast({ type: 'success', title: 'Pricing updated' });
      queryClient.invalidateQueries({ queryKey: ['subscriptions-pricing'] });
    },
    onError: () => toast({ type: 'error', title: 'Failed to update pricing' }),
  });

  const createPromoMutation = useMutation({
    mutationFn: async (form: typeof promoForm) => {
      const res = await fetch('/api/admin/promo-codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: form.code,
          description: form.description || null,
          discountType: form.discountType,
          discountValue: parseFloat(form.discountValue),
          maxUses: form.maxUses ? parseInt(form.maxUses) : null,
          validFrom: form.validFrom,
          validUntil: form.validUntil || null,
          applicableTo: form.applicableTo,
        }),
      });
      if (!res.ok) throw new Error('Failed to create promo code');
    },
    onSuccess: () => {
      toast({ type: 'success', title: 'Promo code created' });
      setPromoModalOpen(false);
      setPromoForm({ code: '', description: '', discountType: 'PERCENTAGE', discountValue: '', maxUses: '', validFrom: new Date().toISOString().split('T')[0], validUntil: '', applicableTo: 'PRO' });
      queryClient.invalidateQueries({ queryKey: ['admin-promo-codes'] });
    },
    onError: () => toast({ type: 'error', title: 'Failed to create promo code' }),
  });

  const togglePromoMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const res = await fetch(`/api/admin/promo-codes/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive }),
      });
      if (!res.ok) throw new Error('Failed to toggle');
    },
    onSuccess: () => {
      toast({ type: 'success', title: 'Promo code updated' });
      queryClient.invalidateQueries({ queryKey: ['admin-promo-codes'] });
    },
    onError: () => toast({ type: 'error', title: 'Failed to update promo code' }),
  });

  const deletePromoMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/promo-codes/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
    },
    onSuccess: () => {
      toast({ type: 'success', title: 'Promo code deleted' });
      setDeletePromo(null);
      queryClient.invalidateQueries({ queryKey: ['admin-promo-codes'] });
    },
    onError: () => toast({ type: 'error', title: 'Failed to delete promo code' }),
  });

  const handleCreatePromo = () => {
    if (!promoForm.code || !promoForm.discountValue) {
      toast({ type: 'error', title: 'Code and discount value are required' });
      return;
    }
    createPromoMutation.mutate(promoForm);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-[600] text-text tracking-[-0.3px]">Subscriptions</h1>
          <p className="text-[17px] text-text-3 mt-0.5">Manage pricing, promo codes, and user subscriptions</p>
        </div>
        {tab === 'promo-codes' && (
          <Button variant="accent" size="sm" onClick={() => setPromoModalOpen(true)}>
            <Plus size={13} className="mr-1.5" />
            Add Promo Code
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-surface-2 p-1 rounded-[var(--radius)] border border-border w-fit">
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

      {/* Overview Tab */}
      {tab === 'overview' && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <AdminStatCard label="Total" value={total.toLocaleString()} />
            <AdminStatCard label="Active" value={active.toLocaleString()} accent={active > 0} />
            <AdminStatCard label="Cancelled" value={cancelled.toLocaleString()} />
          </div>

          <Card padding="none" className="overflow-hidden">
            <div className="grid grid-cols-[2fr_2fr_1fr_1fr_1fr_1fr] gap-4 px-4 py-2.5 border-b border-border bg-surface-2">
              {['User', 'Email', 'Tier', 'Status', 'Billing', 'Period End'].map(h => (
                <p key={h} className="text-[14px] font-[500] text-text-3 uppercase tracking-wide">{h}</p>
              ))}
            </div>

            {subsLoading ? (
              <div className="flex items-center justify-center h-32">
                <div className="h-6 w-6 rounded-full border-2 border-border border-t-accent animate-spin" />
              </div>
            ) : subs.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <p className="text-[17px] text-text-3">No subscriptions found.</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {subs.map(sub => {
                  const tier   = ((sub.tier ?? 'FREE') as SubTier);
                  const status = (sub.status as SubStatus);
                  return (
                    <div key={sub.id} className="grid grid-cols-[2fr_2fr_1fr_1fr_1fr_1fr] gap-4 px-4 py-3 items-center hover:bg-surface-2/50 transition-colors">
                      <p className="text-[16px] text-text font-[450] truncate">{sub.user?.username ?? '—'}</p>
                      <p className="text-[16px] text-text-2 truncate">{sub.user?.email ?? '—'}</p>
                      <Badge color={tierColors[tier] ?? 'muted'} size="sm">{tier}</Badge>
                      <Badge color={statusColors[status] ?? 'muted'} size="sm" dot>{status}</Badge>
                      <p className="text-[16px] text-text-2 capitalize">{sub.billingCycle?.toLowerCase() ?? '—'}</p>
                      <p className="text-[15px] text-text-3">
                        {sub.currentPeriodEnd
                          ? new Date(sub.currentPeriodEnd).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })
                          : '—'}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </>
      )}

      {/* Pricing Tab */}
      {tab === 'pricing' && (
        <Card padding="none">
          <div className="p-4 border-b border-border">
            <h3 className="text-[16px] font-[500] text-text">Subscription Pricing</h3>
            <p className="text-[16px] text-text-3 mt-0.5">Set monthly and yearly PRO subscription prices</p>
          </div>
          <div className="p-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Monthly Price (USD)</label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={pricingForm.monthly}
                  onChange={e => setPricingForm(p => ({ ...p, monthly: e.target.value }))}
                  placeholder="9.99"
                />
              </div>
              <div>
                <label className={labelCls}>Yearly Price (USD)</label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={pricingForm.yearly}
                  onChange={e => setPricingForm(p => ({ ...p, yearly: e.target.value }))}
                  placeholder="89.00"
                />
              </div>
            </div>
            <p className="text-[15px] text-text-3">
              Yearly savings: {pricingForm.monthly && pricingForm.yearly
                ? `$${(parseFloat(pricingForm.monthly) * 12 - parseFloat(pricingForm.yearly)).toFixed(2)} (${Math.round((1 - parseFloat(pricingForm.yearly) / (parseFloat(pricingForm.monthly) * 12)) * 100)}% off)`
                : '—'}
            </p>
            <div className="flex pt-2">
              <Button variant="accent" size="sm" onClick={() => savePricingMutation.mutate()} loading={savePricingMutation.isPending}>
                Save Pricing
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Promo Codes Tab */}
      {tab === 'promo-codes' && (
        <Card padding="none">
          <div className="p-4 border-b border-border">
            <h3 className="text-[16px] font-[500] text-text">Promo Codes</h3>
            <p className="text-[16px] text-text-3 mt-0.5">{promoCodes.length} promo codes configured</p>
          </div>

          {promoLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="h-6 w-6 rounded-full border-2 border-border border-t-accent animate-spin" />
            </div>
          ) : promoCodes.length === 0 ? (
            <div className="px-4 py-12 text-center space-y-3">
              <p className="text-[17px] text-text-3">No promo codes created yet.</p>
              <Button variant="accent" size="sm" onClick={() => setPromoModalOpen(true)}>
                <Plus size={13} className="mr-1.5" />
                Create First Promo Code
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-border">
              <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_auto] gap-3 px-4 py-2.5 bg-surface-2">
                {['Code', 'Discount', 'Uses', 'Valid From', 'Valid Until', 'Status', ''].map(h => (
                  <p key={h} className="text-[14px] font-[500] text-text-3 uppercase tracking-wide">{h}</p>
                ))}
              </div>
              {promoCodes.map(pc => (
                <div key={pc.id} className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_auto] gap-3 px-4 py-3 items-center hover:bg-surface-2/50 transition-colors">
                  <div>
                    <p className="text-[17px] text-text font-mono font-[500]">{pc.code}</p>
                    {pc.description && <p className="text-[14px] text-text-3">{pc.description}</p>}
                  </div>
                  <p className="text-[16px] text-text">
                    {pc.discountType === 'PERCENTAGE' ? `${pc.discountValue}%` : `$${pc.discountValue}`}
                  </p>
                  <p className="text-[16px] text-text-2">
                    {pc.currentUses}{pc.maxUses ? `/${pc.maxUses}` : ''}
                  </p>
                  <p className="text-[15px] text-text-3">
                    {new Date(pc.validFrom).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}
                  </p>
                  <p className="text-[15px] text-text-3">
                    {pc.validUntil
                      ? new Date(pc.validUntil).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })
                      : 'No expiry'}
                  </p>
                  <div>
                    <button
                      onClick={() => togglePromoMutation.mutate({ id: pc.id, isActive: !pc.isActive })}
                      className={`relative w-9 h-5 rounded-full transition-colors ${pc.isActive ? 'bg-accent' : 'bg-surface-3'}`}
                    >
                      <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${pc.isActive ? 'translate-x-4' : ''}`} />
                    </button>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDeletePromo(pc)}
                    className="text-[var(--red)] hover:text-[var(--red)]"
                  >
                    <Trash2 size={13} />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Create Promo Modal */}
      <Modal open={promoModalOpen} onClose={() => setPromoModalOpen(false)} title="Create Promo Code">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Code *</label>
              <Input value={promoForm.code} onChange={e => setPromoForm(p => ({ ...p, code: e.target.value.toUpperCase() }))} placeholder="SUMMER20" />
            </div>
            <div>
              <label className={labelCls}>Applies To</label>
              <select value={promoForm.applicableTo} onChange={e => setPromoForm(p => ({ ...p, applicableTo: e.target.value }))} className={selectCls}>
                <option value="PRO">PRO</option>
                <option value="FREE">FREE</option>
                <option value="BOTH">Both</option>
              </select>
            </div>
          </div>

          <div>
            <label className={labelCls}>Description</label>
            <Input value={promoForm.description} onChange={e => setPromoForm(p => ({ ...p, description: e.target.value }))} placeholder="Summer promotion 2026" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Discount Type</label>
              <select value={promoForm.discountType} onChange={e => setPromoForm(p => ({ ...p, discountType: e.target.value as 'PERCENTAGE' | 'FIXED_AMOUNT' }))} className={selectCls}>
                <option value="PERCENTAGE">Percentage (%)</option>
                <option value="FIXED_AMOUNT">Fixed Amount ($)</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Value *</label>
              <Input type="number" value={promoForm.discountValue} onChange={e => setPromoForm(p => ({ ...p, discountValue: e.target.value }))} placeholder={promoForm.discountType === 'PERCENTAGE' ? '20' : '5.00'} min="0" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Max Uses (blank = unlimited)</label>
              <Input type="number" value={promoForm.maxUses} onChange={e => setPromoForm(p => ({ ...p, maxUses: e.target.value }))} placeholder="100" min="1" />
            </div>
            <div>
              <label className={labelCls}>Valid From</label>
              <Input type="date" value={promoForm.validFrom} onChange={e => setPromoForm(p => ({ ...p, validFrom: e.target.value }))} />
            </div>
          </div>

          <div>
            <label className={labelCls}>Valid Until (blank = no expiry)</label>
            <Input type="date" value={promoForm.validUntil} onChange={e => setPromoForm(p => ({ ...p, validUntil: e.target.value }))} />
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-border">
            <Button variant="secondary" size="sm" onClick={() => setPromoModalOpen(false)} disabled={createPromoMutation.isPending}>Cancel</Button>
            <Button variant="accent" size="sm" onClick={handleCreatePromo} loading={createPromoMutation.isPending}>Create Code</Button>
          </div>
        </div>
      </Modal>

      {/* Delete Promo Modal */}
      <Modal open={!!deletePromo} onClose={() => setDeletePromo(null)} title="Delete Promo Code">
        <div className="space-y-4">
          <p className="text-[17px] text-text-2">
            Delete promo code <span className="text-text font-mono font-[500]">{deletePromo?.code}</span>? This cannot be undone.
          </p>
          <div className="flex justify-end gap-2 pt-4 border-t border-border">
            <Button variant="secondary" size="sm" onClick={() => setDeletePromo(null)} disabled={deletePromoMutation.isPending}>Cancel</Button>
            <Button
              variant="secondary" size="sm"
              onClick={() => deletePromo && deletePromoMutation.mutate(deletePromo.id)}
              loading={deletePromoMutation.isPending}
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
