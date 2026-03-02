'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';

const CATEGORIES = [
  'Account issue',
  'Billing',
  'Debate dispute',
  'Bug report',
  'Feature request',
  'Other',
];

export function SupportForm({ userEmail }: { userEmail: string }) {
  const [category, setCategory] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const { success, error } = useToast();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!subject.trim() || !message.trim()) {
      error('Please fill in all fields');
      return;
    }
    setSending(true);
    try {
      const res = await fetch('/api/support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category, subject, message }),
      });
      if (res.ok) {
        success('Message sent', "We'll get back to you within 24 hours.");
        setSent(true);
      } else {
        error('Failed to send', 'Please try again or email us directly.');
      }
    } finally {
      setSending(false);
    }
  }

  if (sent) {
    return (
      <div className="text-center py-6">
        <p className="text-xs font-[450] text-text mb-1">Message sent</p>
        <p className="text-[13px] text-text-3">{"We'll respond to you within 24 hours."}</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="label block mb-1.5">Category</label>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="w-full bg-surface-2 border border-border rounded-[var(--radius)] px-3 py-2 text-xs text-text focus:outline-none focus:border-border-2 transition-colors"
        >
          <option value="">Select a category</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="label block mb-1.5">Subject</label>
        <Input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Brief description of your issue"
        />
      </div>
      <div>
        <label className="label block mb-1.5">Message</label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Describe your issue in detail..."
          rows={5}
          className="w-full bg-surface-2 border border-border rounded-[var(--radius)] px-3 py-2.5 text-xs text-text placeholder:text-text-3 resize-none focus:outline-none focus:border-border-2 transition-colors"
        />
      </div>
      <Button variant="accent" size="sm" type="submit" loading={sending}>
        Send message
      </Button>
    </form>
  );
}
