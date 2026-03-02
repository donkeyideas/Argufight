import type { MetadataRoute } from 'next';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://argufight.com';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPages: MetadataRoute.Sitemap = [
    { url: BASE_URL,                      lastModified: new Date(), changeFrequency: 'daily',   priority: 1.0 },
    { url: `${BASE_URL}/about`,           lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    { url: `${BASE_URL}/login`,           lastModified: new Date(), changeFrequency: 'yearly',  priority: 0.3 },
    { url: `${BASE_URL}/signup`,          lastModified: new Date(), changeFrequency: 'yearly',  priority: 0.4 },
    { url: `${BASE_URL}/leaderboard`,     lastModified: new Date(), changeFrequency: 'hourly',  priority: 0.8 },
    { url: `${BASE_URL}/trending`,        lastModified: new Date(), changeFrequency: 'hourly',  priority: 0.7 },
    { url: `${BASE_URL}/tournaments`,     lastModified: new Date(), changeFrequency: 'daily',   priority: 0.7 },
  ];

  return staticPages;
}
