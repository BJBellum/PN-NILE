/* pharos-auth.js — Authentification Discord · Pharos Energy
   Inclure dans chaque page AVANT la fermeture de </body>
   <script src="../pharos-auth.js"></script>  (ou ../../ selon la profondeur)
*/

(function() {
  // ══ CONFIGURATION ══════════════════════════════════════════════
  const DISCORD_CLIENT_ID = '1483200078092042300';
  const REDIRECT_URI      = 'https://BJBellum.github.io/PharosEnergy/auth/callback/';
  const ALLOWED_IDS       = ['772821169664426025'];

  // Scopes demandés à Discord (identify = profil de base, guilds.members.read = rôles serveur)
  const SCOPES = 'identify';

  // Profondeur relative depuis la page courante vers la racine
  // Déterminé automatiquement via le chemin
  // ═══════════════════════════════════════════════════════════════

  /* ── Calcul du chemin relatif vers la racine ── */
  function getRootPath() {
    const depth = window.location.pathname.split('/').filter(Boolean).length;
    // Sur GitHub Pages: /repo/ = depth 1, /repo/nildu/ = depth 2, etc.
    // On enlève 1 car le dernier segment est le fichier ou dossier de la page
    const levels = Math.max(0, depth - 1);
    return levels === 0 ? './' : '../'.repeat(levels);
  }

  /* ── Session ── */
  function getSession() {
    try {
      const s = JSON.parse(localStorage.getItem('pharos_session') || 'null');
      if (!s) return null;
      if (s.expires && Date.now() > s.expires) { localStorage.removeItem('pharos_session'); return null; }
      return s;
    } catch { return null; }
  }

  function isAuthorized() {
    const s = getSession();
    return s && s.authorized === true;
  }

  function logout() {
    localStorage.removeItem('pharos_session');
    localStorage.removeItem('pharos_return');
    window.location.reload();
  }

  /* ── Lancer OAuth2 ── */
  function login() {
    // Sauvegarder la page actuelle pour y revenir après auth
    localStorage.setItem('pharos_return', window.location.href);
    // Générer un state anti-CSRF
    const state = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
    sessionStorage.setItem('discord_oauth_state', state);

    const params = new URLSearchParams({
      client_id: DISCORD_CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      response_type: 'code',
      scope: SCOPES,
      state,
    });
    window.location.href = `https://discord.com/oauth2/authorize?${params}`;
  }

  /* ── Avatar Discord ── */
  function getAvatarUrl(session) {
    if (!session.avatar) return null;
    return `https://cdn.discordapp.com/avatars/${session.id}/${session.avatar}.png?size=32`;
  }

  /* ── Injecter le bouton dans la nav ── */
  function injectAuthButton() {
    const navRight = document.querySelector('.nav-right');
    if (!navRight) return;

    const session = getSession();
    const btn = document.createElement('div');
    btn.id = 'pharos-auth-btn';
    btn.style.cssText = 'display:flex;align-items:center;gap:6px;cursor:pointer;padding:4px 10px;border-radius:4px;border:1px solid;font-family:"IBM Plex Mono",monospace;font-size:10px;letter-spacing:0.05em;transition:all .2s;user-select:none;text-decoration:none;';

    if (!session) {
      // Non connecté
      btn.style.borderColor = 'rgba(88,101,242,0.5)';
      btn.style.background  = 'rgba(88,101,242,0.08)';
      btn.style.color       = '#7983f5';
      btn.innerHTML = `<svg width="14" height="11" viewBox="0 0 71 55" fill="none" style="flex-shrink:0"><path d="M60.1 4.9A58.5 58.5 0 0 0 45.5 0a40 40 0 0 0-1.8 3.7 54 54 0 0 0-16.4 0A40 40 0 0 0 25.5 0 58.7 58.7 0 0 0 10.9 5C1.6 18.7-1 32 .3 45.1a59.2 59.2 0 0 0 18.1 9.2 44.9 44.9 0 0 0 3.9-6.3 38.4 38.4 0 0 1-6.1-2.9l1.4-1.1a42.1 42.1 0 0 0 36.2 0l1.5 1.1a38.3 38.3 0 0 1-6.1 3 44.7 44.7 0 0 0 3.8 6.3 59 59 0 0 0 18.1-9.2C72.5 30 69.5 16.8 60.1 4.9ZM23.7 37a6.8 6.8 0 0 1-6.4-7.2 6.8 6.8 0 0 1 6.4-7.1 6.8 6.8 0 0 1 6.3 7.1A6.8 6.8 0 0 1 23.7 37Zm23.6 0a6.8 6.8 0 0 1-6.4-7.2 6.8 6.8 0 0 1 6.4-7.1 6.8 6.8 0 0 1 6.3 7.1A6.8 6.8 0 0 1 47.3 37Z" fill="currentColor"/></svg>Connexion Discord`;
      btn.onclick = login;
      btn.onmouseenter = function() { this.style.borderColor='rgba(88,101,242,0.9)'; this.style.background='rgba(88,101,242,0.15)'; };
      btn.onmouseleave = function() { this.style.borderColor='rgba(88,101,242,0.5)'; this.style.background='rgba(88,101,242,0.08)'; };
    } else {
      // Connecté
      const color  = isAuthorized() ? '#22c55e' : '#7a9ac0';
      const border = isAuthorized() ? 'rgba(34,197,94,0.4)' : 'rgba(122,154,192,0.3)';
      const bg     = isAuthorized() ? 'rgba(34,197,94,0.07)' : 'rgba(122,154,192,0.07)';
      btn.style.borderColor = border;
      btn.style.background  = bg;
      btn.style.color       = color;

      // Avatar ou initiale
      const avatarUrl = getAvatarUrl(session);
      const avatarHtml = avatarUrl
        ? `<img src="${avatarUrl}" width="16" height="16" style="border-radius:50%;vertical-align:middle" onerror="this.style.display='none'">`
        : `<span style="width:16px;height:16px;border-radius:50%;background:${color};opacity:0.5;display:inline-flex;align-items:center;justify-content:center;font-size:9px">${(session.username||'?')[0].toUpperCase()}</span>`;

      btn.innerHTML = `${avatarHtml}<span style="max-width:90px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${session.username}</span>`;
      btn.title = isAuthorized() ? 'Accès complet — cliquer pour déconnecter' : 'Accès standard — cliquer pour déconnecter';

      // Dropdown déconnexion au clic
      btn.onclick = function(e) {
        e.stopPropagation();
        const existing = document.getElementById('pharos-auth-dropdown');
        if (existing) { existing.remove(); return; }
        const dd = document.createElement('div');
        dd.id = 'pharos-auth-dropdown';
        dd.style.cssText = `position:fixed;top:${btn.getBoundingClientRect().bottom+4}px;right:28px;background:var(--bg2,#111520);border:1px solid rgba(255,255,255,0.12);border-radius:8px;padding:8px;z-index:9999;min-width:180px;box-shadow:0 8px 24px rgba(0,0,0,0.5);`;
        dd.innerHTML = `
          <div style="font-family:'IBM Plex Mono',monospace;font-size:10px;color:#545d72;margin-bottom:6px;padding:0 4px">Connecté via Discord</div>
          <div style="font-family:'IBM Plex Mono',monospace;font-size:11px;color:${color};padding:0 4px 6px;border-bottom:1px solid rgba(255,255,255,0.07)">${isAuthorized() ? '✓ Accès complet autorisé' : '○ Accès standard'}</div>
          <div onclick="window.__pharosLogout()" style="margin-top:6px;padding:6px 8px;border-radius:4px;cursor:pointer;font-family:'IBM Plex Mono',monospace;font-size:11px;color:#e84848;transition:background .15s" onmouseenter="this.style.background='rgba(232,72,72,0.1)'" onmouseleave="this.style.background='transparent'">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" style="vertical-align:-1px;margin-right:5px"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
            Déconnecter
          </div>`;
        document.body.appendChild(dd);
        setTimeout(() => document.addEventListener('click', function rm() { dd.remove(); document.removeEventListener('click', rm); }, { once:true }), 0);
      };
    }

    // Insérer avant le toggle thème
    const themeToggle = navRight.querySelector('.theme-toggle');
    if (themeToggle) navRight.insertBefore(btn, themeToggle);
    else navRight.appendChild(btn);
  }

  /* ── Contrôle d'accès aux sections réservées ── */
  function applyAccessControl() {
    // Les éléments avec data-auth="required" sont masqués si non autorisé
    document.querySelectorAll('[data-auth="required"]').forEach(el => {
      if (!isAuthorized()) {
        el.style.display = 'none';
      }
    });

    // Éléments avec data-auth="locked" reçoivent un overlay "accès restreint"
    document.querySelectorAll('[data-auth="locked"]').forEach(el => {
      if (!isAuthorized()) {
        el.style.position = 'relative';
        el.style.pointerEvents = 'none';
        el.style.userSelect = 'none';
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:absolute;inset:0;background:rgba(9,12,18,0.85);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;border-radius:inherit;z-index:10;';
        overlay.innerHTML = `<div style="text-align:center;font-family:'IBM Plex Mono',monospace">
          <div style="font-size:20px;margin-bottom:8px;opacity:0.6">🔒</div>
          <div style="font-size:12px;color:#7a9ac0;margin-bottom:4px">Accès restreint</div>
          <div style="font-size:10px;color:#4a6080">Connexion Discord requise</div>
        </div>`;
        el.appendChild(overlay);
      }
    });
  }

  /* ── Export global ── */
  window.__pharosLogout = logout;
  window.__pharosLogin  = login;
  window.__pharosSession = getSession;
  window.__pharosIsAuthorized = isAuthorized;

  /* ── Init au chargement ── */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      injectAuthButton();
      applyAccessControl();
    });
  } else {
    injectAuthButton();
    applyAccessControl();
  }

})();
