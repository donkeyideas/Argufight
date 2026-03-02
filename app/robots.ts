import type { MetadataRoute } from 'next';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://argufight.com';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/leaderboard', '/trending', '/tournaments'],
        disallow: ['/admin', '/api', '/settings', '/messages', '/dashboard'],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
