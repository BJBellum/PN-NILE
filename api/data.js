/**
 * GET /api/data?key=bourse|fan|catalogue|parlement
 *
 * Reads from Vercel KV (Redis) — ~1-5ms vs 200-500ms GitHub API.
 * Falls back to GitHub raw if KV is empty (first run / cold cache).
 * Results are edge-cached 60s by Vercel CDN (stale-while-revalidate 5min).
 *
 * Env vars required:
 *   KV_URL, KV_REST_API_URL, KV_REST_API_TOKEN  ← auto-injected by Vercel KV
 *   GITHUB_REPO = "BJBellum/UKN"
 */

import { kv } from '@vercel/kv';

// Map of allowed keys → GitHub file paths
const DATA_MAP = {
  bourse:    'data/bourse.json',
  fan:       'data/fan.json',
  catalogue: 'data/catalogue-militaire.json',
  parlement: 'data/parlement.json',
};

const GITHUB_RAW = 'https://raw.githubusercontent.com';
const REPO = process.env.GITHUB_REPO || 'BJBellum/UKN';

export default async function handler(req, res) {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { key } = req.query;

  if (!key || !DATA_MAP[key]) {
    return res.status(400).json({
      error: 'Invalid key',
      valid: Object.keys(DATA_MAP),
    });
  }

  try {
    // 1. Try KV cache first
    const cached = await kv.get(`ukn:${key}`);
    if (cached) {
      res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
      res.setHeader('X-Cache', 'HIT');
      return res.status(200).json(cached);
    }

    // 2. Cache miss — fetch from GitHub raw (no rate limit on raw.githubusercontent.com)
    const ghUrl = `${GITHUB_RAW}/${REPO}/main/${DATA_MAP[key]}`;
    const ghRes = await fetch(ghUrl, {
      headers: { 'Cache-Control': 'no-cache' },
    });

    if (!ghRes.ok) {
      return res.status(ghRes.status).json({
        error: 'GitHub fetch failed',
        status: ghRes.status,
      });
    }

    const data = await ghRes.json();

    // 3. Store in KV with 5min TTL (auto-refresh on next write)
    await kv.set(`ukn:${key}`, data, { ex: 300 });

    res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
    res.setHeader('X-Cache', 'MISS');
    return res.status(200).json(data);

  } catch (err) {
    console.error('[api/data] Error:', err);
    return res.status(500).json({ error: 'Internal error', detail: err.message });
  }
}
