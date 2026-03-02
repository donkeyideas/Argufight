'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';

interface GSCData {
  connected: boolean;
  totals?: { clicks: number; impressions: number; ctr: number; position: number };
  dateData?: Array<{ date: string; clicks: number; impressions: number; ctr: number; position: number }>;
  queries?: Array<{ query: string; clicks: number; impressions: number; ctr: number; position: number }>;
  pages?: Array<{ page: string; clicks: number; impressions: number; ctr: number; position: number }>;
  countries?: Array<{ country: string; clicks: number; impressions: number }>;
  devices?: Array<{ device: string; clicks: number; impressions: number }>;
}

const COLORS = ['var(--accent)', 'var(--amber)', 'var(--red)', 'var(--green)', 'var(--blue)'];
const TIME_RANGES = [
  { key: '7d',  label: '7 days',   days: 7 },
  { key: '28d', label: '28 days',  days: 28 },
  { key: '90d', label: '3 months', days: 90 },
];

const tooltipStyle = {
  backgroundColor: 'var(--surface-2)',
  border: '1px solid var(--border)',
  borderRadius: '8px',
  color: 'var(--text)',
  fontSize: 12,
};

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

export default function SearchConsoleTab({ onTabChange }: { onTabChange: (tab: string) => void }) {
  const [data, setData]               = useState<GSCData | null>(null);
  const [isLoading, setIsLoading]     = useState(true);
  const [error, setError]             = useState<string | null>(null);
  const [needsReconnect, setNeedsReconnect] = useState(false);
  const [timeRange, setTimeRange]     = useState('28d');
  const [sortConfig, setSortConfig]   = useState<{ table: string; key: string; dir: 'asc' | 'desc' }>({ table: '', key: 'clicks', dir: 'desc' });

  useEffect(() => { fetchData(); }, [timeRange]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const days  = TIME_RANGES.find((r) => r.key === timeRange)?.days || 28;
      const end   = new Date();
      const start = new Date();
      start.setDate(start.getDate() - days);
      const startDate = start.toISOString().split('T')[0];
      const endDate   = end.toISOString().split('T')[0];
      const res = await fetch(`/api/admin/seo-geo/search-console?type=overview&startDate=${startDate}&endDate=${endDate}`);
      const result = await res.json();
      if (res.ok) {
        setData(result);
        setError(null);
        setNeedsReconnect(false);
      } else {
        const debugInfo = result.debugSiteUrl ? ` (using site: ${result.debugSiteUrl})` : '';
        setError((result.message || result.error || 'Failed to fetch data') + debugInfo);
        setNeedsReconnect(result.needsReconnect || false);
        if (result.connected === false) setData({ connected: false });
      }
    } catch { setError('Network error fetching Search Console data'); }
    finally { setIsLoading(false); }
  };

  const handleReconnect = async () => {
    try {
      await fetch('/api/admin/seo-geo/search-console/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'disconnect' }),
      });
    } finally { onTabChange('settings'); }
  };

  const handleSort = (table: string, key: string) => {
    setSortConfig((prev) => ({
      table, key,
      dir: prev.table === table && prev.key === key && prev.dir === 'desc' ? 'asc' : 'desc',
    }));
  };

  const sortData = <T extends Record<string, unknown>>(items: T[], table: string, key: string): T[] => {
    if (sortConfig.table !== table) return items;
    return [...items].sort((a, b) => {
      const aVal = (a[key] as number) || 0;
      const bVal = (b[key] as number) || 0;
      return sortConfig.dir === 'desc' ? bVal - aVal : aVal - bVal;
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 rounded-full border-2 border-border border-t-accent animate-spin" />
      </div>
    );
  }

  // Error state (connected but data fetch failed)
  if (error && data?.connected !== false) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-[600] text-text">Google Search Console</h2>
          <p className="text-[17px] text-text-3">Connect Google Search Console to see how your site performs in Google Search</p>
        </div>
        <Card padding="lg">
          <div className="max-w-lg mx-auto text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[rgba(255,77,77,0.1)] flex items-center justify-center">
              <svg className="w-8 h-8 text-[var(--red)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h3 className="text-[18px] font-[500] text-text mb-2">Error Fetching Data</h3>
            <p className="text-[var(--red)] text-sm mb-2">{error}</p>
            <p className="text-[17px] text-text-3 mb-6">
              {needsReconnect
                ? 'Your Google authorization has expired or been revoked. Please reconnect to continue.'
                : 'Search Console is connected but there was an error fetching data. This may be a site URL mismatch or permission issue.'}
            </p>
            <div className="flex gap-3 justify-center">
              {needsReconnect ? (
                <Button variant="accent" onClick={handleReconnect}>Reconnect Google</Button>
              ) : (
                <>
                  <Button variant="secondary" onClick={fetchData}>Retry</Button>
                  <Button variant="secondary" onClick={() => onTabChange('settings')}>Check Settings</Button>
                </>
              )}
            </div>
          </div>
        </Card>
      </div>
    );
  }

  // Not connected state
  if (!data?.connected) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-[600] text-text">Google Search Console</h2>
          <p className="text-[17px] text-text-3">Connect Google Search Console to see how your site performs in Google Search</p>
        </div>
        <Card padding="lg">
          <div className="max-w-lg mx-auto text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-surface-3 flex items-center justify-center">
              <svg className="w-8 h-8 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <h3 className="text-[18px] font-[500] text-text mb-2">Search Console Not Connected</h3>
            <p className="text-[17px] text-text-3 mb-6">
              Connect Google Search Console to see real ranking data, search queries, impressions, clicks, and average position.
            </p>
            <Button variant="secondary" onClick={() => onTabChange('settings')}>Configure in Settings</Button>
          </div>
        </Card>

        <Card padding="none">
          <div className="p-4 border-b border-border">
            <h3 className="text-[16px] font-[500] text-text">Setup Instructions</h3>
          </div>
          <div className="p-4">
            <ol className="space-y-3 text-[17px] text-text-3">
              {[
                <>Create a project in <span className="text-text">Google Cloud Console</span> and enable the Search Console API</>,
                'Create OAuth 2.0 credentials (Client ID and Client Secret)',
                <>Verify your site in <span className="text-text">Google Search Console</span></>,
                <>Enter credentials in the <button onClick={() => onTabChange('settings')} className="text-accent hover:underline">Settings tab</button>, then click &quot;Connect&quot;</>,
              ].map((step, i) => (
                <li key={i} className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[rgba(212,240,80,0.1)] text-accent flex items-center justify-center text-xs font-[600]">{i + 1}</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </div>
        </Card>
      </div>
    );
  }

  // Connected — full dashboard
  const chartData = (data.dateData || [])
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((d) => ({
      ...d,
      date: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      ctrPercent:    Math.round(d.ctr * 10000) / 100,
      positionRound: Math.round(d.position * 10) / 10,
    }));

  const sortedQueries = sortData(data.queries || [], 'queries', sortConfig.key);
  const sortedPages   = sortData(data.pages   || [], 'pages',   sortConfig.key);

  const SortHeader = ({ table, colKey, label, className }: { table: string; colKey: string; label: string; className?: string }) => (
    <th
      className={`py-2 px-3 text-[15px] font-[500] text-text-3 uppercase tracking-wide cursor-pointer hover:text-text-2 transition-colors ${className || 'text-right'}`}
      onClick={() => handleSort(table, colKey)}
    >
      {label}{sortConfig.table === table && sortConfig.key === colKey && (sortConfig.dir === 'desc' ? ' ↓' : ' ↑')}
    </th>
  );

  return (
    <div className="space-y-6">
      {/* Header + time range */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-xl font-[600] text-text">Google Search Console</h2>
          <p className="text-[17px] text-text-3">Search performance data from Google</p>
        </div>
        <div className="flex gap-1 bg-surface-2 rounded-[var(--radius)] p-1">
          {TIME_RANGES.map((range) => (
            <button
              key={range.key}
              onClick={() => setTimeRange(range.key)}
              className={[
                'px-3 py-1.5 rounded-[var(--radius-sm)] text-[17px] font-[500] transition-colors',
                timeRange === range.key
                  ? 'bg-accent text-accent-fg'
                  : 'text-text-3 hover:text-text-2',
              ].join(' ')}
            >
              {range.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      {data.totals && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Impressions', value: formatNumber(data.totals.impressions), color: 'text-text' },
            { label: 'Total Clicks',      value: formatNumber(data.totals.clicks),      color: 'text-accent' },
            { label: 'Average Position',  value: (Math.round(data.totals.position * 10) / 10).toString(), color: 'text-text' },
            { label: 'Average CTR',       value: `${(data.totals.ctr * 100).toFixed(1)}%`, color: 'text-[var(--green)]' },
          ].map(({ label, value, color }) => (
            <Card key={label} padding="md">
              <p className="text-[15px] text-text-3">{label}</p>
              <p className={`text-2xl font-[300] mt-1 ${color}`}>{value}</p>
            </Card>
          ))}
        </div>
      )}

      {/* Performance Chart */}
      {chartData.length > 0 && (
        <Card padding="none">
          <div className="p-4 border-b border-border">
            <h3 className="text-[16px] font-[500] text-text">Performance Over Time</h3>
          </div>
          <div className="p-4">
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="date" stroke="var(--border)" tick={{ fill: 'var(--text-3)', fontSize: 11 }} interval="preserveStartEnd" />
                <YAxis yAxisId="left"  stroke="var(--border)" tick={{ fill: 'var(--text-3)', fontSize: 11 }} />
                <YAxis yAxisId="right" orientation="right" stroke="var(--border)" tick={{ fill: 'var(--text-3)', fontSize: 11 }} reversed />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend />
                <Line yAxisId="left"  type="monotone" dataKey="clicks"      stroke="var(--accent)"  strokeWidth={2}   name="Clicks"      dot={false} />
                <Line yAxisId="left"  type="monotone" dataKey="impressions" stroke="var(--blue)"    strokeWidth={1.5} name="Impressions"  dot={false} strokeDasharray="5 5" />
                <Line yAxisId="right" type="monotone" dataKey="positionRound" stroke="var(--amber)" strokeWidth={1.5} name="Position"     dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      {/* Top Queries + Top Pages */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card padding="none">
          <div className="p-4 border-b border-border">
            <h3 className="text-[16px] font-[500] text-text">Top Queries</h3>
          </div>
          <div className="p-4">
            {sortedQueries.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-[17px]">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 px-3 text-[15px] font-[500] text-text-3 uppercase tracking-wide">Query</th>
                      <SortHeader table="queries" colKey="clicks"      label="Clicks" />
                      <SortHeader table="queries" colKey="impressions" label="Impr." />
                      <SortHeader table="queries" colKey="ctr"         label="CTR" />
                      <SortHeader table="queries" colKey="position"    label="Pos." />
                    </tr>
                  </thead>
                  <tbody>
                    {sortedQueries.map((q, i) => (
                      <tr key={i} className="border-b border-border/50 hover:bg-surface-2">
                        <td className="py-2 px-3 text-text max-w-[200px] truncate">{q.query}</td>
                        <td className="py-2 px-3 text-right text-accent">{q.clicks}</td>
                        <td className="py-2 px-3 text-right text-text-3">{formatNumber(q.impressions)}</td>
                        <td className="py-2 px-3 text-right text-text-3">{(q.ctr * 100).toFixed(1)}%</td>
                        <td className="py-2 px-3 text-right text-text-3">{q.position}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-[17px] text-text-3 text-center py-4">No query data</p>
            )}
          </div>
        </Card>

        <Card padding="none">
          <div className="p-4 border-b border-border">
            <h3 className="text-[16px] font-[500] text-text">Top Pages</h3>
          </div>
          <div className="p-4">
            {sortedPages.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-[17px]">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 px-3 text-[15px] font-[500] text-text-3 uppercase tracking-wide">Page</th>
                      <SortHeader table="pages" colKey="clicks"      label="Clicks" />
                      <SortHeader table="pages" colKey="impressions" label="Impr." />
                      <SortHeader table="pages" colKey="position"    label="Pos." />
                    </tr>
                  </thead>
                  <tbody>
                    {sortedPages.map((p, i) => (
                      <tr key={i} className="border-b border-border/50 hover:bg-surface-2">
                        <td className="py-2 px-3 text-text max-w-[250px] truncate text-xs">{p.page.replace(/^https?:\/\/[^/]+/, '')}</td>
                        <td className="py-2 px-3 text-right text-accent">{p.clicks}</td>
                        <td className="py-2 px-3 text-right text-text-3">{formatNumber(p.impressions)}</td>
                        <td className="py-2 px-3 text-right text-text-3">{p.position}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-[17px] text-text-3 text-center py-4">No page data</p>
            )}
          </div>
        </Card>
      </div>

      {/* Countries + Devices */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {data.countries && data.countries.length > 0 && (
          <Card padding="none">
            <div className="p-4 border-b border-border">
              <h3 className="text-[16px] font-[500] text-text">Countries</h3>
            </div>
            <div className="p-4">
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={data.countries.slice(0, 8)} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis type="number" stroke="var(--border)" tick={{ fill: 'var(--text-3)', fontSize: 11 }} />
                  <YAxis dataKey="country" type="category" stroke="var(--border)" tick={{ fill: 'var(--text-3)', fontSize: 11 }} width={40} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="clicks" fill="var(--accent)" radius={[0, 4, 4, 0]} name="Clicks" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        )}

        {data.devices && data.devices.length > 0 && (
          <Card padding="none">
            <div className="p-4 border-b border-border">
              <h3 className="text-[16px] font-[500] text-text">Devices</h3>
            </div>
            <div className="p-4 flex items-center justify-center">
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={data.devices} dataKey="clicks" nameKey="device"
                    cx="50%" cy="50%" outerRadius={80}
                    label={({ name, percent }: { name?: string; percent?: number }) => `${name || ''} ${((percent || 0) * 100).toFixed(0)}%`}
                  >
                    {data.devices.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
