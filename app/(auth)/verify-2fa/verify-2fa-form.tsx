'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';

export function VerifyTwoFAForm() {
  const router = useRouter();
  const { error } = useToast();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim() || code.length < 6) return;
    setLoading(true);
    try {
      const res = await fetch('/api/auth/2fa/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      if (!res.ok) {
        const d = await res.json();
        error('Invalid code', d.error ?? 'Check your authenticator app');
        setCode('');
        return;
      }
      router.push('/dashboard');
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
        placeholder="000000"
        maxLength={6}
        className="tracking-widest text-center text-lg font-[500]"
        autoFocus
      />
      <Button variant="accent" size="md" fullWidth type="submit" loading={loading} disabled={code.length < 6}>
        Verify
      </Button>
      <p className="text-center">
        <Link href="/login" className="text-[13px] text-text-3 hover:text-text-2 transition-colors">
          Back to sign in
        </Link>
      </p>
    </form>
  );
}
