'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';

interface SEOSettings {
  siteTitle: string; siteDescription: string; defaultOgImage: string;
  twitterCardType: string; googleAnalyticsId: string; googleSearchConsoleVerification: string;
  canonicalUrlBase: string; organizationName: string; organizationLogo: string;
  organizationDescription: string; organizationContactInfo: string;
  organizationSocialFacebook: string; organizationSocialTwitter: string;
  organizationSocialLinkedIn: string; organizationSocialInstagram: string;
  organizationSocialYouTube: string;
}

const defaultSettings: SEOSettings = {
  siteTitle: '', siteDescription: '', defaultOgImage: '', twitterCardType: 'summary_large_image',
  googleAnalyticsId: '', googleSearchConsoleVerification: '', canonicalUrlBase: '',
  organizationName: '', organizationLogo: '', organizationDescription: '', organizationContactInfo: '',
  organizationSocialFacebook: '', organizationSocialTwitter: '', organizationSocialLinkedIn: '',
  organizationSocialInstagram: '', organizationSocialYouTube: '',
};

const selectCls = 'w-full h-9 px-3 bg-surface-2 border border-border rounded-[var(--radius)] text-[17px] text-text focus:outline-none focus:border-border-2';
const labelCls  = 'block text-[16px] font-[500] text-text-2 mb-1.5';

export default function SettingsTab() {
  const { toast }    = useToast();
  const searchParams = useSearchParams();

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving]   = useState(false);
  const [settings, setSettings]   = useState<SEOSettings>(defaultSettings);

  const [gscClientId, setGscClientId]   = useState('');
  const [gscClientSecret, setGscClientSecret] = useState('');
  const [gscSiteUrl, setGscSiteUrl]     = useState('');
  const [gscConnected, setGscConnected] = useState(false);
  const [gscConnecting, setGscConnecting]   = useState(false);
  const [gscSavingCreds, setGscSavingCreds] = useState(false);
  const [gscCredsSaved, setGscCredsSaved]   = useState(false);
  const [gscTesting, setGscTesting]     = useState(false);
  const [gscTestResult, setGscTestResult] = useState<{
    success: boolean; error?: string; configuredSiteUrl: string;
    availableSites: Array<{ siteUrl: string; permissionLevel: string }>; siteAccessible: boolean;
  } | null>(null);

  useEffect(() => {
    fetchSettings();
    checkGscStatus();
    if (searchParams.get('gsc') === 'connected') {
      toast({ type: 'success', title: 'Connected', description: 'Google Search Console connected successfully' });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchSettings = async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/admin/seo');
      if (res.ok) {
        const data = await res.json();
        const s = data.settings || {};
        setSettings({ ...defaultSettings, ...s });
        if (s.gsc_client_id) { setGscClientId(s.gsc_client_id); setGscCredsSaved(true); }
        if (s.gsc_site_url)   setGscSiteUrl(s.gsc_site_url);
      }
    } catch { /* noop */ } finally { setIsLoading(false); }
  };

  const checkGscStatus = async () => {
    try {
      const res = await fetch('/api/admin/seo-geo/search-console/test');
      if (res.ok) {
        const data = await res.json();
        setGscConnected(!!data.configuredSiteUrl);
      } else {
        const sr = await fetch('/api/admin/seo');
        if (sr.ok) {
          const sd = await sr.json();
          setGscConnected(!!(sd.settings || {}).gsc_refresh_token);
        }
      }
    } catch { /* noop */ }
  };

  const handleSaveGscCredentials = async () => {
    if (!gscClientId.trim() || (!gscCredsSaved && !gscClientSecret.trim()) || !gscSiteUrl.trim()) {
      toast({ type: 'error', title: 'Missing Fields', description: 'Please fill in Client ID, Client Secret, and Site URL' });
      return;
    }
    setGscSavingCreds(true);
    try {
      const payload: Record<string, string> = { gsc_client_id: gscClientId.trim(), gsc_site_url: gscSiteUrl.trim() };
      if (gscClientSecret.trim()) payload.gsc_client_secret = gscClientSecret.trim();
      const res = await fetch('/api/admin/seo', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      });
      if (res.ok) {
        setGscCredsSaved(true);
        toast({ type: 'success', title: 'Credentials Saved', description: 'GSC credentials saved. Now click "Connect" to authorize.' });
      }
    } catch {
      toast({ type: 'error', title: 'Error', description: 'Failed to save GSC credentials' });
    } finally { setGscSavingCreds(false); }
  };

  const handleConnectGsc = async () => {
    setGscConnecting(true);
    try {
      if (gscClientId.trim() && gscClientSecret.trim()) await handleSaveGscCredentials();
      const res = await fetch('/api/admin/seo-geo/search-console/auth');
      if (res.ok) {
        const data = await res.json();
        if (data.authUrl) { window.location.href = data.authUrl; return; }
      } else {
        const err = await res.json();
        toast({ type: 'error', title: 'Connection Failed', description: err.error || 'Failed to initiate OAuth flow' });
      }
    } catch {
      toast({ type: 'error', title: 'Error', description: 'Failed to connect to Google Search Console' });
    } finally { setGscConnecting(false); }
  };

  const handleDisconnectGsc = async () => {
    try {
      const res = await fetch('/api/admin/seo-geo/search-console/auth', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'disconnect' }),
      });
      if (res.ok) { setGscConnected(false); toast({ type: 'success', title: 'Disconnected', description: 'Google Search Console disconnected' }); }
    } catch {
      toast({ type: 'error', title: 'Error', description: 'Failed to disconnect' });
    }
  };

  const handleTestGsc = async () => {
    setGscTesting(true); setGscTestResult(null);
    try {
      const res = await fetch('/api/admin/seo-geo/search-console/test');
      const result = await res.json();
      setGscTestResult(result);
      if (result.success) {
        toast({ type: 'success', title: 'Connection OK', description: 'Successfully connected to Google Search Console' });
      } else {
        toast({ type: 'error', title: 'Connection Issue', description: result.error || 'Check the details below' });
      }
    } catch {
      toast({ type: 'error', title: 'Test Failed', description: 'Failed to test GSC connection' });
    } finally { setGscTesting(false); }
  };

  const handleFixSiteUrl = async (correctUrl: string) => {
    try {
      const res = await fetch('/api/admin/seo', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: { gsc_site_url: correctUrl } }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Save failed');
      setGscSiteUrl(correctUrl);
      toast({ type: 'success', title: 'Site URL Updated', description: `Updated to ${correctUrl}` });
      setTimeout(() => handleTestGsc(), 500);
    } catch (err) {
      toast({ type: 'error', title: 'Error', description: err instanceof Error ? err.message : 'Failed to update site URL' });
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const gscKeys = ['gsc_client_id', 'gsc_client_secret', 'gsc_refresh_token', 'gsc_site_url'];
      const filtered = Object.fromEntries(Object.entries(settings).filter(([k]) => !gscKeys.includes(k)));
      const res = await fetch('/api/admin/seo', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(filtered),
      });
      if (res.ok) {
        toast({ type: 'success', title: 'Saved', description: 'SEO settings saved successfully' });
      } else {
        throw new Error('Failed to save');
      }
    } catch {
      toast({ type: 'error', title: 'Save Failed', description: 'Failed to save SEO settings' });
    } finally { setIsSaving(false); }
  };

  const handleRegenerateSitemap = async () => {
    try {
      const res = await fetch('/api/admin/seo/sitemap/regenerate', { method: 'POST' });
      if (res.ok) {
        toast({ type: 'success', title: 'Sitemap Regenerated', description: 'Sitemap has been regenerated successfully' });
      } else {
        throw new Error('Failed to regenerate');
      }
    } catch {
      toast({ type: 'error', title: 'Error', description: 'Failed to regenerate sitemap' });
    }
  };

  const set = (key: keyof SEOSettings, val: string) => setSettings((prev) => ({ ...prev, [key]: val }));

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 rounded-full border-2 border-border border-t-accent animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-[600] text-text">SEO &amp; GEO Settings</h2>
        <p className="text-[17px] text-text-3">Manage global SEO settings, structured data, and integrations</p>
      </div>

      {/* Global SEO Settings */}
      <Card padding="none">
        <div className="p-4 border-b border-border">
          <h3 className="text-[16px] font-[500] text-text">Global SEO Settings</h3>
        </div>
        <div className="p-4 space-y-4">
          <div><label className={labelCls}>Site Title</label><Input value={settings.siteTitle} onChange={(e) => set('siteTitle', e.target.value)} placeholder="Argufight | AI-Judged Debate Platform" /></div>
          <div>
            <label className={labelCls}>Site Description</label>
            <Textarea value={settings.siteDescription} onChange={(e) => set('siteDescription', e.target.value)} rows={3} maxLength={160} placeholder="Default meta description for the site" />
            <p className="text-[15px] text-text-3 mt-1">{(settings.siteDescription || '').length}/160 characters</p>
          </div>
          <div><label className={labelCls}>Default OG Image URL</label><Input value={settings.defaultOgImage} onChange={(e) => set('defaultOgImage', e.target.value)} placeholder="https://www.argufight.com/og-image.png" /></div>
          <div>
            <label className={labelCls}>Twitter Card Type</label>
            <select value={settings.twitterCardType} onChange={(e) => set('twitterCardType', e.target.value)} className={selectCls}>
              <option value="summary">Summary</option>
              <option value="summary_large_image">Summary Large Image</option>
            </select>
          </div>
          <div><label className={labelCls}>Canonical URL Base</label><Input value={settings.canonicalUrlBase} onChange={(e) => set('canonicalUrlBase', e.target.value)} placeholder="https://www.argufight.com" /></div>
        </div>
      </Card>

      {/* Analytics & Verification */}
      <Card padding="none">
        <div className="p-4 border-b border-border">
          <h3 className="text-[16px] font-[500] text-text">Analytics &amp; Verification</h3>
        </div>
        <div className="p-4 space-y-4">
          <div><label className={labelCls}>Google Analytics ID</label><Input value={settings.googleAnalyticsId} onChange={(e) => set('googleAnalyticsId', e.target.value)} placeholder="G-XXXXXXXXXX" /></div>
          <div><label className={labelCls}>Google Search Console Verification Code</label><Input value={settings.googleSearchConsoleVerification} onChange={(e) => set('googleSearchConsoleVerification', e.target.value)} placeholder="Verification meta tag content" /></div>
        </div>
      </Card>

      {/* Google Search Console API */}
      <Card padding="none">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h3 className="text-[16px] font-[500] text-text">Google Search Console API</h3>
          {gscConnected && (
            <span className="px-2 py-0.5 rounded-full text-[15px] font-[500] bg-[rgba(77,255,145,0.15)] text-[var(--green)]">Connected</span>
          )}
        </div>
        <div className="p-4 space-y-4">
          <p className="text-[17px] text-text-3">
            Connect Google Search Console to see real-time ranking data, search queries, impressions, clicks, and average position.
          </p>

          {gscConnected ? (
            <div className="space-y-4">
              <div className="p-4 bg-[rgba(77,255,145,0.05)] border border-[rgba(77,255,145,0.2)] rounded-[var(--radius)]">
                <p className="text-[var(--green)] text-[17px] mb-3">
                  Google Search Console is connected. Ranking data is available in the Search Console tab.
                </p>
                <div className="flex gap-3">
                  <Button variant="secondary" size="sm" onClick={handleTestGsc} loading={gscTesting}>Test Connection</Button>
                  <Button variant="danger" size="sm" onClick={handleDisconnectGsc}>Disconnect GSC</Button>
                </div>
              </div>

              {gscTestResult && (
                <div className={`p-4 rounded-[var(--radius)] border ${
                  gscTestResult.success
                    ? 'bg-[rgba(77,255,145,0.05)] border-[rgba(77,255,145,0.2)]'
                    : 'bg-[rgba(255,77,77,0.05)] border-[rgba(255,77,77,0.2)]'
                }`}>
                  <h4 className={`text-[17px] font-[500] mb-2 ${gscTestResult.success ? 'text-[var(--green)]' : 'text-[var(--red)]'}`}>
                    {gscTestResult.success ? 'Connection Successful' : 'Connection Issue'}
                  </h4>
                  {gscTestResult.error && <p className="text-[var(--red)] text-[17px] mb-3">{gscTestResult.error}</p>}
                  {gscTestResult.configuredSiteUrl && (
                    <p className="text-text-3 text-[16px] mb-2">Configured URL: <code className="text-text">{gscTestResult.configuredSiteUrl}</code></p>
                  )}
                  {gscTestResult.availableSites.length > 0 && (
                    <div>
                      <p className="text-text-3 text-[16px] mb-2">Available sites in your Search Console:</p>
                      <div className="space-y-1">
                        {gscTestResult.availableSites.map((site) => (
                          <div key={site.siteUrl} className="flex items-center gap-2">
                            <code className={`text-[15px] px-2 py-1 rounded ${
                              site.siteUrl === gscTestResult.configuredSiteUrl
                                ? 'bg-[rgba(77,255,145,0.1)] text-[var(--green)]'
                                : 'bg-surface-2 text-text'
                            }`}>{site.siteUrl}</code>
                            <span className="text-text-3 text-[15px]">({site.permissionLevel})</span>
                            {site.siteUrl !== gscTestResult.configuredSiteUrl && (
                              <button onClick={() => handleFixSiteUrl(site.siteUrl)} className="text-accent text-[15px] hover:underline">Use this</button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <>
              <div className="p-3 bg-surface-2 rounded-[var(--radius)] border border-border">
                <p className="text-text-3 text-[16px] mb-1">
                  <strong className="text-text">Setup:</strong> Create a Google Cloud project, enable the Search Console API, and create OAuth 2.0 credentials (Web application type).
                </p>
                <p className="text-text-3 text-[16px]">
                  <strong className="text-text">Redirect URI:</strong>{' '}
                  <code className="text-accent text-[15px] bg-surface-3 px-1 rounded">https://www.argufight.com/api/admin/seo-geo/search-console/auth</code>
                </p>
              </div>

              <div><label className={labelCls}>OAuth Client ID</label><Input value={gscClientId} onChange={(e) => setGscClientId(e.target.value)} placeholder="xxxx.apps.googleusercontent.com" /></div>
              <div><label className={labelCls}>OAuth Client Secret</label><Input type="password" value={gscClientSecret} onChange={(e) => setGscClientSecret(e.target.value)} placeholder={gscCredsSaved ? '(saved — enter new value to update)' : 'GOCSPX-...'} /></div>
              <div>
                <label className={labelCls}>Site URL</label>
                <Input value={gscSiteUrl} onChange={(e) => setGscSiteUrl(e.target.value)} placeholder="https://www.argufight.com" />
                <p className="text-[15px] text-text-3 mt-1">Must match the property URL in Google Search Console exactly</p>
              </div>

              <div className="flex gap-3">
                <Button variant="secondary" onClick={handleSaveGscCredentials} loading={gscSavingCreds}>Save Credentials</Button>
                <Button variant="accent" onClick={handleConnectGsc} loading={gscConnecting}
                  disabled={!gscCredsSaved && (!gscClientId.trim() || !gscClientSecret.trim())}>
                  Connect to Google
                </Button>
              </div>

              {gscTestResult && (
                <div className={`p-4 rounded-[var(--radius)] border ${
                  gscTestResult.success
                    ? 'bg-[rgba(77,255,145,0.05)] border-[rgba(77,255,145,0.2)]'
                    : 'bg-[rgba(255,77,77,0.05)] border-[rgba(255,77,77,0.2)]'
                }`}>
                  {gscTestResult.error && <p className="text-[var(--red)] text-[17px] mb-2">{gscTestResult.error}</p>}
                  {gscTestResult.availableSites.length > 0 && (
                    <div>
                      <p className="text-text-3 text-[16px] mb-2">Available sites:</p>
                      <div className="space-y-1">
                        {gscTestResult.availableSites.map((site) => (
                          <div key={site.siteUrl} className="flex items-center gap-2">
                            <code className="text-[15px] px-2 py-1 rounded bg-surface-2 text-text">{site.siteUrl}</code>
                            <button onClick={() => handleFixSiteUrl(site.siteUrl)} className="text-accent text-[15px] hover:underline">Use this</button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </Card>

      {/* Organization Schema */}
      <Card padding="none">
        <div className="p-4 border-b border-border">
          <h3 className="text-[16px] font-[500] text-text">Organization (Schema.org)</h3>
        </div>
        <div className="p-4 space-y-4">
          <div><label className={labelCls}>Organization Name</label><Input value={settings.organizationName} onChange={(e) => set('organizationName', e.target.value)} placeholder="Argufight" /></div>
          <div><label className={labelCls}>Organization Logo URL</label><Input value={settings.organizationLogo} onChange={(e) => set('organizationLogo', e.target.value)} placeholder="https://www.argufight.com/logo.png" /></div>
          <div><label className={labelCls}>Organization Description</label><Textarea value={settings.organizationDescription} onChange={(e) => set('organizationDescription', e.target.value)} rows={3} placeholder="Description of your organization" /></div>
          <div><label className={labelCls}>Contact Information</label><Input value={settings.organizationContactInfo} onChange={(e) => set('organizationContactInfo', e.target.value)} placeholder="info@argufight.com" /></div>
        </div>
      </Card>

      {/* Social Media */}
      <Card padding="none">
        <div className="p-4 border-b border-border">
          <h3 className="text-[16px] font-[500] text-text">Social Media Profiles</h3>
        </div>
        <div className="p-4 space-y-4">
          {([
            ['organizationSocialFacebook',  'Facebook URL',   'https://facebook.com/argufight'],
            ['organizationSocialTwitter',   'Twitter/X URL',  'https://twitter.com/argufight'],
            ['organizationSocialLinkedIn',  'LinkedIn URL',   'https://linkedin.com/company/argufight'],
            ['organizationSocialInstagram', 'Instagram URL',  'https://instagram.com/argufight'],
            ['organizationSocialYouTube',   'YouTube URL',    'https://youtube.com/@argufight'],
          ] as const).map(([key, label, placeholder]) => (
            <div key={key}>
              <label className={labelCls}>{label}</label>
              <Input value={settings[key as keyof SEOSettings]} onChange={(e) => set(key as keyof SEOSettings, e.target.value)} placeholder={placeholder} />
            </div>
          ))}
        </div>
      </Card>

      {/* Sitemap */}
      <Card padding="md">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[17px] font-[500] text-text mb-1">Sitemap</p>
            <p className="text-[16px] text-text-3">
              Your sitemap is automatically generated and available at{' '}
              <a href="/sitemap.xml" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">/sitemap.xml</a>
            </p>
          </div>
          <Button variant="secondary" onClick={handleRegenerateSitemap}>Regenerate Sitemap</Button>
        </div>
      </Card>

      {/* Save */}
      <div className="flex justify-end">
        <Button variant="accent" onClick={handleSave} loading={isSaving}>Save All Settings</Button>
      </div>
    </div>
  );
}
