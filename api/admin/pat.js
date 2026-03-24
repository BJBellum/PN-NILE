/**
 * GET  /api/admin/pat?action=check   → returns isAdmin from session cookie
 * POST /api/admin/pat                → not needed anymore (PAT is in Vercel env)
 *
 * The old workflow: user pastes PAT in browser → saved in localStorage → sent with every write
 * New workflow:     user logs in via Discord → session cookie → API routes use GITHUB_PAT from env
 *
 * This endpoint lets the admin page verify the session without exposing any secret.
 */

import { verifySession } from '../auth/discord.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();

  const cookie = req.cookies?.ukn_session;
  if (!cookie) {
    return res.status(401).json({ authenticated: false, isAdmin: false });
  }

  const session = verifySession(cookie);
  if (!session || !session.isAdmin) {
    return res.status(403).json({ authenticated: !!session, isAdmin: false });
  }

  return res.status(200).json({
    authenticated: true,
    isAdmin: true,
    isFan: session.isFan,
    user: session.user,
    // No PAT, no secret — everything is handled server-side
    message: 'Session valide — écriture sécurisée via /api/write',
  });
}
