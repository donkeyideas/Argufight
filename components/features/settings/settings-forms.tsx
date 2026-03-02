'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/components/ui/toast';
import { Avatar } from '@/components/ui/avatar';
import { Shield, Key, User, Bell, AlertTriangle } from 'lucide-react';

/* eslint-disable @typescript-eslint/no-explicit-any */

// ─── Profile Form ────────────────────────────────────────────────────────────

interface ProfileFormProps {
  user: {
    id: string;
    username: string;
    email: string;
    bio: string | null;
    avatarUrl: string | null;
  };
}

export function ProfileForm({ user }: ProfileFormProps) {
  const [username, setUsername] = useState(user.username);
  const [bio, setBio] = useState(user.bio ?? '');
  const [saving, setSaving] = useState(false);
  const { success, error } = useToast();

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, bio }),
      });
      if (res.ok) {
        success('Profile saved');
      } else {
        const d = await res.json();
        error('Failed to save', d.error ?? 'Please try again');
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card padding="lg">
      <div className="flex items-center gap-2 mb-5">
        <User size={14} className="text-text-3" />
        <h2 className="text-sm font-[500] text-text">Profile</h2>
      </div>

      <div className="flex items-center gap-4 mb-5">
        <Avatar src={user.avatarUrl} fallback={user.username} size="xl" />
        <div>
          <Button variant="secondary" size="sm">Change avatar</Button>
          <p className="text-[13px] text-text-3 mt-1.5">JPG, PNG or GIF · max 2MB</p>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-4">
        <div>
          <label className="label block mb-1.5">Username</label>
          <Input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Your username"
          />
        </div>
        <div>
          <label className="label block mb-1.5">Email</label>
          <Input value={user.email} disabled className="opacity-60 cursor-not-allowed" />
          <p className="text-[13px] text-text-3 mt-1">Contact support to change your email</p>
        </div>
        <div>
          <label className="label block mb-1.5">Bio</label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="A short bio about yourself..."
            rows={3}
            className="w-full bg-surface-2 border border-border rounded-[var(--radius)] px-3 py-2.5 text-xs text-text placeholder:text-text-3 resize-none focus:outline-none focus:border-border-2 transition-colors"
          />
        </div>
        <Button variant="accent" size="sm" type="submit" loading={saving}>
          Save changes
        </Button>
      </form>
    </Card>
  );
}

// ─── Password Form ───────────────────────────────────────────────────────────

export function PasswordForm({ hasPassword }: { hasPassword: boolean }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const { success, error } = useToast();

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (next !== confirm) { error('Passwords do not match'); return; }
    if (next.length < 8) { error('Password too short', 'Must be at least 8 characters'); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/user/password', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      if (res.ok) {
        success('Password updated');
        setCurrent(''); setNext(''); setConfirm('');
      } else {
        const d = await res.json();
        error('Failed', d.error ?? 'Please try again');
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card padding="lg">
      <div className="flex items-center gap-2 mb-5">
        <Key size={14} className="text-text-3" />
        <h2 className="text-sm font-[500] text-text">Password</h2>
      </div>
      <form onSubmit={handleSave} className="space-y-4">
        {hasPassword && (
          <div>
            <label className="label block mb-1.5">Current password</label>
            <Input
              type="password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              placeholder="••••••••"
            />
          </div>
        )}
        <div>
          <label className="label block mb-1.5">New password</label>
          <Input
            type="password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            placeholder="Min. 8 characters"
          />
        </div>
        <div>
          <label className="label block mb-1.5">Confirm new password</label>
          <Input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="••••••••"
          />
        </div>
        <Button variant="accent" size="sm" type="submit" loading={saving}>
          Update password
        </Button>
      </form>
    </Card>
  );
}

// ─── 2FA Form ────────────────────────────────────────────────────────────────

export function TwoFactorCard({ totpEnabled }: { totpEnabled: boolean }) {
  return (
    <Card padding="lg">
      <div className="flex items-center gap-2 mb-4">
        <Shield size={14} className="text-text-3" />
        <h2 className="text-sm font-[500] text-text">Two-factor authentication</h2>
      </div>
      <p className="text-xs text-text-2 mb-4 leading-relaxed">
        Add an extra layer of security to your account using an authenticator app.
      </p>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-[450] text-text">
            {totpEnabled ? 'Enabled' : 'Not enabled'}
          </p>
          <p className="text-[13px] text-text-3 mt-0.5">
            {totpEnabled
              ? 'Your account is protected with 2FA'
              : 'We recommend enabling 2FA for security'}
          </p>
        </div>
        <Button
          variant={totpEnabled ? 'secondary' : 'accent'}
          size="sm"
          href={totpEnabled ? '/auth/disable-2fa' : '/auth/setup-2fa'}
        >
          {totpEnabled ? 'Disable 2FA' : 'Enable 2FA'}
        </Button>
      </div>
    </Card>
  );
}

// ─── Notification Preferences ────────────────────────────────────────────────

const NOTIF_PREFS = [
  { key: 'emailOnChallenge',  label: 'Debate challenges',  desc: 'When someone challenges you' },
  { key: 'emailOnVerdict',    label: 'Verdict ready',      desc: 'When a debate verdict is in' },
  { key: 'emailOnMessage',    label: 'New messages',       desc: 'When you receive a direct message' },
  { key: 'emailOnFollow',     label: 'New followers',      desc: 'When someone follows you' },
];

export function NotificationsCard() {
  const [prefs, setPrefs] = useState<Record<string, boolean>>(
    Object.fromEntries(NOTIF_PREFS.map((p) => [p.key, true]))
  );
  const [saving, setSaving] = useState(false);
  const { success, error } = useToast();

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch('/api/user/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(prefs),
      });
      if (res.ok) success('Preferences saved');
      else error('Failed to save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card padding="lg">
      <div className="flex items-center gap-2 mb-5">
        <Bell size={14} className="text-text-3" />
        <h2 className="text-sm font-[500] text-text">Notifications</h2>
      </div>
      <div className="space-y-4">
        {NOTIF_PREFS.map((pref) => (
          <div key={pref.key} className="flex items-center justify-between">
            <div>
              <p className="text-xs font-[450] text-text">{pref.label}</p>
              <p className="text-[13px] text-text-3">{pref.desc}</p>
            </div>
            <button
              onClick={() => setPrefs((p) => ({ ...p, [pref.key]: !p[pref.key] }))}
              className={`relative h-5 w-9 rounded-full transition-colors ${
                prefs[pref.key] ? 'bg-accent' : 'bg-surface-3'
              }`}
            >
              <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-bg transition-transform ${
                prefs[pref.key] ? 'translate-x-4' : 'translate-x-0.5'
              }`} />
            </button>
          </div>
        ))}
      </div>
      <Separator className="my-4" />
      <Button variant="accent" size="sm" onClick={handleSave} loading={saving}>
        Save preferences
      </Button>
    </Card>
  );
}

// ─── Danger Zone ─────────────────────────────────────────────────────────────

export function DangerZone() {
  const [confirming, setConfirming] = useState(false);
  const [input, setInput] = useState('');
  const { error } = useToast();

  async function handleDelete() {
    if (input !== 'DELETE') {
      error('Type DELETE to confirm');
      return;
    }
    const res = await fetch('/api/user/account', { method: 'DELETE' });
    if (res.ok) {
      window.location.href = '/';
    } else {
      error('Failed to delete account');
    }
  }

  return (
    <Card padding="lg" className="border-[rgba(255,77,77,0.2)]">
      <div className="flex items-center gap-2 mb-4">
        <AlertTriangle size={14} className="text-[var(--red)]" />
        <h2 className="text-sm font-[500] text-text">Danger zone</h2>
      </div>
      <p className="text-xs text-text-2 mb-4">
        Permanently delete your account and all associated data. This cannot be undone.
      </p>
      {!confirming ? (
        <Button variant="ghost" size="sm" onClick={() => setConfirming(true)}
          className="text-[var(--red)] hover:bg-[rgba(255,77,77,0.08)] border-[rgba(255,77,77,0.3)] border">
          Delete account
        </Button>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-text-2">Type <strong className="text-text">DELETE</strong> to confirm</p>
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="DELETE"
            className="border-[rgba(255,77,77,0.3)] focus:border-[var(--red)]"
          />
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleDelete()}
              className="text-[var(--red)] hover:bg-[rgba(255,77,77,0.08)] border border-[rgba(255,77,77,0.3)]"
            >
              Confirm delete
            </Button>
            <Button variant="secondary" size="sm" onClick={() => { setConfirming(false); setInput(''); }}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
