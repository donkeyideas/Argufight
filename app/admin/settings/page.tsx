'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';
import { Save, Eye, EyeOff, RefreshCw } from 'lucide-react';

const labelCls  = 'block text-[16px] font-[500] text-text-2 mb-1.5';
const hintCls   = 'text-[15px] text-text-3 mt-1';
const sectionCls = 'space-y-4';

interface SettingField {
  key: string;
  label: string;
  hint?: string;
  sensitive?: boolean;
  type?: 'text' | 'toggle' | 'number';
}

const SECTIONS: Array<{ title: string; description: string; fields: SettingField[] }> = [
  {
    title: 'AI Provider',
    description: 'API keys for AI-powered verdicts and debate judging',
    fields: [
      { key: 'DEEPSEEK_API_KEY', label: 'DeepSeek API Key', sensitive: true, hint: 'Used for AI verdict generation' },
      { key: 'OPENAI_API_KEY',   label: 'OpenAI API Key',   sensitive: true, hint: 'Fallback AI provider' },
    ],
  },
  {
    title: 'Email (Resend)',
    description: 'Transactional email configuration',
    fields: [
      { key: 'RESEND_API_KEY', label: 'Resend API Key', sensitive: true, hint: 'Used for all platform emails' },
    ],
  },
  {
    title: 'Stripe Payments',
    description: 'Subscription and payment processing',
    fields: [
      { key: 'STRIPE_PUBLISHABLE_KEY', label: 'Stripe Publishable Key', sensitive: false, hint: 'Safe to expose (pk_live_... or pk_test_...)' },
      { key: 'STRIPE_SECRET_KEY',      label: 'Stripe Secret Key',      sensitive: true,  hint: 'Keep secret — server-side only' },
      { key: 'STRIPE_WEBHOOK_SECRET',  label: 'Stripe Webhook Secret',  sensitive: true,  hint: 'Webhook endpoint signing secret' },
    ],
  },
  {
    title: 'Google OAuth',
    description: 'Google sign-in credentials',
    fields: [
      { key: 'GOOGLE_CLIENT_ID',     label: 'Google Client ID',     sensitive: false, hint: 'Firebase OAuth Client ID' },
      { key: 'GOOGLE_CLIENT_SECRET', label: 'Google Client Secret', sensitive: true,  hint: 'Firebase OAuth Client Secret' },
    ],
  },
  {
    title: 'Google Analytics',
    description: 'Analytics and Search Console credentials',
    fields: [
      { key: 'GOOGLE_ANALYTICS_API_KEY',       label: 'GA API Key',              sensitive: true,  hint: 'Service account JSON or API key' },
      { key: 'GOOGLE_ANALYTICS_PROPERTY_ID',   label: 'GA Property ID',          sensitive: false, hint: 'e.g. 1234567890' },
      { key: 'GOOGLE_SEARCH_CONSOLE_SITE_URL', label: 'Search Console Site URL', sensitive: false, hint: 'e.g. https://argufight.com/' },
    ],
  },
  {
    title: 'Push Notifications (Firebase)',
    description: 'VAPID keys and Firebase config for web push',
    fields: [
      { key: 'FIREBASE_API_KEY',                label: 'Firebase API Key',              sensitive: true  },
      { key: 'FIREBASE_AUTH_DOMAIN',            label: 'Firebase Auth Domain',          sensitive: false },
      { key: 'FIREBASE_PROJECT_ID',             label: 'Firebase Project ID',           sensitive: false },
      { key: 'FIREBASE_STORAGE_BUCKET',         label: 'Firebase Storage Bucket',       sensitive: false },
      { key: 'FIREBASE_MESSAGING_SENDER_ID',    label: 'Firebase Messaging Sender ID',  sensitive: false },
      { key: 'FIREBASE_APP_ID',                 label: 'Firebase App ID',               sensitive: false },
      { key: 'VAPID_PUBLIC_KEY',                label: 'VAPID Public Key',              sensitive: false },
      { key: 'VAPID_PRIVATE_KEY',               label: 'VAPID Private Key',             sensitive: true  },
    ],
  },
  {
    title: 'Feature Flags',
    description: 'Enable or disable platform features',
    fields: [
      { key: 'TOURNAMENTS_ENABLED',               label: 'Tournaments',               type: 'toggle', hint: 'Allow users to create and join tournaments' },
      { key: 'ADS_PLATFORM_ENABLED',              label: 'Platform Ads',              type: 'toggle', hint: 'Show platform-wide advertisements' },
      { key: 'ADS_CREATOR_MARKETPLACE_ENABLED',   label: 'Creator Marketplace',       type: 'toggle', hint: 'Allow creators to run sponsored debates' },
    ],
  },
  {
    title: 'Creator Requirements',
    description: 'Minimum requirements for Creator Mode eligibility',
    fields: [
      { key: 'CREATOR_MIN_ELO',                  label: 'Minimum ELO',              type: 'number', hint: 'Default: 1500' },
      { key: 'CREATOR_MIN_DEBATES',              label: 'Minimum Debates',          type: 'number', hint: 'Default: 10' },
      { key: 'CREATOR_MIN_ACCOUNT_AGE_MONTHS',   label: 'Min Account Age (months)', type: 'number', hint: 'Default: 3' },
    ],
  },
  {
    title: 'Creator Platform Fees',
    description: 'Platform fee percentage per subscription tier',
    fields: [
      { key: 'CREATOR_FEE_BRONZE',   label: 'Bronze Tier Fee (%)',   type: 'number', hint: 'Default: 25' },
      { key: 'CREATOR_FEE_SILVER',   label: 'Silver Tier Fee (%)',   type: 'number', hint: 'Default: 20' },
      { key: 'CREATOR_FEE_GOLD',     label: 'Gold Tier Fee (%)',     type: 'number', hint: 'Default: 15' },
      { key: 'CREATOR_FEE_PLATINUM', label: 'Platinum Tier Fee (%)', type: 'number', hint: 'Default: 10' },
    ],
  },
];

function SecretInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder ?? '••••••••'}
        className="w-full h-9 pl-3 pr-9 bg-surface-2 border border-border rounded-[var(--radius)] text-[17px] text-text placeholder:text-text-3 focus:outline-none focus:border-border-2 font-mono"
      />
      <button
        type="button"
        onClick={() => setShow(p => !p)}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-3 hover:text-text-2"
      >
        {show ? <EyeOff size={13} /> : <Eye size={13} />}
      </button>
    </div>
  );
}

export default function AdminSettingsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState<Set<string>>(new Set());
  const [testResults, setTestResults] = useState<Record<string, { ok: boolean; msg: string }>>({});

  const { data: settings, isLoading } = useQuery<Record<string, string>>({
    queryKey: ['admin-settings'],
    queryFn: async () => {
      const res = await fetch('/api/admin/settings');
      if (!res.ok) throw new Error('Failed to load settings');
      return res.json();
    },
    staleTime: 0,
  });

  useEffect(() => {
    if (settings) setFormValues(settings);
  }, [settings]);

  const setValue = (key: string, val: string) => {
    setFormValues(prev => ({ ...prev, [key]: val }));
    setDirty(prev => new Set([...prev, key]));
  };

  const saveMutation = useMutation({
    mutationFn: async (updates: Record<string, string>) => {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error('Failed to save');
    },
    onSuccess: () => {
      toast({ type: 'success', title: 'Settings saved' });
      setDirty(new Set());
      queryClient.invalidateQueries({ queryKey: ['admin-settings'] });
    },
    onError: () => toast({ type: 'error', title: 'Failed to save settings' }),
  });

  const saveSection = (fields: SettingField[]) => {
    const updates: Record<string, string> = {};
    fields.forEach(f => { updates[f.key] = formValues[f.key] ?? ''; });
    saveMutation.mutate(updates);
  };

  const testConnection = async (type: 'deepseek' | 'resend' | 'stripe' | 'google-analytics') => {
    try {
      const res = await fetch(`/api/admin/settings/test-${type}`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setTestResults(prev => ({ ...prev, [type]: { ok: true, msg: data.message || 'Connected successfully' } }));
        toast({ type: 'success', title: `${type} connected`, description: data.message });
      } else {
        setTestResults(prev => ({ ...prev, [type]: { ok: false, msg: data.error || 'Connection failed' } }));
        toast({ type: 'error', title: `${type} test failed`, description: data.error });
      }
    } catch {
      toast({ type: 'error', title: 'Test failed', description: 'Could not reach the service' });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 rounded-full border-2 border-border border-t-accent animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-[600] text-text tracking-[-0.3px]">Platform Settings</h1>
          <p className="text-[17px] text-text-3 mt-0.5">API keys, feature flags, and platform configuration</p>
        </div>
        {dirty.size > 0 && (
          <p className="text-[16px] text-[var(--amber)]">{dirty.size} unsaved change{dirty.size !== 1 ? 's' : ''}</p>
        )}
      </div>

      {SECTIONS.map(section => {
        const sectionDirty = section.fields.some(f => dirty.has(f.key));
        return (
          <Card key={section.title} padding="none">
            <div className="flex items-start justify-between p-4 border-b border-border">
              <div>
                <h2 className="text-[16px] font-[500] text-text">{section.title}</h2>
                <p className="text-[16px] text-text-3 mt-0.5">{section.description}</p>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => saveSection(section.fields)}
                loading={saveMutation.isPending}
                className={sectionDirty ? 'border-accent text-accent' : ''}
              >
                <Save size={12} className="mr-1.5" />
                Save
              </Button>
            </div>

            <div className="p-4 space-y-4">
              {section.fields.map(field => {
                if (field.type === 'toggle') {
                  const isOn = formValues[field.key] === 'true';
                  return (
                    <div key={field.key} className="flex items-center justify-between py-1">
                      <div>
                        <p className="text-[17px] text-text font-[450]">{field.label}</p>
                        {field.hint && <p className={hintCls}>{field.hint}</p>}
                      </div>
                      <button
                        onClick={() => setValue(field.key, isOn ? 'false' : 'true')}
                        className={`relative w-10 h-5 rounded-full transition-colors ${isOn ? 'bg-accent' : 'bg-surface-3'}`}
                      >
                        <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${isOn ? 'translate-x-5' : ''}`} />
                      </button>
                    </div>
                  );
                }

                return (
                  <div key={field.key}>
                    <label className={labelCls}>{field.label}</label>
                    {field.sensitive ? (
                      <SecretInput
                        value={formValues[field.key] ?? ''}
                        onChange={v => setValue(field.key, v)}
                      />
                    ) : (
                      <Input
                        type={field.type === 'number' ? 'number' : 'text'}
                        value={formValues[field.key] ?? ''}
                        onChange={e => setValue(field.key, e.target.value)}
                        placeholder={field.hint}
                      />
                    )}
                    {field.hint && <p className={hintCls}>{field.hint}</p>}
                  </div>
                );
              })}

              {/* Connection test buttons */}
              {section.title === 'AI Provider' && (
                <div className="flex items-center gap-3 pt-2 border-t border-border">
                  <Button variant="secondary" size="sm" onClick={() => testConnection('deepseek')}>
                    <RefreshCw size={12} className="mr-1.5" />
                    Test DeepSeek
                  </Button>
                  {testResults['deepseek'] && (
                    <p className={`text-[15px] ${testResults['deepseek'].ok ? 'text-[var(--green)]' : 'text-[var(--red)]'}`}>
                      {testResults['deepseek'].msg}
                    </p>
                  )}
                </div>
              )}
              {section.title === 'Email (Resend)' && (
                <div className="flex items-center gap-3 pt-2 border-t border-border">
                  <Button variant="secondary" size="sm" onClick={() => testConnection('resend')}>
                    <RefreshCw size={12} className="mr-1.5" />
                    Test Resend
                  </Button>
                  {testResults['resend'] && (
                    <p className={`text-[15px] ${testResults['resend'].ok ? 'text-[var(--green)]' : 'text-[var(--red)]'}`}>
                      {testResults['resend'].msg}
                    </p>
                  )}
                </div>
              )}
              {section.title === 'Stripe Payments' && (
                <div className="flex items-center gap-3 pt-2 border-t border-border">
                  <Button variant="secondary" size="sm" onClick={() => testConnection('stripe')}>
                    <RefreshCw size={12} className="mr-1.5" />
                    Test Stripe
                  </Button>
                  {testResults['stripe'] && (
                    <p className={`text-[15px] ${testResults['stripe'].ok ? 'text-[var(--green)]' : 'text-[var(--red)]'}`}>
                      {testResults['stripe'].msg}
                    </p>
                  )}
                </div>
              )}
              {section.title === 'Google Analytics' && (
                <div className="flex items-center gap-3 pt-2 border-t border-border">
                  <Button variant="secondary" size="sm" onClick={() => testConnection('google-analytics')}>
                    <RefreshCw size={12} className="mr-1.5" />
                    Test GA Connection
                  </Button>
                  {testResults['google-analytics'] && (
                    <p className={`text-[15px] ${testResults['google-analytics'].ok ? 'text-[var(--green)]' : 'text-[var(--red)]'}`}>
                      {testResults['google-analytics'].msg}
                    </p>
                  )}
                </div>
              )}
            </div>
          </Card>
        );
      })}

      {/* Raw settings dump */}
      <Card padding="none">
        <div className="p-4 border-b border-border">
          <h2 className="text-[16px] font-[500] text-text">All Settings</h2>
          <p className="text-[16px] text-text-3 mt-0.5">All stored admin_settings key-value pairs</p>
        </div>
        <div className="divide-y divide-border">
          {Object.entries(formValues).map(([key, value]) => {
            const isSensitive = /secret|password|token|key|private/i.test(key);
            return (
              <div key={key} className="grid grid-cols-[2fr_3fr] gap-4 px-4 py-2.5 hover:bg-surface-2 transition-colors">
                <p className="text-[15px] text-text font-mono">{key}</p>
                <p className="text-[15px] text-text-2 font-mono truncate">
                  {isSensitive ? '••••••••' : value || <span className="text-text-3 italic">empty</span>}
                </p>
              </div>
            );
          })}
          {Object.keys(formValues).length === 0 && (
            <div className="px-4 py-8 text-center">
              <p className="text-[17px] text-text-3">No settings stored in database.</p>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
