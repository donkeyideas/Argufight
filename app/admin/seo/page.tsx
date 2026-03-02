'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';

function TabLoading() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="h-8 w-8 rounded-full border-2 border-border border-t-accent animate-spin" />
    </div>
  );
}

const OverviewTab        = dynamic(() => import('./components/OverviewTab'),        { ssr: false, loading: TabLoading });
const SearchConsoleTab   = dynamic(() => import('./components/SearchConsoleTab'),   { ssr: false, loading: TabLoading });
const AuditTab           = dynamic(() => import('./components/AuditTab'),           { ssr: false, loading: TabLoading });
const GEOTab             = dynamic(() => import('./components/GEOTab'),             { ssr: false, loading: TabLoading });
const RecommendationsTab = dynamic(() => import('./components/RecommendationsTab'), { ssr: false, loading: TabLoading });
const SettingsTab        = dynamic(() => import('./components/SettingsTab'),        { ssr: false, loading: TabLoading });

const TABS = [
  { key: 'overview',         label: 'Overview' },
  { key: 'search-console',   label: 'Search Console' },
  { key: 'audit',            label: 'SEO Audit' },
  { key: 'geo',              label: 'GEO' },
  { key: 'recommendations',  label: 'Recommendations' },
  { key: 'settings',         label: 'Settings' },
];

function SeoContent() {
  const searchParams = useSearchParams();
  const router       = useRouter();
  const tabFromUrl   = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState(tabFromUrl || 'overview');

  useEffect(() => {
    if (tabFromUrl && TABS.some((t) => t.key === tabFromUrl)) {
      setActiveTab(tabFromUrl);
    }
  }, [tabFromUrl]);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    router.push(`/admin/seo?tab=${tab}`, { scroll: false });
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-[600] text-text tracking-[-0.3px]">SEO &amp; GEO</h1>
        <p className="text-[17px] text-text-3 mt-1">
          Search Engine &amp; Generative Engine Optimization dashboard
        </p>
      </div>

      {/* Tab navigation */}
      <div className="border-b border-border mb-6 overflow-x-auto">
        <div className="flex gap-0 min-w-max">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => handleTabChange(tab.key)}
              className={[
                'px-4 py-2.5 text-[17px] font-[500] whitespace-nowrap transition-colors border-b-2 -mb-px',
                activeTab === tab.key
                  ? 'border-accent text-accent'
                  : 'border-transparent text-text-3 hover:text-text-2 hover:border-border-2',
              ].join(' ')}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      {activeTab === 'overview'        && <OverviewTab onTabChange={handleTabChange} />}
      {activeTab === 'search-console'  && <SearchConsoleTab onTabChange={handleTabChange} />}
      {activeTab === 'audit'           && <AuditTab />}
      {activeTab === 'geo'             && <GEOTab />}
      {activeTab === 'recommendations' && <RecommendationsTab />}
      {activeTab === 'settings'        && <SettingsTab />}
    </div>
  );
}

export default function AdminSeoPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 rounded-full border-2 border-border border-t-accent animate-spin" />
      </div>
    }>
      <SeoContent />
    </Suspense>
  );
}
