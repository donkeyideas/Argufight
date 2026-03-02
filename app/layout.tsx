import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { ThemeProvider } from 'next-themes';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  weight: ['200', '300', '400', '500', '600'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'ArguFight — Debate Platform',
    template: '%s | ArguFight',
  },
  description: 'The premier AI-judged debate platform. Challenge opponents, earn championship belts, and prove your argumentation skills.',
  keywords: ['debate', 'argumentation', 'competitive debate', 'online debate'],
  authors: [{ name: 'ArguFight' }],
  creator: 'ArguFight',
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'https://argufight.com'),
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://argufight.com',
    siteName: 'ArguFight',
    title: 'ArguFight — Debate Platform',
    description: 'The premier AI-judged debate platform.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ArguFight — Debate Platform',
    description: 'The premier AI-judged debate platform.',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} antialiased`}>
        <a href="#main-content" className="skip-link">
          Skip to main content
        </a>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          themes={['dark', 'light']}
          disableTransitionOnChange={false}
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
