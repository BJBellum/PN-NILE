/* ═══════════════════════════════════════════════════════════════
   PHAROS AUTH · v3.0 · Royaume-Uni du Nil
   Discord OAuth2 Implicit Flow — localStorage persistant
   ═══════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  const CFG = {
    DISCORD_CLIENT_ID : '1483200078092042300',
    REDIRECT_URI      : 'https://BJBellum.github.io/UKN/auth/callback/',
    DISCORD_SCOPE     : 'identify',
    ADMIN_IDS         : ['772821169664426025'],
    BASE_URL          : 'https://BJBellum.github.io/UKN/',
    GITHUB_REPO       : 'BJBellum/UKN',
    DATA_PATH         : 'data/bourse.json',
    KEY_USER          : 'ukn_user',
    KEY_TOKEN         : 'ukn_token',
    KEY_THEME         : 'run-theme',
    KEY_PAT           : 'pharos_gh_pat',
  };

  /* ── STORAGE ──────────────────────────────────────────────── */
  function getUser() {
    try { return JSON.parse(localStorage.getItem(CFG.KEY_USER)); } catch { return null; }
  }
  function setUser(u) {
    try { localStorage.setItem(CFG.KEY_USER, JSON.stringify(u)); } catch {}
  }
  function getToken() {
    try {
      const raw = localStorage.getItem(CFG.KEY_TOKEN);
      if (!raw) return null;
      const obj = JSON.parse(raw);
      if (obj.expires && Date.now() > obj.expires) {
        localStorage.removeItem(CFG.KEY_TOKEN);
        localStorage.removeItem(CFG.KEY_USER);
        return null;
      }
      return obj.token;
    } catch { return null; }
  }
  function setToken(token, expiresIn) {
    try {
      const expires = Date.now() + (parseInt(expiresIn, 10) || 604800) * 1000;
      localStorage.setItem(CFG.KEY_TOKEN, JSON.stringify({ token, expires }));
    } catch {}
  }
  function logout() {
    localStorage.removeItem(CFG.KEY_USER);
    localStorage.removeItem(CFG.KEY_TOKEN);
    window.location.reload();
  }
  function isAdmin(u) {
    u = u || getUser();
    return !!(u && CFG.ADMIN_IDS.includes(String(u.id)));
  }

  /* ── DISCORD ──────────────────────────────────────────────── */
  function discordLoginURL() {
    let state = 'home';
    try {
      // Ne jamais revenir vers /admin/ depuis le login
      const href = window.location.href.includes('/admin/')
        ? CFG.BASE_URL
        : window.location.href;
      state = btoa(encodeURIComponent(href));
    } catch {}
    const p = new URLSearchParams({
      client_id    : CFG.DISCORD_CLIENT_ID,
      redirect_uri : CFG.REDIRECT_URI,
      response_type: 'token',
      scope        : CFG.DISCORD_SCOPE,
      state,
    });
    return 'https://discord.com/oauth2/authorize?' + p;
  }

  async function fetchDiscordUser(token) {
    const r = await fetch('https://discord.com/api/v10/users/@me', {
      headers: { Authorization: 'Bearer ' + token },
    });
    if (!r.ok) throw new Error('Discord ' + r.status);
    return r.json();
  }

  function avatarURL(u) {
    if (!u) return '';
    if (u.avatar) return `https://cdn.discordapp.com/avatars/${u.id}/${u.avatar}.png?size=32`;
    const def = Number(BigInt(u.id) >> 22n) % 6;
    return `https://cdn.discordapp.com/embed/avatars/${def}.png`;
  }

  /* ── BOUTON NAV ───────────────────────────────────────────── */
  function buildBtnHTML(user) {
    const admin = isAdmin(user);

    if (!user) {
      return `<a id="pharos-login-btn" href="${discordLoginURL()}"
        style="display:flex;align-items:center;gap:7px;font-family:'IBM Plex Mono',monospace;
               font-size:11px;font-weight:500;color:var(--text2);text-decoration:none;
               background:var(--toggle-bg);border:1px solid var(--border2);
               border-radius:20px;padding:5px 12px;letter-spacing:0.04em;
               transition:border-color .2s,color .2s;"
        onmouseover="this.style.borderColor='rgba(88,101,242,0.6)';this.style.color='#5865F2';"
        onmouseout="this.style.borderColor='';this.style.color='';">
        <svg width="14" height="11" viewBox="0 0 71 55" fill="#5865F2" style="flex-shrink:0;">
          <path d="M60.1 4.9A58.5 58.5 0 0 0 45.4.9a41 41 0 0 0-1.8 3.6 54 54 0 0 0-16.2 0A40 40
            0 0 0 25.6.9 58.4 58.4 0 0 0 10.9 5C1.6 18.6-.9 31.8.3 44.8a58.9 58.9 0 0 0 17.9 9
            42 42 0 0 0 3.7-6 38.3 38.3 0 0 1-6-2.9l1.5-1.1a41.9 41.9 0 0 0 36 0l1.5 1.1a38
            38 0 0 1-6 2.9 42 42 0 0 0 3.7 6 58.7 58.7 0 0 0 17.9-9.1C72 29.7 67.9 16.6 60.1
            4.9ZM23.8 37.1c-3.5 0-6.4-3.2-6.4-7.1s2.8-7.1 6.4-7.1 6.4 3.2 6.4 7.1-2.9 7.1-6.4
            7.1Zm23.4 0c-3.5 0-6.4-3.2-6.4-7.1s2.8-7.1 6.4-7.1 6.4 3.2 6.4 7.1-2.9 7.1-6.4 7.1Z"/>
        </svg>
        Connexion
      </a>`;
    }

    return `<div id="pharos-user-badge"
        style="display:flex;align-items:center;gap:8px;flex-shrink:0;">
      <img src="${avatarURL(user)}" alt="${user.username}"
           onerror="this.style.display='none'"
           style="width:26px;height:26px;border-radius:50%;flex-shrink:0;
                  border:1.5px solid ${admin ? '#f0a030' : 'rgba(27,189,138,0.6)'};">
      <span style="font-family:'IBM Plex Mono',monospace;font-size:11px;
                   color:${admin ? '#f0a030' : 'var(--text2)'};">
        ${admin ? '★ ' : ''}${user.global_name || user.username}
      </span>
      ${admin ? `
        <a href="${CFG.BASE_URL}admin/"
           style="font-family:'IBM Plex Mono',monospace;font-size:10px;color:#f0a030;
                  text-decoration:none;background:rgba(240,160,48,0.1);
                  border:1px solid rgba(240,160,48,0.3);padding:2px 8px;border-radius:4px;
                  transition:background .15s;"
           onmouseover="this.style.background='rgba(240,160,48,0.22)';"
           onmouseout="this.style.background='rgba(240,160,48,0.1)';">
          Admin ↗
        </a>` : ''}
      <button onclick="window.PharosAuth.logout()" title="Déconnexion"
              style="font-family:'IBM Plex Mono',monospace;font-size:12px;color:var(--text3);
                     background:none;border:none;cursor:pointer;padding:2px 6px;border-radius:3px;
                     transition:color .15s;"
              onmouseover="this.style.color='var(--text)';"
              onmouseout="this.style.color='';">✕</button>
    </div>`;
  }

  function injectButton(user) {
    document.querySelectorAll('#pharos-auth-wrap,#pharos-login-btn,#pharos-user-badge')
      .forEach(el => el.remove());
    const navRight = document.querySelector('.nav-right');
    if (!navRight) return;
    const wrap = document.createElement('div');
    wrap.id = 'pharos-auth-wrap';
    wrap.style.cssText = 'display:flex;align-items:center;gap:8px;flex-shrink:0;';
    wrap.innerHTML = buildBtnHTML(user);
    navRight.insertBefore(wrap, navRight.firstChild);
  }

  /* ── INIT ─────────────────────────────────────────────────── */
  async function init() {
    let user  = getUser();
    const tok = getToken();

    // Token présent mais pas de user en cache → fetch Discord
    if (tok && !user) {
      try {
        user = await fetchDiscordUser(tok);
        setUser(user);
      } catch {
        localStorage.removeItem(CFG.KEY_TOKEN);
        localStorage.removeItem(CFG.KEY_USER);
        user = null;
      }
    }

    const inject = () => injectButton(user);
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', inject);
    } else {
      inject();
    }
  }

  /* ── API PUBLIQUE ─────────────────────────────────────────── */
  window.PharosAuth = { logout, getUser, getToken, setToken, setUser, isAdmin, avatarURL, CFG };
  init();
})();
