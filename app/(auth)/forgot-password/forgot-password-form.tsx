'use client';

import { useState } from 'react';
import { CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function ForgotPasswordForm() {
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const email = (new FormData(e.currentTarget)).get('email') as string;

    try {
      const res = await fetch('/api/auth/password/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      if (res.ok) {
        setSent(true);
      } else {
        const data = await res.json();
        setError(data.error ?? 'Failed to send reset email');
      }
    } catch {
      setError('Connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="flex flex-col items-center text-center gap-3 py-4">
        <CheckCircle size={32} className="text-[var(--green)]" />
        <div>
          <p className="text-sm font-medium text-text">Check your email</p>
          <p className="text-xs text-text-3 mt-1">
            If an account exists with that email, we've sent a reset link.
          </p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      {error && (
        <div className="bg-[var(--red-muted)] border border-[var(--red)] border-opacity-30 rounded-[var(--radius)] px-3 py-2.5">
          <p className="text-xs text-[var(--red)]">{error}</p>
        </div>
      )}
      <Input
        name="email"
        type="email"
        label="Email"
        placeholder="you@example.com"
        autoComplete="email"
        required
      />
      <Button type="submit" variant="accent" size="md" fullWidth loading={loading}>
        Send reset link
      </Button>
    </form>
  );
}
