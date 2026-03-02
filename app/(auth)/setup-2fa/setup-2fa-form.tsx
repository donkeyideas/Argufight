'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';
import { Skeleton } from '@/components/ui/skeleton';

export function SetupTwoFAForm({ userId }: { userId: string }) {
  const router = useRouter();
  const { success, error } = useToast();
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    fetch('/api/auth/2fa/setup')
      .then((r) => r.json())
      .then((d) => { setQrCode(d.qrCode); setSecret(d.secret); })
      .catch(() => error('Failed to load QR code'))
      .finally(() => setFetching(false));
  }, []);

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;
    setLoading(true);
    try {
      const res = await fetch('/api/auth/2fa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      if (!res.ok) {
        const d = await res.json();
        error('Invalid code', d.error ?? 'Check your authenticator app');
        return;
      }
      success('2FA enabled', 'Your account is now protected.');
      router.push('/settings');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Step 1: QR Code */}
      <div className="bg-surface-2 rounded-[var(--radius)] p-4">
        <p className="label mb-3">Step 1: Scan QR code</p>
        {fetching ? (
          <Skeleton className="h-40 w-40 mx-auto" />
        ) : qrCode ? (
          <img src={qrCode} alt="2FA QR Code" className="mx-auto h-40 w-40 rounded" />
        ) : (
          <p className="text-xs text-text-3 text-center">Failed to generate QR code</p>
        )}
        {secret && (
          <p className="text-[12px] text-text-3 text-center mt-3 font-mono break-all">
            Manual entry: {secret}
          </p>
        )}
      </div>

      {/* Step 2: Verify */}
      <div>
        <p className="label mb-3">Step 2: Enter verification code</p>
        <form onSubmit={handleVerify} className="space-y-3">
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="6-digit code"
            maxLength={6}
            className="tracking-widest text-center text-lg"
          />
          <Button variant="accent" size="md" fullWidth type="submit" loading={loading}>
            Enable 2FA
          </Button>
        </form>
      </div>
    </div>
  );
}
