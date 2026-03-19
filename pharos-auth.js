/* ═══════════════════════════════════════════════════════════════════
   PHAROS AUTH · v2.0 · Royaume-Uni du Nil
   Discord OAuth2 Implicit Flow + GitHub Data Storage
   ─────────────────────────────────────────────────────────────────
   ▶ CONFIGURATION OBLIGATOIRE (remplir avant déploiement) :
     CFG.DISCORD_CLIENT_ID  →  ID de ton application Discord
     (Créer sur : discord.com/developers/applications)
     URI de redirection à ajouter dans Discord Dev Portal :
     https://BJBellum.github.io/UKN/auth/callback/
   ═══════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  /* ── CONFIGURATION ─────────────────────────────────────────── */
  const CFG = {
    DISCORD_CLIENT_ID : '1483200078092042300', // ← à remplir
    REDIRECT_URI      : 'https://BJBellum.github.io/UKN/auth/callback/',
    DISCORD_SCOPE     : 'identify',
    ADMIN_IDS         : ['772821169664426025'],
    BASE_URL          : 'https://BJBellum.github.io/UKN/',
    GITHUB_REPO       : 'BJBellum/UKN',
    DATA_PATH         : 'data/bourse.json',
    SESSION_USER_KEY  : 'pharos_user',
    SESSION_TOKEN_KEY : 'pharos_token',
    THEME_KEY         : 'run-theme',
    PAT_LS_KEY        : 'pharos_gh_pat',   // GitHub PAT (localStorage admin uniquement)
  };

  /* ── SESSION ───────────────────────────────────────────────── */
  function getUser()  {
    try { return JSON.parse(sessionStorage.getItem(CFG.SESSION_USER_KEY)); } catch { return null; }
  }
  function setUser(u) {
    try { sessionStorage.setItem(CFG.SESSION_USER_KEY, JSON.stringify(u)); } catch {}
  }
  function getToken() { return sessionStorage.getItem(CFG.SESSION_TOKEN_KEY); }

  function logout() {
    sessionStorage.removeItem(CFG.SESSION_USER_KEY);
    sessionStorage.removeItem(CFG.SESSION_TOKEN_KEY);
    window.location.reload();
  }

  function isAdmin(u) {
    u = u || getUser();
    return !!(u && CFG.ADMIN_IDS.includes(String(u.id)));
  }

  /* ── DISCORD OAUTH ─────────────────────────────────────────── */
  function discordLoginURL() {
    const p = new URLSearchParams({
      client_id    : CFG.DISCORD_CLIENT_ID,
      redirect_uri : CFG.REDIRECT_URI,
      response_type: 'token',
      scope        : CFG.DISCORD_SCOPE,
      state        : btoa(window.location.href).replace(/=+$/, ''), // retour à la page courante
    });
    return 'https://discord.com/oauth2/authorize?' + p;
  }

  async function fetchDiscordUser(token) {
    const r = await fetch('https://discord.com/api/v10/users/@me', {
      headers: { Authorization: 'Bearer ' + token }
    });
    if (!r.ok) throw new Error('Discord API ' + r.status);
    return r.json();
  }

  /* ── AVATAR URL ────────────────────────────────────────────── */
  function avatarURL(u) {
    if (!u) return '';
    return u.avatar
      ? `https://cdn.discordapp.com/avatars/${u.id}/${u.avatar}.png?size=32`
      : `https://cdn.discordapp.com/embed/avatars/${(BigInt(u.id) >> 22n) % 6n}.png`;
  }

  /* ── BUTTON HTML ───────────────────────────────────────────── */
  function buildBtnHTML(user) {
    const admin = isAdmin(user);

    if (!user) {
      return `
        <a id="pharos-login-btn" href="${discordLoginURL()}"
           title="Se connecter avec Discord"
           style="display:flex;align-items:center;gap:7px;
                  font-family:'IBM Plex Mono',monospace;font-size:11px;font-weight:500;
                  color:var(--text2);text-decoration:none;
                  background:var(--toggle-bg);border:1px solid var(--border2);
                  border-radius:20px;padding:5px 12px;letter-spacing:0.04em;
                  transition:border-color .2s,color .2s;"
           onmouseover="this.style.borderColor='rgba(88,101,242,0.6)';this.style.color='#5865F2';"
           onmouseout="this.style.borderColor='';this.style.color='';">
          <svg width="14" height="11" viewBox="0 0 71 55" fill="#5865F2" style="flex-shrink:0;">
            <path d="M60.1 4.9A58.5 58.5 0 0 0 45.4.9a41 41 0 0 0-1.8 3.6 54 54 0 0 0-16.2 0A40 40 0
              0 0 25.6.9 58.4 58.4 0 0 0 10.9 5C1.6 18.6-.9 31.8.3 44.8a58.9 58.9 0 0 0 17.9 9
              42 42 0 0 0 3.7-6 38.3 38.3 0 0 1-6-2.9l1.5-1.1a41.9 41.9 0 0 0 36 0l1.5 1.1
              a38 38 0 0 1-6 2.9 42 42 0 0 0 3.7 6 58.7 58.7 0 0 0 17.9-9.1C72 29.7 67.9 16.6
              60.1 4.9ZM23.8 37.1c-3.5 0-6.4-3.2-6.4-7.1s2.8-7.1 6.4-7.1 6.4 3.2 6.4 7.1-2.9
              7.1-6.4 7.1Zm23.4 0c-3.5 0-6.4-3.2-6.4-7.1s2.8-7.1 6.4-7.1 6.4 3.2 6.4 7.1-2.9
              7.1-6.4 7.1Z"/>
          </svg>
          Connexion
        </a>`;
    }

    return `
      <div id="pharos-user-badge"
           style="display:flex;align-items:center;gap:8px;flex-shrink:0;">
        <img src="${avatarURL(user)}" alt="${user.username}"
             style="width:26px;height:26px;border-radius:50%;
                    border:1.5px solid ${admin ? '#f0a030' : 'rgba(27,189,138,0.6)'};
                    flex-shrink:0;">
        <span style="font-family:'IBM Plex Mono',monospace;font-size:11px;
                     color:${admin ? '#f0a030' : 'var(--text2)'};">
          ${admin ? '★ ' : ''}${user.global_name || user.username}
        </span>
        ${admin
          ? `<a href="${CFG.BASE_URL}admin/"
                style="font-family:'IBM Plex Mono',monospace;font-size:10px;
                       color:#f0a030;text-decoration:none;
                       background:rgba(240,160,48,0.1);
                       border:1px solid rgba(240,160,48,0.3);
                       padding:2px 8px;border-radius:4px;
                       transition:background .15s;"
                onmouseover="this.style.background='rgba(240,160,48,0.2)';"
                onmouseout="this.style.background='rgba(240,160,48,0.1)';">
              Admin ↗
            </a>`
          : ''}
        <button onclick="window.PharosAuth.logout()"
                title="Déconnexion"
                style="font-family:'IBM Plex Mono',monospace;font-size:11px;
                       color:var(--text3);background:none;border:none;
                       cursor:pointer;padding:2px 6px;border-radius:3px;
                       transition:color .15s;"
                onmouseover="this.style.color='var(--text)';"
                onmouseout="this.style.color='';">✕</button>
      </div>`;
  }

  /* ── INJECT INTO NAV ───────────────────────────────────────── */
  function injectButton(user) {
    // Remove any existing button
    ['pharos-auth-wrap','pharos-login-btn','pharos-user-badge'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.remove();
    });

    const navRight = document.querySelector('.nav-right');
    if (!navRight) return;

    const wrap = document.createElement('div');
    wrap.id = 'pharos-auth-wrap';
    wrap.style.cssText = 'display:flex;align-items:center;gap:8px;flex-shrink:0;';
    wrap.innerHTML = buildBtnHTML(user);

    // Insert before first child (before theme toggle)
    navRight.insertBefore(wrap, navRight.firstChild);
  }

  /* ── INIT ──────────────────────────────────────────────────── */
  async function init() {
    // Check for token stored by callback page
    const token = getToken();
    let user = getUser();

    if (token && !user) {
      try {
        user = await fetchDiscordUser(token);
        setUser(user);
      } catch (e) {
        console.warn('[PharosAuth] Discord token invalid, clearing.', e.message);
        sessionStorage.removeItem(CFG.SESSION_TOKEN_KEY);
      }
    }

    function inject() { injectButton(user); }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', inject);
    } else {
      inject();
    }
  }

  /* ── GITHUB DATA API (used by admin dashboard) ─────────────── */
  const GithubData = {
    _raw: `https://raw.githubusercontent.com/${CFG.GITHUB_REPO}/main/${CFG.DATA_PATH}`,
    _api: `https://api.github.com/repos/${CFG.GITHUB_REPO}/contents/${CFG.DATA_PATH}`,

    async read() {
      const r = await fetch(this._raw + '?t=' + Date.now());
      if (!r.ok) throw new Error('Cannot read data file');
      return r.json();
    },

    async write(dataObj, pat, message) {
      // Get current file SHA (required by GitHub API for updates)
      const meta = await fetch(this._api, {
        headers: { Authorization: 'token ' + pat, Accept: 'application/vnd.github.v3+json' }
      });
      let sha = null;
      if (meta.ok) { const j = await meta.json(); sha = j.sha; }

      const content = btoa(unescape(encodeURIComponent(JSON.stringify(dataObj, null, 2))));
      const body = { message: message || 'Bourse update', content };
      if (sha) body.sha = sha;

      const r = await fetch(this._api, {
        method : 'PUT',
        headers: {
          Authorization : 'token ' + pat,
          Accept        : 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const err = await r.json();
        throw new Error(err.message || 'GitHub API error ' + r.status);
      }
      return r.json();
    },
  };

  /* ── PUBLIC API ────────────────────────────────────────────── */
  window.PharosAuth = {
    logout,
    getUser,
    getToken,
    isAdmin,
    avatarURL,
    CFG,
    GithubData,
  };

  init();
})();
