import { NextRequest, NextResponse } from 'next/server'

// Temporary helper: displays the LinkedIn OAuth code so you can copy it
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code')
  const error = request.nextUrl.searchParams.get('error')

  if (error) {
    return new NextResponse(
      `<html><body style="background:#111;color:#fff;font-family:monospace;padding:40px">
        <h1>LinkedIn OAuth Error</h1>
        <p>${error}: ${request.nextUrl.searchParams.get('error_description')}</p>
      </body></html>`,
      { headers: { 'Content-Type': 'text/html' } }
    )
  }

  if (!code) {
    return NextResponse.json({ error: 'No code parameter' }, { status: 400 })
  }

  return new NextResponse(
    `<html><body style="background:#111;color:#d4f050;font-family:monospace;padding:40px">
      <h1>LinkedIn Authorization Code</h1>
      <p style="color:#aaa">Copy this code and use it in the curl command. It expires in ~30 seconds!</p>
      <pre style="background:#222;padding:20px;border-radius:8px;font-size:16px;word-break:break-all;color:#fff">${code}</pre>
      <p style="color:#aaa;margin-top:20px">Now run this in your terminal (replace YOUR_CLIENT_SECRET):</p>
      <pre style="background:#222;padding:20px;border-radius:8px;font-size:13px;word-break:break-all;color:#fff">curl -X POST https://www.linkedin.com/oauth/v2/accessToken -d "grant_type=authorization_code" -d "code=${code}" -d "client_id=78xvztz6gs8jbu" -d "client_secret=YOUR_CLIENT_SECRET" -d "redirect_uri=https://www.argufight.com/api/auth/linkedin/callback"</pre>
    </body></html>`,
    { headers: { 'Content-Type': 'text/html' } }
  )
}
