'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { useToast } from '@/components/ui/toast';

interface CreateTournamentFormProps {
  userId: string;
  coins: number;
}

export function CreateTournamentForm({ userId, coins }: CreateTournamentFormProps) {
  const router = useRouter();
  const { success, error } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '',
    description: '',
    maxParticipants: 16,
    format: 'BRACKET',
    startDate: '',
    roundDuration: 24,
    minElo: '',
    entryFee: '',
    prizePool: '',
    isPrivate: false,
  });

  function update(key: string, value: string | number | boolean) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { error('Name is required'); return; }
    if (!form.startDate)   { error('Start date is required'); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/tournaments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          minElo:    form.minElo    ? parseInt(form.minElo)    : undefined,
          entryFee:  form.entryFee  ? parseInt(form.entryFee)  : undefined,
          prizePool: form.prizePool ? parseInt(form.prizePool) : undefined,
          totalRounds: Math.log2(form.maxParticipants),
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        error('Failed', d.error ?? 'Please try again');
        return;
      }
      const data = await res.json();
      success('Tournament created');
      router.push(`/tournaments/${data.id}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Basic info */}
      <Card padding="lg">
        <p className="label mb-4">Basic info</p>
        <div className="space-y-4">
          <div>
            <label className="label block mb-1.5">Tournament name *</label>
            <Input
              value={form.name}
              onChange={(e) => update('name', e.target.value)}
              placeholder="e.g. Winter Championship 2026"
            />
          </div>
          <div>
            <label className="label block mb-1.5">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => update('description', e.target.value)}
              placeholder="What is this tournament about?"
              rows={3}
              className="w-full bg-surface-2 border border-border rounded-[var(--radius)] px-3 py-2.5 text-xs text-text placeholder:text-text-3 resize-none focus:outline-none focus:border-border-2 transition-colors"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label block mb-1.5">Format</label>
              <select
                value={form.format}
                onChange={(e) => update('format', e.target.value)}
                className="w-full bg-surface-2 border border-border rounded-[var(--radius)] px-3 py-2 text-xs text-text focus:outline-none focus:border-border-2 transition-colors"
              >
                <option value="BRACKET">Single elimination</option>
                <option value="CHAMPIONSHIP">Championship</option>
                <option value="KING_OF_THE_HILL">King of the hill</option>
              </select>
            </div>
            <div>
              <label className="label block mb-1.5">Max participants</label>
              <select
                value={form.maxParticipants}
                onChange={(e) => update('maxParticipants', parseInt(e.target.value))}
                className="w-full bg-surface-2 border border-border rounded-[var(--radius)] px-3 py-2 text-xs text-text focus:outline-none focus:border-border-2 transition-colors"
              >
                {[4, 8, 16, 32, 64].map((n) => (
                  <option key={n} value={n}>{n} players</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </Card>

      {/* Schedule */}
      <Card padding="lg">
        <p className="label mb-4">Schedule</p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label block mb-1.5">Start date *</label>
            <Input
              type="datetime-local"
              value={form.startDate}
              onChange={(e) => update('startDate', e.target.value)}
            />
          </div>
          <div>
            <label className="label block mb-1.5">Round duration (hours)</label>
            <Input
              type="number"
              value={form.roundDuration}
              onChange={(e) => update('roundDuration', parseInt(e.target.value))}
              min={1}
              max={168}
            />
          </div>
        </div>
      </Card>

      {/* Rules & prizes */}
      <Card padding="lg">
        <p className="label mb-4">Rules &amp; prizes</p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label block mb-1.5">Min ELO</label>
            <Input
              type="number"
              value={form.minElo}
              onChange={(e) => update('minElo', e.target.value)}
              placeholder="No minimum"
            />
          </div>
          <div>
            <label className="label block mb-1.5">Entry fee (coins)</label>
            <Input
              type="number"
              value={form.entryFee}
              onChange={(e) => update('entryFee', e.target.value)}
              placeholder="Free entry"
            />
          </div>
          <div className="col-span-2">
            <label className="label block mb-1.5">Prize pool (coins)</label>
            <Input
              type="number"
              value={form.prizePool}
              onChange={(e) => update('prizePool', e.target.value)}
              placeholder="No prize pool"
            />
            <p className="text-[13px] text-text-3 mt-1">Your balance: {coins} coins</p>
          </div>
        </div>
        <div className="flex items-center gap-3 mt-4">
          <button
            type="button"
            onClick={() => update('isPrivate', !form.isPrivate)}
            className={`relative h-5 w-9 rounded-full transition-colors ${
              form.isPrivate ? 'bg-accent' : 'bg-surface-3'
            }`}
          >
            <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-bg transition-transform ${
              form.isPrivate ? 'translate-x-4' : 'translate-x-0.5'
            }`} />
          </button>
          <div>
            <p className="text-xs text-text">Private tournament</p>
            <p className="text-[13px] text-text-3">Only invited users can join</p>
          </div>
        </div>
      </Card>

      <div className="flex gap-3">
        <Button variant="accent" size="md" type="submit" loading={saving}>
          Create tournament
        </Button>
        <Button variant="secondary" size="md" href="/tournaments">
          Cancel
        </Button>
      </div>
    </form>
  );
}
