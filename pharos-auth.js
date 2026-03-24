/**
 * pharos-auth.js v2 — Authorization Code Flow
 *
 * BREAKING CHANGE from v1:
 *   - No more access_token in URL hash
 *   - Session is stored in httpOnly cookie (server-side via /api/auth/discord)
 *   - PharosAuth.getUser() now calls /api/auth/discord?action=verify (async)
 *   - Use PharosAuth.init() on page load instead of calling getUser() directly
 *
 * Usage (same API surface as v1, but async):
 *   PharosAuth.init().then(({ user, isAdmin, isFan }) => { ... });
 *   PharosAuth.logout();
 *
 * OAuth URL now uses response_type=code (not token) — server handles exchange.
 */

(function () {
  'use strict';

  const CLIENT_ID   = '1483200078092042300';
  const BASE_URL    = 'https://ukn-seven.vercel.app';
  const REDIRECT    = `${BASE_URL}/auth/callback/`;
  const VERIFY_URL  = '/api/auth/discord?action=verify';
  const LOGOUT_URL  = '/api/auth/discord?action=logout';

  // Cache to avoid multiple verify calls per page
  let _sessionCache = null;
  let _verifyPromise = null;

  function buildOAuthURL() {
    const state = btoa(encodeURIComponent(window.location.pathname));
    const params = new URLSearchParams({
      client_id:     CLIENT_ID,
      redirect_uri:  REDIRECT,
      response_type: 'code',
      scope:         'identify',
      state,
    });
    return `https://discord.com/oauth2/authorize?${params}`;
  }

  function avatarURL(user) {
    return user?.avatar || `https://cdn.discordapp.com/embed/avatars/0.png`;
  }

  async function verifySession() {
    if (_sessionCache) return _sessionCache;
    if (_verifyPromise) return _verifyPromise;

    _verifyPromise = fetch(VERIFY_URL, { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.user) {
          _sessionCache = { user: data.user, isAdmin: data.isAdmin, isFan: data.isFan };
        } else {
          _sessionCache = { user: null, isAdmin: false, isFan: false };
        }
        _verifyPromise = null;
        return _sessionCache;
      })
      .catch(() => {
        _verifyPromise = null;
        return { user: null, isAdmin: false, isFan: false };
      });

    return _verifyPromise;
  }

  function injectNavBadge(session) {
    const navRight = document.querySelector('.nav-right');
    if (!navRight) return;
    // Remove any existing badge
    navRight.querySelector('.pharos-badge')?.remove();

    const badge = document.createElement('div');
    badge.className = 'pharos-badge';
    badge.style.cssText = 'display:flex;align-items:center;gap:8px;font-family:"IBM Plex Mono",monospace;font-size:9px;color:var(--text2);';

    if (session.user) {
      const u = session.user;
      badge.innerHTML = `
        <img src="${avatarURL(u)}" alt="" style="width:22px;height:22px;border-radius:50%;object-fit:cover;border:1px solid var(--border2);">
        <span style="color:var(--text2);">${u.username}</span>
        ${session.isAdmin ? '<span style="color:var(--spice);font-size:8px;letter-spacing:.08em;">ADMIN</span>' : ''}
        ${session.isFan && !session.isAdmin ? '<span style="color:var(--amber);font-size:8px;letter-spacing:.08em;">FAN</span>' : ''}
        <button onclick="PharosAuth.logout()" style="background:transparent;border:1px solid var(--border);color:var(--text3);padding:3px 7px;font-family:'IBM Plex Mono',monospace;font-size:8px;cursor:pointer;border-radius:2px;letter-spacing:.06em;">✕</button>
      `;
    } else {
      badge.innerHTML = `
        <a href="${buildOAuthURL()}" style="background:transparent;border:1px solid var(--border);color:var(--text3);padding:4px 10px;font-family:'IBM Plex Mono',monospace;font-size:9px;cursor:pointer;border-radius:2px;letter-spacing:.06em;text-decoration:none;">
          Connexion Discord
        </a>
      `;
    }

    navRight.appendChild(badge);
  }

  const PharosAuth = {
    /**
     * Initialize auth on page load.
     * Returns { user, isAdmin, isFan } — always resolves (never rejects).
     */
    async init() {
      const session = await verifySession();
      injectNavBadge(session);
      return session;
    },

    /** Returns cached session synchronously (after init() has resolved) */
    getSession() {
      return _sessionCache;
    },

    /** For backward compat with v1 code */
    getUser() {
      return _sessionCache?.user || null;
    },

    isAdmin(user) {
      return _sessionCache?.isAdmin || false;
    },

    isFan() {
      return _sessionCache?.isFan || false;
    },

    avatarURL,

    async logout() {
      await fetch(LOGOUT_URL, { method: 'POST', credentials: 'include' });
      _sessionCache = null;
      window.location.reload();
    },

    /** Build OAuth URL (for custom login buttons) */
    oauthURL: buildOAuthURL,
  };

  window.PharosAuth = PharosAuth;

  // Auto-init on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => PharosAuth.init());
  } else {
    PharosAuth.init();
  }
})();
