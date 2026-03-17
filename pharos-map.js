/* pharos-map.js — Carte interactive Pharos Energy · Projet Résurgence */
window.PharosMap = (function () {

  const DARK_TILE  = 'https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png';
  const LIGHT_TILE = 'https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png';
  const ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright" style="color:#545d72">OSM</a> &copy; <a href="https://carto.com/" style="color:#545d72">CARTO</a>';

  // nuclear: true  → marqueur réservé aux utilisateurs autorisés (Discord)
  const SITES = [
    { lat: 29.34013, lon: 30.94513, label: 'NILDU',            sub: 'Centrale nucléaire · Médinet El-Fayoum', ref: 'NILDU-REF-001',    status: 'En construction', color: '#1bbd8a', nuclear: true  },
    { lat: 30.21796, lon: 31.25895, label: 'MEMPHIS',          sub: 'Pile atomique · Le Caire',               ref: 'MEMPHIS-PILE-001', status: 'En service',      color: '#8b6fd4', nuclear: true  },
    { lat: 23.96933, lon: 32.87741, label: "Barrage d'Assouan", sub: 'Centrale hydroélectrique · Nil',        ref: 'ASSOUAN-HDA-001',  status: 'En service',      color: '#3b82f6', nuclear: false },
  ];

  function makeIcon(color, active) {
    const size = active ? 28 : 20;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${Math.round(size*1.33)}" viewBox="0 0 24 32">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 9 12 20 12 20S24 21 24 12C24 5.37 18.63 0 12 0z" fill="${color}" opacity="${active ? 1 : 0.55}"/>
      <circle cx="12" cy="12" r="5" fill="white" opacity="0.9"/>
      <circle cx="12" cy="12" r="2.5" fill="${color}"/>
    </svg>`;
    return L.divIcon({ html: svg, className: '', iconSize: [size, Math.round(size*1.33)], iconAnchor: [size/2, Math.round(size*1.33)], popupAnchor: [0, -Math.round(size*1.33)-2] });
  }

  /* Vérifie si l'utilisateur est autorisé via pharos-auth.js */
  function isAuthorized() {
    return typeof window.__pharosIsAuthorized === 'function' && window.__pharosIsAuthorized();
  }

  function init(containerId, opts) {
    opts = Object.assign({ siteRef: null, zoom: 5, centerLat: 27.5, centerLon: 30.5, theme: document.documentElement.getAttribute('data-theme') || 'dark' }, opts);

    const map = L.map(containerId, { center: [opts.centerLat, opts.centerLon], zoom: opts.zoom, zoomControl: true, attributionControl: true, scrollWheelZoom: false });
    map.attributionControl.setPrefix('');

    const tileUrl = opts.theme === 'light' ? LIGHT_TILE : DARK_TILE;
    const tileLayer = L.tileLayer(tileUrl, { attribution: ATTR, maxZoom: 18 }).addTo(map);

    const authorized = isAuthorized();

    // Marqueurs — les sites nucléaires ne sont affichés qu'aux utilisateurs autorisés
    SITES.forEach(site => {
      if (site.nuclear && !authorized) return;

      const active = opts.siteRef === site.ref;
      const marker = L.marker([site.lat, site.lon], { icon: makeIcon(site.color, active) }).addTo(map);
      marker.bindPopup(
        `<div style="font-family:'IBM Plex Mono',monospace;min-width:160px">
          <div style="font-weight:600;font-size:13px;color:${site.color};margin-bottom:2px">${site.label}</div>
          <div style="font-size:10px;color:#8b93a8;margin-bottom:5px">${site.ref}</div>
          <div style="font-size:11px;color:#c8ccd8">${site.sub}</div>
          <div style="margin-top:6px;font-size:10px;color:${site.color}">${site.status}</div>
        </div>`,
        { className: 'pharos-popup', closeButton: false }
      );
      if (active) setTimeout(() => marker.openPopup(), 400);
    });

    // Thème réactif
    map._pharosThemeLayer = tileLayer;
    map.on('click', () => map.scrollWheelZoom.enable());
    map.on('mouseout', () => map.scrollWheelZoom.disable());

    return map;
  }

  function setTheme(map, theme) {
    if (!map) return;
    map.eachLayer(l => { if (l instanceof L.TileLayer) map.removeLayer(l); });
    L.tileLayer(theme === 'light' ? LIGHT_TILE : DARK_TILE, { attribution: ATTR, maxZoom: 18 }).addTo(map);
  }

  return { init, setTheme };
})();
