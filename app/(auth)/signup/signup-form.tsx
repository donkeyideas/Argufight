'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';
import { Separator } from '@/components/ui/separator';
import { Chrome } from 'lucide-react';

export function SignupForm() {
  const router = useRouter();
  const { error } = useToast();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ username: '', email: '', password: '' });

  function update(k: string, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.username.trim() || !form.email.trim() || !form.password) return;
    if (form.password.length < 8) { error('Password too short', 'Min. 8 characters'); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const d = await res.json();
        error('Signup failed', d.error ?? 'Please try again');
        return;
      }
      router.push('/dashboard');
    } finally {
      setLoading(false);
    }
  }

  function handleGoogle() {
    window.location.href = '/api/auth/google';
  }

  return (
    <div className="space-y-4">
      <Button variant="secondary" size="md" fullWidth onClick={handleGoogle} type="button">
        <Chrome size={14} />
        Continue with Google
      </Button>

      <div className="flex items-center gap-3">
        <Separator className="flex-1" />
        <span className="text-[13px] text-text-3">or</span>
        <Separator className="flex-1" />
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="label block mb-1.5">Username</label>
          <Input
            value={form.username}
            onChange={(e) => update('username', e.target.value)}
            placeholder="Choose a username"
            autoComplete="username"
          />
        </div>
        <div>
          <label className="label block mb-1.5">Email</label>
          <Input
            type="email"
            value={form.email}
            onChange={(e) => update('email', e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
          />
        </div>
        <div>
          <label className="label block mb-1.5">Password</label>
          <Input
            type="password"
            value={form.password}
            onChange={(e) => update('password', e.target.value)}
            placeholder="Min. 8 characters"
            autoComplete="new-password"
          />
        </div>
        <Button variant="accent" size="md" fullWidth type="submit" loading={loading}>
          Create account
        </Button>
        <p className="text-[12px] text-text-3 text-center">
          By signing up you agree to our{' '}
          <a href="/terms" className="hover:underline">Terms</a>
          {' '}and{' '}
          <a href="/privacy" className="hover:underline">Privacy Policy</a>
        </p>
      </form>
    </div>
  );
}
