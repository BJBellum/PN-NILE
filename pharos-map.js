/* pharos-map.js — Carte interactive Pharos Energy · Projet Résurgence */
window.PharosMap = (function () {

  const TERRITORY = [
    // Lobe NW (désert occidental / grand blob)
    [31.18, 23.53], [31.59, 24.42], [31.54, 25.83],
    [31.11, 26.87], [30.83, 27.77],
    // Jonction blob → delta
    [31.07, 28.37],
    // Delta du Nil (bande nord)
    [31.28, 29.0], [31.37, 29.7], [31.21, 30.1],
    [31.42, 30.4], [31.15, 30.8],
    // Sinaï / golfe de Suez
    [30.76, 31.0], [30.26, 30.8],
    // Vallée du Nil - côté est (descente S)
    [29.69, 30.67], [29.05, 30.83], [28.43, 31.0],
    [27.77, 31.17], [27.12, 31.4], [26.5, 31.8],
    [25.9, 32.13], [25.35, 32.5],
    // Extension SE (mer Rouge / Nubie)
    [24.79, 32.67],
    // Retour côté ouest (remontée)
    [24.52, 31.58], [24.7, 30.63], [25.19, 30.13],
    [25.86, 29.97], [26.45, 30.17], [27.04, 29.9],
    [27.68, 29.67], [28.31, 29.5], [28.93, 29.43],
    [29.57, 29.5], [30.24, 29.37],
    // Bas du lobe NW
    [30.0, 28.8], [29.81, 27.97], [29.65, 27.27],
    [29.46, 26.47], [29.29, 25.6], [29.48, 24.8],
    [29.69, 24.0], [30.12, 23.43], [30.59, 23.17],
    [30.99, 23.33],
    // Fermeture
    [31.18, 23.53],
  ];

  const DARK_TILE  = 'https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png';
  const LIGHT_TILE = 'https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png';
  const ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright" style="color:#545d72">OSM</a> &copy; <a href="https://carto.com/" style="color:#545d72">CARTO</a>';

  const SITES = [
    { lat: 29.34013, lon: 30.94513, label: 'NILDU', sub: 'Centrale nucléaire · Médinet El-Fayoum', ref: 'NILDU-REF-001', status: 'En construction', color: '#1bbd8a' },
    { lat: 30.21796, lon: 31.25895, label: 'MEMPHIS', sub: 'Pile atomique · Le Caire', ref: 'MEMPHIS-PILE-001', status: 'En service', color: '#8b6fd4' },
    { lat: 23.96933, lon: 32.87741, label: "Barrage d'Assouan", sub: 'Centrale hydroélectrique · Nil', ref: 'ASSOUAN-HDA-001', status: 'En service', color: '#3b82f6' }
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

  function init(containerId, opts) {
    opts = Object.assign({ siteRef: null, zoom: 5, centerLat: 27.5, centerLon: 30.5, theme: document.documentElement.getAttribute('data-theme') || 'dark' }, opts);

    const map = L.map(containerId, { center: [opts.centerLat, opts.centerLon], zoom: opts.zoom, zoomControl: true, attributionControl: true, scrollWheelZoom: false });
    map.attributionControl.setPrefix('');

    const tileUrl = opts.theme === 'light' ? LIGHT_TILE : DARK_TILE;
    let tileLayer = L.tileLayer(tileUrl, { attribution: ATTR, maxZoom: 18 }).addTo(map);

    // Territoire désactivé (frontières masquées)
    // L.polygon(TERRITORY, ...).addTo(map);

    // Marqueurs
    SITES.forEach(site => {
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
