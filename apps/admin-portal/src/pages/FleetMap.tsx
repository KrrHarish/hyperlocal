import React, { useEffect, useRef, useState, useCallback } from 'react'
import { getRidersLive } from '../api/client'

interface LiveRider {
  id: string
  name: string
  phone: string
  vehicle_type: string
  lat: number
  lng: number
  trust_score: number
  source: 'redis' | 'db'
}

function buildMapHTML(riders: LiveRider[]) {
  const center = riders.length > 0
    ? { lat: riders[0].lat, lng: riders[0].lng }
    : { lat: 12.9352, lng: 77.6245 } // Bangalore default

  const markerJS = riders.map(r => `
    (function() {
      var icon = L.divIcon({
        html: '<div style="background:#22C55E;border:2px solid #fff;border-radius:50%;width:32px;height:32px;display:flex;align-items:center;justify-content:center;font-size:16px;box-shadow:0 2px 6px rgba(0,0,0,0.4)">🛵</div>',
        className: '', iconAnchor: [16, 16], popupAnchor: [0, -18]
      });
      var m = L.marker([${r.lat}, ${r.lng}], { icon: icon }).addTo(map);
      m.bindPopup('<div style="font-family:sans-serif;min-width:160px"><b style="font-size:14px">${r.name.replace(/'/g, "&#39;")}</b><br><span style="color:#888;font-size:12px">${r.phone}</span><br><span style="font-size:12px;margin-top:4px;display:block;text-transform:capitalize">${r.vehicle_type} · Score: ${r.trust_score}</span>${r.source === 'redis' ? '<span style="color:#22C55E;font-size:11px">● Live</span>' : '<span style="color:#F59E0B;font-size:11px">● DB cached</span>'}</div>');
      window._markers["${r.id}"] = m;
    })();
  `).join('\n')

  const bounds = riders.length >= 2
    ? `map.fitBounds([${riders.map(r => `[${r.lat},${r.lng}]`).join(',')}], {padding:[60,60], maxZoom:14});`
    : `map.setView([${center.lat}, ${center.lng}], 13);`

  return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  html,body,#map{width:100%;height:100%;background:#1a1a1a}
  .leaflet-control-attribution{display:none}
  .leaflet-tile{filter:brightness(0.85) saturate(0.9)}
</style>
</head>
<body>
<div id="map"></div>
<script>
  var map = L.map('map',{zoomControl:true,attributionControl:false});
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19}).addTo(map);
  window._markers = {};
  ${markerJS}
  ${bounds}

  // Accept position updates from React
  function handleMsg(e) {
    try {
      var d = JSON.parse(typeof e.data === 'string' ? e.data : JSON.stringify(e.data));
      if (d.type === 'updateRiders') {
        // Remove old markers
        Object.values(window._markers).forEach(function(m){map.removeLayer(m)});
        window._markers = {};
        d.riders.forEach(function(r) {
          var icon = L.divIcon({
            html: '<div style="background:#22C55E;border:2px solid #fff;border-radius:50%;width:32px;height:32px;display:flex;align-items:center;justify-content:center;font-size:16px;box-shadow:0 2px 6px rgba(0,0,0,0.4)">🛵</div>',
            className:'', iconAnchor:[16,16], popupAnchor:[0,-18]
          });
          var m = L.marker([r.lat, r.lng],{icon:icon}).addTo(map);
          m.bindPopup('<b>'+r.name+'</b><br><span style="color:#888;font-size:12px">'+r.phone+'</span>');
          window._markers[r.id] = m;
        });
      }
    } catch(err){}
  }
  window.addEventListener('message', handleMsg);
  document.addEventListener('message', handleMsg);
</script>
</body>
</html>`
}

export default function FleetMap() {
  const [riders,    setRiders]    = useState<LiveRider[]>([])
  const [loading,   setLoading]   = useState(true)
  const [lastUpdate,setLastUpdate]= useState<Date | null>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const initialized = useRef(false)

  const fetchRiders = useCallback(async () => {
    try {
      const res = await getRidersLive()
      const fresh: LiveRider[] = res.data.riders ?? []
      setRiders(fresh)
      setLastUpdate(new Date())

      // After first load rebuild full map; subsequent updates just push positions
      if (!initialized.current) {
        initialized.current = true
        // iframe will re-render via key change below
      } else if (iframeRef.current?.contentWindow) {
        iframeRef.current.contentWindow.postMessage(
          JSON.stringify({ type: 'updateRiders', riders: fresh }),
          '*'
        )
      }
    } catch {}
    finally { setLoading(false) }
  }, [])

  // Initial load
  useEffect(() => {
    fetchRiders()
  }, [fetchRiders])

  // Poll every 5s
  useEffect(() => {
    const t = setInterval(fetchRiders, 5000)
    return () => clearInterval(t)
  }, [fetchRiders])

  const html = buildMapHTML(riders)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{ padding: '20px 28px 16px', borderBottom: '1px solid #1e1e1e', background: '#111', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 800, color: '#fff', margin: 0 }}>Fleet Map</h1>
            <p style={{ color: '#555', fontSize: 13, marginTop: 3 }}>
              Live positions of online riders · Updates every 5s
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            {lastUpdate && (
              <span style={{ fontSize: 12, color: '#444' }}>
                Updated {lastUpdate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            )}
            <button
              onClick={() => { initialized.current = false; fetchRiders() }}
              style={{ padding: '7px 14px', background: '#161616', border: '1px solid #2a2a2a', borderRadius: 8, color: '#aaa', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
            >
              ↺ Refresh
            </button>
          </div>
        </div>

        {/* Rider chips */}
        {riders.length > 0 && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
            {riders.map(r => (
              <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', background: '#0d2a18', border: '1px solid #1a4a28', borderRadius: 99, fontSize: 12 }}>
                <div style={{ width: 6, height: 6, borderRadius: 3, background: r.source === 'redis' ? '#22C55E' : '#F59E0B' }} />
                <span style={{ color: '#fff', fontWeight: 600 }}>{r.name}</span>
                <span style={{ color: '#555', textTransform: 'capitalize' }}>{r.vehicle_type}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Map area */}
      <div style={{ flex: 1, position: 'relative' }}>
        {loading && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a0a', zIndex: 10 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>🛵</div>
              <div style={{ color: '#22C55E', fontWeight: 700 }}>Loading riders...</div>
            </div>
          </div>
        )}

        {!loading && riders.length === 0 && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a0a', zIndex: 10 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🛵</div>
              <div style={{ color: '#555', fontWeight: 700, fontSize: 16 }}>No riders online right now</div>
              <div style={{ color: '#333', fontSize: 13, marginTop: 6 }}>Map will populate once a rider goes online</div>
            </div>
          </div>
        )}

        <iframe
          ref={iframeRef}
          key={riders.length === 0 ? 'empty' : 'loaded'}   // rebuild iframe when first riders arrive
          srcDoc={html}
          style={{ width: '100%', height: '100%', border: 'none' }}
          sandbox="allow-scripts allow-same-origin"
          title="Fleet Map"
        />

        {/* Online count badge */}
        <div style={{ position: 'absolute', bottom: 20, right: 20, background: 'rgba(0,0,0,0.8)', border: '1px solid #22C55E33', borderRadius: 10, padding: '10px 16px', zIndex: 5 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: 4, background: '#22C55E' }} />
            <span style={{ color: '#22C55E', fontWeight: 800, fontSize: 18 }}>{riders.length}</span>
            <span style={{ color: '#555', fontSize: 13 }}>rider{riders.length !== 1 ? 's' : ''} online</span>
          </div>
        </div>
      </div>
    </div>
  )
}
