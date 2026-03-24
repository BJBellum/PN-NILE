/**
 * POST /api/write
 * Body: { key: "bourse"|"fan"|"catalogue"|"parlement", data: {...}, discordToken: "..." }
 *
 * 1. Validates Discord token server-side → confirms caller is ADMIN
 * 2. Writes to Vercel KV (instant cache update)
 * 3. Writes to GitHub via PAT stored in Vercel env (never exposed to client)
 *
 * Env vars required:
 *   KV_URL etc.              ← Vercel KV
 *   GITHUB_PAT               ← Personal Access Token (repo scope) — set in Vercel dashboard
 *   GITHUB_REPO              ← "BJBellum/UKN"
 *   ADMIN_DISCORD_IDS        ← "772821169664426025" (comma-separated)
 */

import { kv } from '@vercel/kv';

const DATA_MAP = {
  bourse:    'data/bourse.json',
  fan:       'data/fan.json',
  catalogue: 'data/catalogue-militaire.json',
  parlement: 'data/parlement.json',
};

const ADMIN_IDS = new Set(
  (process.env.ADMIN_DISCORD_IDS || '772821169664426025').split(',').map(s => s.trim())
);

const REPO   = process.env.GITHUB_REPO || 'BJBellum/UKN';
const GH_PAT = process.env.GITHUB_PAT;
const GH_API = 'https://api.github.com';

async function verifyDiscordAdmin(token) {
  const res = await fetch('https://discord.com/api/users/@me', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  const user = await res.json();
  if (!ADMIN_IDS.has(user.id)) return null;
  return user;
}

async function getGitHubFileSha(path) {
  const res = await fetch(`${GH_API}/repos/${REPO}/contents/${path}`, {
    headers: {
      Authorization: `token ${GH_PAT}`,
      Accept: 'application/vnd.github.v3+json',
    },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub SHA fetch failed: ${res.status}`);
  const json = await res.json();
  return json.sha || null;
}

async function writeToGitHub(path, data, message) {
  const sha = await getGitHubFileSha(path);
  const content = Buffer.from(JSON.stringify(data, null, 2)).toString('base64');
  const body = { message, content };
  if (sha) body.sha = sha;

  const res = await fetch(`${GH_API}/repos/${REPO}/contents/${path}`, {
    method: 'PUT',
    headers: {
      Authorization: `token ${GH_PAT}`,
      Accept: 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(`GitHub write failed: ${res.status} — ${err.message}`);
  }
  return await res.json();
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { key, data, discordToken } = req.body || {};

  // Validate inputs
  if (!key || !DATA_MAP[key]) {
    return res.status(400).json({ error: 'Invalid key', valid: Object.keys(DATA_MAP) });
  }
  if (!data) {
    return res.status(400).json({ error: 'Missing data' });
  }
  if (!discordToken) {
    return res.status(401).json({ error: 'Missing Discord token' });
  }
  if (!GH_PAT) {
    return res.status(500).json({ error: 'Server not configured (missing GITHUB_PAT)' });
  }

  // Verify admin identity
  const user = await verifyDiscordAdmin(discordToken);
  if (!user) {
    return res.status(403).json({ error: 'Unauthorized — admin only' });
  }

  const path = DATA_MAP[key];

  try {
    // 1. Update KV immediately (users see change instantly)
    await kv.set(`ukn:${key}`, data, { ex: 300 });

    // 2. Persist to GitHub (source of truth)
    const commitMsg = `update ${key} — admin ${user.username} (${new Date().toISOString()})`;
    await writeToGitHub(path, data, commitMsg);

    return res.status(200).json({
      success: true,
      key,
      author: user.username,
      timestamp: new Date().toISOString(),
    });

  } catch (err) {
    console.error('[api/write] Error:', err);
    return res.status(500).json({ error: err.message });
  }
}
