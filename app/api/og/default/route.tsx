// Default OG Image Generation for ArguFight
// Generates a 1200x630px PNG for use as the site-wide default OG image
// Usage: /api/og/default

import { ImageResponse } from 'next/og'

export const runtime = 'edge'

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #1a0933 0%, #2d1b4e 40%, #1e3a8a 100%)',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          position: 'relative',
        }}
      >
        {/* Background accents */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundImage:
              'radial-gradient(circle at 20% 30%, rgba(255, 107, 53, 0.12) 0%, transparent 50%), radial-gradient(circle at 80% 70%, rgba(0, 217, 255, 0.12) 0%, transparent 50%)',
          }}
        />

        {/* Top accent line */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '4px',
            background: 'linear-gradient(90deg, #FF6B35, #00D9FF, #8B5CF6)',
          }}
        />

        {/* Brand name */}
        <div
          style={{
            display: 'flex',
            fontSize: '80px',
            fontWeight: 900,
            letterSpacing: '-2px',
            background: 'linear-gradient(135deg, #FF6B35 0%, #00D9FF 100%)',
            backgroundClip: 'text',
            color: 'transparent',
            marginBottom: '24px',
          }}
        >
          ArguFight
        </div>

        {/* Tagline */}
        <div
          style={{
            display: 'flex',
            fontSize: '32px',
            fontWeight: 600,
            color: 'rgba(255, 255, 255, 0.9)',
            marginBottom: '16px',
          }}
        >
          AI-Judged Debate Platform
        </div>

        {/* Subtitle */}
        <div
          style={{
            display: 'flex',
            fontSize: '22px',
            color: 'rgba(255, 255, 255, 0.5)',
            maxWidth: '700px',
            textAlign: 'center',
          }}
        >
          Debate. Compete. Rise in the rankings.
        </div>

        {/* Domain */}
        <div
          style={{
            position: 'absolute',
            bottom: '32px',
            display: 'flex',
            fontSize: '18px',
            color: 'rgba(255, 255, 255, 0.35)',
            letterSpacing: '2px',
          }}
        >
          www.argufight.com
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  )
}
