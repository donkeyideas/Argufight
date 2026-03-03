import { NextRequest, NextResponse } from 'next/server'

const CLIENT_ID = '78xvztz6gs8jbu'
const REDIRECT_URI = 'https://www.argufight.com/api/auth/linkedin/callback'

// GET: LinkedIn redirects here with ?code=...
// Shows a form to paste client secret and exchange for access token
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
    `<html>
    <body style="background:#111;color:#d4f050;font-family:monospace;padding:40px;max-width:700px;margin:0 auto">
      <h1>LinkedIn Token Exchange</h1>
      <p style="color:#aaa">Paste your LinkedIn Client Secret below and click the button. The code expires in ~30 seconds!</p>

      <div id="step1">
        <label style="color:#fff;display:block;margin-bottom:8px">Client Secret:</label>
        <input id="secret" type="text" placeholder="Paste your client secret here"
          style="width:100%;padding:12px;background:#222;border:1px solid #444;color:#fff;border-radius:8px;font-family:monospace;font-size:14px;box-sizing:border-box" />
        <button onclick="exchangeToken()" id="btn"
          style="margin-top:12px;padding:12px 24px;background:#d4f050;color:#111;border:none;border-radius:8px;font-weight:bold;font-size:16px;cursor:pointer;font-family:monospace">
          Get Access Token
        </button>
      </div>

      <div id="result" style="display:none;margin-top:24px"></div>

      <script>
        const CODE = ${JSON.stringify(code)};

        async function exchangeToken() {
          const secret = document.getElementById('secret').value.trim();
          if (!secret) { alert('Please paste your client secret'); return; }

          const btn = document.getElementById('btn');
          btn.textContent = 'Exchanging...';
          btn.disabled = true;

          try {
            const res = await fetch('/api/auth/linkedin/callback', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ code: CODE, client_secret: secret })
            });
            const data = await res.json();

            const resultDiv = document.getElementById('result');
            resultDiv.style.display = 'block';

            if (data.error) {
              resultDiv.innerHTML = '<h2 style="color:#ff6b6b">Error</h2>'
                + '<pre style="background:#222;padding:16px;border-radius:8px;color:#ff6b6b;word-break:break-all">'
                + JSON.stringify(data, null, 2) + '</pre>';
              btn.textContent = 'Try Again';
              btn.disabled = false;
              return;
            }

            let html = '<h2 style="color:#d4f050">Success!</h2>';

            if (data.access_token) {
              html += '<p style="color:#aaa">Access Token (copy this to Admin > Social Posts > LinkedIn):</p>';
              html += '<pre id="tokenPre" style="background:#222;padding:16px;border-radius:8px;color:#fff;word-break:break-all;cursor:pointer" onclick="copyText(this)">'
                + data.access_token + '</pre>';
              html += '<p style="color:#666;font-size:12px">Click the token to copy it. Expires in ' + (data.expires_in ? Math.round(data.expires_in/86400) + ' days' : 'unknown time') + '.</p>';
            }

            if (data.person_urn) {
              html += '<p style="color:#aaa;margin-top:16px">Person URN (copy this to Admin > Social Posts > LinkedIn):</p>';
              html += '<pre id="urnPre" style="background:#222;padding:16px;border-radius:8px;color:#fff;word-break:break-all;cursor:pointer" onclick="copyText(this)">'
                + data.person_urn + '</pre>';
            }

            html += '<p style="color:#d4f050;margin-top:24px">Now go to <a href="/admin/social-posts" style="color:#d4f050">/admin/social-posts</a> and paste these values in the LinkedIn section.</p>';

            resultDiv.innerHTML = html;
            document.getElementById('step1').style.display = 'none';
          } catch (err) {
            alert('Request failed: ' + err.message);
            btn.textContent = 'Try Again';
            btn.disabled = false;
          }
        }

        function copyText(el) {
          navigator.clipboard.writeText(el.textContent);
          el.style.border = '2px solid #d4f050';
          setTimeout(() => { el.style.border = 'none'; }, 1000);
        }
      </script>
    </body>
    </html>`,
    { headers: { 'Content-Type': 'text/html' } }
  )
}

// POST: Exchange the code for an access token (called by the form above)
export async function POST(request: NextRequest) {
  try {
    const { code, client_secret } = await request.json()

    if (!code || !client_secret) {
      return NextResponse.json({ error: 'Missing code or client_secret' }, { status: 400 })
    }

    // 1. Exchange code for access token
    const tokenRes = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: CLIENT_ID,
        client_secret,
        redirect_uri: REDIRECT_URI,
      }),
    })

    const tokenData = await tokenRes.json()

    if (tokenData.error) {
      return NextResponse.json({
        error: tokenData.error,
        error_description: tokenData.error_description,
      }, { status: 400 })
    }

    const accessToken = tokenData.access_token

    // 2. Fetch person URN using the access token
    let person_urn: string | null = null
    try {
      const meRes = await fetch('https://api.linkedin.com/v2/me', {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (meRes.ok) {
        const meData = await meRes.json()
        if (meData.id) {
          person_urn = `urn:li:person:${meData.id}`
        }
      }
    } catch {
      // Non-critical — user can get URN manually
    }

    return NextResponse.json({
      access_token: accessToken,
      expires_in: tokenData.expires_in,
      person_urn,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
