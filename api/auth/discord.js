/**
 * GET /api/auth/discord?code=...&state=...
 *
 * Discord Authorization Code Flow — fully server-side.
 * The access_token NEVER appears in the URL or client code.
 *
 * Flow:
 *   1. User clicks "Login" → redirected to Discord OAuth with response_type=code
 *   2. Discord redirects to /auth/callback/ → page calls this endpoint with the code
 *   3. This endpoint exchanges the code for a token server-side
 *   4. Fetches user identity from Discord API
 *   5. Creates a signed session token (JWT-lite) → stored in httpOnly cookie
 *
 * Env vars required:
 *   DISCORD_CLIENT_ID      = "1483200078092042300"
 *   DISCORD_CLIENT_SECRET  ← set in Vercel dashboard (never expose)
 *   SESSION_SECRET         ← random 32-char string for signing sessions
 *   BASE_URL               = "https://ukn-seven.vercel.app"
 *   ADMIN_DISCORD_IDS      = "772821169664426025"
 *   FAN_DISCORD_IDS        = "772821169664426025,928291843958014014,..."
 */

import { createHmac, randomBytes } from 'crypto';

const CLIENT_ID     = process.env.DISCORD_CLIENT_ID || '1483200078092042300';
const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const SESSION_SECRET= process.env.SESSION_SECRET || 'change-me-in-vercel-dashboard';
const BASE_URL      = process.env.BASE_URL || 'https://ukn-seven.vercel.app';
const REDIRECT_URI  = `${BASE_URL}/auth/callback/`;

const ADMIN_IDS = new Set(
  (process.env.ADMIN_DISCORD_IDS || '772821169664426025').split(',').map(s => s.trim())
);
const FAN_IDS = new Set(
  (process.env.FAN_DISCORD_IDS || '772821169664426025,928291843958014014,1014832884764393523,1113422056525144104,293869524091142144,1302403450566610944').split(',').map(s => s.trim())
);

// Minimal session token: base64(payload).hmac — NOT a full JWT, just tamper-evident
function signSession(payload) {
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig  = createHmac('sha256', SESSION_SECRET).update(data).digest('base64url');
  return `${data}.${sig}`;
}

function verifySession(token) {
  try {
    const [data, sig] = token.split('.');
    const expected = createHmac('sha256', SESSION_SECRET).update(data).digest('base64url');
    if (sig !== expected) return null;
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString());
    if (payload.exp && Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();

  // ── Verify existing session ──────────────────────────────────────────────
  if (req.method === 'GET' && req.query.action === 'verify') {
    const cookie = req.cookies?.ukn_session;
    if (!cookie) return res.status(401).json({ error: 'No session' });
    const session = verifySession(cookie);
    if (!session) return res.status(401).json({ error: 'Invalid session' });
    return res.status(200).json({
      user: session.user,
      isAdmin: session.isAdmin,
      isFan: session.isFan,
    });
  }

  // ── Logout ───────────────────────────────────────────────────────────────
  if (req.method === 'POST' && req.query.action === 'logout') {
    res.setHeader('Set-Cookie', 'ukn_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0');
    return res.status(200).json({ success: true });
  }

  // ── Exchange code for token ───────────────────────────────────────────────
  if (req.method === 'GET' && req.query.code) {
    if (!CLIENT_SECRET) {
      return res.status(500).json({ error: 'Server not configured (DISCORD_CLIENT_SECRET missing)' });
    }

    const { code, state } = req.query;

    // Exchange code
    const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id:     CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type:    'authorization_code',
        code,
        redirect_uri:  REDIRECT_URI,
      }),
    });

    if (!tokenRes.ok) {
      const err = await tokenRes.json();
      console.error('[auth/discord] Token exchange failed:', err);
      return res.redirect(302, `/auth/error?reason=token_exchange`);
    }

    const { access_token, expires_in } = await tokenRes.json();

    // Fetch user identity
    const userRes = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    if (!userRes.ok) {
      return res.redirect(302, `/auth/error?reason=user_fetch`);
    }
    const user = await userRes.json();

    // Build session payload
    const session = {
      user: {
        id:       user.id,
        username: user.username,
        avatar:   user.avatar
          ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.webp?size=64`
          : `https://cdn.discordapp.com/embed/avatars/${parseInt(user.discriminator || 0) % 5}.png`,
      },
      isAdmin: ADMIN_IDS.has(user.id),
      isFan:   FAN_IDS.has(user.id),
      exp:     Date.now() + (expires_in * 1000),
    };

    const token = signSession(session);

    // Set httpOnly cookie — token never touches JS
    res.setHeader('Set-Cookie', [
      `ukn_session=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${expires_in}`,
    ]);

    // Redirect back to the page the user was on (from state param)
    let returnTo = '/';
    try {
      returnTo = decodeURIComponent(atob(state || ''));
      if (!returnTo.startsWith('/')) returnTo = '/';
    } catch { returnTo = '/'; }

    return res.redirect(302, returnTo);
  }

  return res.status(400).json({ error: 'Invalid request' });
}

// Export verifySession for use in other API routes
export { verifySession };
