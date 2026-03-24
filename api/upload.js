/**
 * POST /api/upload
 * Content-Type: multipart/form-data
 * Fields: file (image), category (string), discordToken (string)
 *
 * Uploads catalogue images to Vercel Blob (CDN mondial).
 * Returns the permanent public URL.
 *
 * Replaces the current base64 localStorage + GitHub path system.
 *
 * Env vars required:
 *   BLOB_READ_WRITE_TOKEN  ← auto-injected by Vercel Blob store
 *   ADMIN_DISCORD_IDS
 */

import { put } from '@vercel/blob';

const ADMIN_IDS = new Set(
  (process.env.ADMIN_DISCORD_IDS || '772821169664426025').split(',').map(s => s.trim())
);

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const MAX_SIZE_MB = 8;

async function verifyAdmin(token) {
  const res = await fetch('https://discord.com/api/users/@me', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  const user = await res.json();
  return ADMIN_IDS.has(user.id) ? user : null;
}

export const config = {
  api: {
    bodyParser: false, // Need raw stream for Blob upload
  },
};

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Parse multipart form data using native Web API (available in Node 20+)
  let formData;
  try {
    const contentType = req.headers['content-type'] || '';
    if (!contentType.includes('multipart/form-data')) {
      return res.status(400).json({ error: 'Expected multipart/form-data' });
    }

    // Read body as Buffer
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = Buffer.concat(chunks);

    // Extract boundary
    const boundaryMatch = contentType.match(/boundary=([^;]+)/);
    if (!boundaryMatch) return res.status(400).json({ error: 'No boundary in multipart' });
    const boundary = boundaryMatch[1];

    // Simple multipart parser
    const parts = parseMultipart(body, boundary);
    formData = {};
    for (const part of parts) {
      if (part.filename) {
        formData.file = { buffer: part.data, name: part.filename, type: part.contentType };
      } else {
        formData[part.name] = part.data.toString('utf-8');
      }
    }
  } catch (err) {
    return res.status(400).json({ error: 'Failed to parse form data', detail: err.message });
  }

  const { file, category, discordToken } = formData;

  if (!discordToken) return res.status(401).json({ error: 'Missing Discord token' });
  if (!file)        return res.status(400).json({ error: 'No file uploaded' });
  if (!category)    return res.status(400).json({ error: 'Missing category' });

  // Validate file
  if (!ALLOWED_TYPES.has(file.type)) {
    return res.status(400).json({ error: `Invalid file type: ${file.type}. Allowed: JPEG, PNG, WebP, GIF` });
  }
  if (file.buffer.length > MAX_SIZE_MB * 1024 * 1024) {
    return res.status(400).json({ error: `File too large (max ${MAX_SIZE_MB}MB)` });
  }

  // Verify admin
  const user = await verifyAdmin(discordToken);
  if (!user) return res.status(403).json({ error: 'Unauthorized — admin only' });

  // Generate deterministic filename: category-timestamp.ext
  const ext = file.name.split('.').pop().toLowerCase() || 'jpg';
  const safeCat = category.replace(/[^a-z0-9-]/g, '-');
  const filename = `catalogue/${safeCat}-${Date.now()}.${ext}`;

  try {
    const blob = await put(filename, file.buffer, {
      access: 'public',
      contentType: file.type,
      addRandomSuffix: false,
    });

    return res.status(200).json({
      success: true,
      url: blob.url,
      filename,
      size: file.buffer.length,
      uploadedBy: user.username,
    });

  } catch (err) {
    console.error('[api/upload] Blob error:', err);
    return res.status(500).json({ error: 'Upload failed', detail: err.message });
  }
}

// Minimal multipart parser (no dependencies)
function parseMultipart(buffer, boundary) {
  const delimiter = Buffer.from(`--${boundary}`);
  const parts = [];
  let start = buffer.indexOf(delimiter) + delimiter.length + 2;

  while (start < buffer.length) {
    const end = buffer.indexOf(delimiter, start);
    if (end === -1) break;

    const partData = buffer.slice(start, end - 2);
    const headerEnd = partData.indexOf('\r\n\r\n');
    if (headerEnd === -1) { start = end + delimiter.length + 2; continue; }

    const headerStr = partData.slice(0, headerEnd).toString('utf-8');
    const data = partData.slice(headerEnd + 4);

    const nameMatch = headerStr.match(/name="([^"]+)"/);
    const fileMatch = headerStr.match(/filename="([^"]+)"/);
    const ctMatch   = headerStr.match(/Content-Type: ([^\r\n]+)/);

    parts.push({
      name:        nameMatch?.[1] || '',
      filename:    fileMatch?.[1] || '',
      contentType: ctMatch?.[1] || 'application/octet-stream',
      data,
    });

    start = end + delimiter.length + 2;
  }

  return parts;
}
