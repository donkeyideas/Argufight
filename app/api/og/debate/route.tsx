/**
 * Dynamic OG Image Generation for Debates
 * Generates 1200x630px Open Graph images for social sharing
 *
 * Usage: /api/og/debate?topic=Debate+Topic&challenger=Alice&opponent=Bob&status=active
 */

import { ImageResponse } from 'next/og'
import { NextRequest } from 'next/server'

export const runtime = 'edge'

/**
 * GET /api/og/debate
 * Generates a dynamic OG image for a debate
 *
 * Query Parameters:
 * - topic: Debate topic (required)
 * - challenger: Challenger username (required)
 * - opponent: Opponent username (optional)
 * - status: Debate status (optional: active, completed, pending)
 * - category: Debate category (optional)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl

    // Extract parameters
    const topic = searchParams.get('topic') || 'Debate Topic'
    const challenger = searchParams.get('challenger') || 'Challenger'
    const opponent = searchParams.get('opponent') || 'Opponent'
    const status = searchParams.get('status') || 'active'
    const category = searchParams.get('category') || 'General'

    // Truncate long topics for better display
    const displayTopic = topic.length > 100 ? topic.substring(0, 97) + '...' : topic

    // Status badge color
    const statusColors = {
      active: '#FF6B35', // neon-orange
      completed: '#39FF14', // cyber-green
      pending: '#00D9FF', // electric-blue
      cancelled: '#8B5CF6', // purple
    }
    const statusColor = statusColors[status as keyof typeof statusColors] || statusColors.active

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
            background: 'linear-gradient(135deg, #1a0933 0%, #2d1b4e 50%, #1e3a8a 100%)',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            position: 'relative',
          }}
        >
          {/* Background Pattern */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundImage:
                'radial-gradient(circle at 25% 25%, rgba(138, 43, 226, 0.1) 0%, transparent 50%), radial-gradient(circle at 75% 75%, rgba(30, 58, 138, 0.1) 0%, transparent 50%)',
              zIndex: 0,
            }}
          />

          {/* Content Container */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '60px',
              width: '100%',
              height: '100%',
              zIndex: 1,
            }}
          >
            {/* Logo/Brand */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                marginBottom: '40px',
              }}
            >
              <span
                style={{
                  fontSize: '48px',
                  fontWeight: 'bold',
                  background: 'linear-gradient(135deg, #FF6B35 0%, #00D9FF 100%)',
                  backgroundClip: 'text',
                  WebkitBackgroundClip: 'text',
                  color: 'transparent',
                }}
              >
                ArguFight
              </span>
            </div>

            {/* Status Badge */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                marginBottom: '32px',
              }}
            >
              <div
                style={{
                  padding: '8px 20px',
                  background: `${statusColor}33`,
                  border: `2px solid ${statusColor}`,
                  borderRadius: '8px',
                  color: statusColor,
                  fontSize: '20px',
                  fontWeight: '600',
                  textTransform: 'uppercase',
                }}
              >
                {status}
              </div>
              <div
                style={{
                  padding: '8px 20px',
                  background: 'rgba(255, 255, 255, 0.1)',
                  borderRadius: '8px',
                  color: 'rgba(255, 255, 255, 0.8)',
                  fontSize: '20px',
                }}
              >
                {category}
              </div>
            </div>

            {/* Debate Topic */}
            <h1
              style={{
                fontSize: '56px',
                fontWeight: 'bold',
                color: 'white',
                textAlign: 'center',
                maxWidth: '1000px',
                lineHeight: '1.2',
                marginBottom: '48px',
                textShadow: '0 4px 8px rgba(0, 0, 0, 0.5)',
              }}
            >
              {displayTopic}
            </h1>

            {/* Participants */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '40px',
                marginTop: 'auto',
              }}
            >
              {/* Challenger */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                }}
              >
                <div
                  style={{
                    width: '80px',
                    height: '80px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #FF6B35 0%, #F72585 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '36px',
                    fontWeight: 'bold',
                    color: 'white',
                    marginBottom: '16px',
                  }}
                >
                  {challenger.charAt(0).toUpperCase()}
                </div>
                <div
                  style={{
                    color: 'white',
                    fontSize: '24px',
                    fontWeight: '600',
                  }}
                >
                  {challenger}
                </div>
                <div
                  style={{
                    color: 'rgba(255, 255, 255, 0.6)',
                    fontSize: '18px',
                  }}
                >
                  Challenger
                </div>
              </div>

              {/* VS Divider */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '80px',
                  height: '80px',
                  borderRadius: '50%',
                  background: 'rgba(255, 255, 255, 0.1)',
                  fontSize: '32px',
                  fontWeight: 'bold',
                  color: '#00D9FF',
                }}
              >
                VS
              </div>

              {/* Opponent */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                }}
              >
                <div
                  style={{
                    width: '80px',
                    height: '80px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #00D9FF 0%, #7209B7 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '36px',
                    fontWeight: 'bold',
                    color: 'white',
                    marginBottom: '16px',
                  }}
                >
                  {opponent.charAt(0).toUpperCase()}
                </div>
                <div
                  style={{
                    color: 'white',
                    fontSize: '24px',
                    fontWeight: '600',
                  }}
                >
                  {opponent}
                </div>
                <div
                  style={{
                    color: 'rgba(255, 255, 255, 0.6)',
                    fontSize: '18px',
                  }}
                >
                  Opponent
                </div>
              </div>
            </div>

            {/* Footer tagline */}
            <div
              style={{
                marginTop: '48px',
                color: 'rgba(255, 255, 255, 0.5)',
                fontSize: '20px',
              }}
            >
              AI-Judged Debates • www.argufight.com
            </div>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      }
    )
  } catch (error: any) {
    console.error('[OG Image] Error generating debate OG image:', error)

    // Return a fallback image on error
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
            background: 'linear-gradient(135deg, #1a0933 0%, #2d1b4e 100%)',
          }}
        >
          <div
            style={{
              fontSize: '64px',
              fontWeight: 'bold',
              color: 'white',
            }}
          >
            ArguFight
          </div>
          <div
            style={{
              fontSize: '24px',
              color: 'rgba(255, 255, 255, 0.7)',
              marginTop: '20px',
            }}
          >
            AI-Judged Debate Platform
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      }
    )
  }
}
