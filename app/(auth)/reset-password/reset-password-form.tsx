'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const { success, error } = useToast();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) { error('Passwords do not match'); return; }
    if (password.length < 8) { error('Password too short', 'Min. 8 characters'); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      if (!res.ok) {
        const d = await res.json();
        error('Failed', d.error ?? 'Link may have expired');
        return;
      }
      success('Password reset', 'You can now sign in with your new password.');
      router.push('/login');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="label block mb-1.5">New password</label>
        <Input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Min. 8 characters"
          autoComplete="new-password"
        />
      </div>
      <div>
        <label className="label block mb-1.5">Confirm password</label>
        <Input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="Repeat password"
          autoComplete="new-password"
        />
      </div>
      <Button variant="accent" size="md" fullWidth type="submit" loading={loading}>
        Set new password
      </Button>
    </form>
  );
}
