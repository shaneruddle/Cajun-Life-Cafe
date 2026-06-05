import { useEffect, useRef } from 'react';

declare const L: any;

interface Props {
  lat?: number;
  lng?: number;
  onChange: (lat: number, lng: number) => void;
  readOnly?: boolean;
}

const DEFAULT_LAT = 12.9107;
const DEFAULT_LNG = 100.8744;

export default function DeliveryMap({ lat, lng, onChange, readOnly = false }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    // Guard: Leaflet CDN may not have loaded yet
    if (typeof L === 'undefined') {
      console.warn('Leaflet not loaded yet — retrying in 500ms');
      const timer = setTimeout(() => {
        // Force re-mount by clearing ref
        mapRef.current = null;
      }, 500);
      return () => clearTimeout(timer);
    }

    const initLat = lat ?? DEFAULT_LAT;
    const initLng = lng ?? DEFAULT_LNG;

    try {
      const map = L.map(containerRef.current, { zoomControl: true }).setView([initLat, initLng], 15);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap',
        maxZoom: 19,
      }).addTo(map);

      const icon = L.divIcon({
        className: '',
        html: `<div style="width:28px;height:28px;background:#c0392b;border:3px solid white;border-radius:50% 50% 50% 0;transform:rotate(-45deg);box-shadow:0 2px 6px rgba(0,0,0,0.3)"></div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 28],
      });

      const marker = L.marker([initLat, initLng], { draggable: !readOnly, icon }).addTo(map);
      markerRef.current = marker;
      mapRef.current = map;

      if (!readOnly) {
        marker.on('dragend', () => {
          const pos = marker.getLatLng();
          onChange(pos.lat, pos.lng);
        });
        map.on('click', (e: any) => {
          marker.setLatLng(e.latlng);
          onChange(e.latlng.lat, e.latlng.lng);
        });
      }
    } catch (err) {
      console.error('DeliveryMap init error:', err);
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (markerRef.current && lat !== undefined && lng !== undefined) {
      markerRef.current.setLatLng([lat, lng]);
      mapRef.current?.panTo([lat, lng]);
    }
  }, [lat, lng]);

  return (
    <div
      ref={containerRef}
      style={{ height: '220px', borderRadius: '16px', overflow: 'hidden', zIndex: 0 }}
    />
  );
}
