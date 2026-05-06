/**
 * LiveMap — cross-platform live tracking map
 *
 * Uses WebView + Leaflet + OpenStreetMap. No API key needed.
 * Works identically on iOS and Android.
 */
import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';

export interface MapPin {
  lat: number;
  lng: number;
  label?: string;
}

interface Props {
  height?: number;
  rider?:    MapPin | null;
  shop?:     MapPin | null;
  delivery?: MapPin | null;
  // step: 0=placed,1=confirmed/assigned,2=picked_up,3=delivered
  step?: number;
}

// Build a self-contained HTML page with Leaflet embedded inline
function buildMapHTML(rider?: MapPin | null, shop?: MapPin | null, delivery?: MapPin | null, step = 0) {
  // Decide center: rider first, then shop, then delivery
  const center = rider ?? shop ?? delivery ?? { lat: 12.9352, lng: 77.6245 };

  const markers: string[] = [];

  if (shop) {
    markers.push(`
      var shopIcon = L.divIcon({
        html: '<div style="font-size:22px;line-height:1;filter:drop-shadow(0 2px 3px rgba(0,0,0,0.3))">🏪</div>',
        className: '', iconAnchor:[12,22]
      });
      L.marker([${shop.lat}, ${shop.lng}], {icon: shopIcon})
        .addTo(map)
        .bindPopup('<b>${(shop.label ?? 'Shop').replace(/'/g, "&#39;")}</b><br>Pickup point');
    `);
  }

  if (delivery) {
    markers.push(`
      var delIcon = L.divIcon({
        html: '<div style="font-size:22px;line-height:1;filter:drop-shadow(0 2px 3px rgba(0,0,0,0.3))">📍</div>',
        className: '', iconAnchor:[11,22]
      });
      L.marker([${delivery.lat}, ${delivery.lng}], {icon: delIcon})
        .addTo(map)
        .bindPopup('<b>Your location</b><br>${(delivery.label ?? '').replace(/'/g, "&#39;")}');
    `);
  }

  if (rider) {
    markers.push(`
      var riderIcon = L.divIcon({
        html: '<div style="font-size:26px;line-height:1;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.35))">🛵</div>',
        className: '', iconAnchor:[13,22]
      });
      window._riderMarker = L.marker([${rider.lat}, ${rider.lng}], {icon: riderIcon})
        .addTo(map)
        .bindPopup('<b>${(rider.label ?? 'Rider').replace(/'/g, "&#39;")}</b><br>Your delivery partner');
    `);
  }

  // Dashed line shop→rider (picking up phase), solid line rider→delivery (en route)
  const lines: string[] = [];
  if (shop && rider) {
    lines.push(`
      L.polyline([[${shop.lat},${shop.lng}],[${rider.lat},${rider.lng}]], {
        color:'#FF8A00', weight:3, dashArray:'8,5', opacity:0.8
      }).addTo(map);
    `);
  }
  if (rider && delivery && step >= 2) {
    lines.push(`
      L.polyline([[${rider.lat},${rider.lng}],[${delivery.lat},${delivery.lng}]], {
        color:'#FF8A00', weight:3, opacity:0.9
      }).addTo(map);
    `);
  }

  // Fit bounds to all known pins
  const allCoords = [shop, rider, delivery].filter(Boolean) as MapPin[];
  const fitScript = allCoords.length >= 2
    ? `map.fitBounds([${allCoords.map(p => `[${p.lat},${p.lng}]`).join(',')}], {padding:[40,40]});`
    : `map.setView([${center.lat},${center.lng}], 15);`;

  return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  html, body, #map { width:100%; height:100%; }
  .leaflet-control-attribution { display:none; }
</style>
</head>
<body>
<div id="map"></div>
<script>
  var map = L.map('map', { zoomControl:true, attributionControl:false });
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom:19
  }).addTo(map);

  ${markers.join('\n')}
  ${lines.join('\n')}
  ${fitScript}

  // Listen for rider position updates from React Native
  window.addEventListener('message', function(e) {
    try {
      var d = JSON.parse(e.data);
      if (d.type === 'updateRider' && window._riderMarker) {
        window._riderMarker.setLatLng([d.lat, d.lng]);
      }
    } catch(err) {}
  });
  document.addEventListener('message', function(e) {
    try {
      var d = JSON.parse(e.data);
      if (d.type === 'updateRider' && window._riderMarker) {
        window._riderMarker.setLatLng([d.lat, d.lng]);
      }
    } catch(err) {}
  });
</script>
</body>
</html>`;
}

export default function LiveMap({ height = 220, rider, shop, delivery, step = 0 }: Props) {
  const webRef = useRef<WebView>(null);
  const prevRider = useRef<MapPin | null | undefined>(null);

  // Instead of re-rendering the whole map, just push rider position update
  useEffect(() => {
    if (!webRef.current || !rider) return;
    const prev = prevRider.current;
    // Only push if coords actually changed
    if (prev && prev.lat === rider.lat && prev.lng === rider.lng) return;
    prevRider.current = rider;
    webRef.current.postMessage(JSON.stringify({ type: 'updateRider', lat: rider.lat, lng: rider.lng }));
  }, [rider?.lat, rider?.lng]);

  const html = buildMapHTML(rider, shop, delivery, step);

  return (
    <View style={[styles.wrapper, { height }]}>
      <WebView
        ref={webRef}
        originWhitelist={['*']}
        source={{ html }}
        style={styles.map}
        scrollEnabled={false}
        bounces={false}
        javaScriptEnabled
        // Allow loading Leaflet tiles from openstreetmap.org
        mixedContentMode="always"
        // Android: hardware acceleration
        androidHardwareAccelerationDisabled={false}
      />
      {/* LIVE badge overlay */}
      <View style={styles.liveBadge} pointerEvents="none">
        <View style={styles.liveDot} />
        <Text style={styles.liveTxt}>LIVE</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper:    { borderRadius: 20, overflow: 'hidden',
                 shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 10,
                 shadowOffset: { width: 0, height: 3 } },
  map:        { flex: 1, backgroundColor: '#e8e0d8' },
  liveBadge:  { position: 'absolute', top: 10, right: 10, flexDirection: 'row', alignItems: 'center',
                 backgroundColor: 'rgba(0,0,0,0.65)', borderRadius: 99,
                 paddingHorizontal: 10, paddingVertical: 5, gap: 5 },
  liveDot:    { width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#22C55E' },
  liveTxt:    { color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 1 },
});
