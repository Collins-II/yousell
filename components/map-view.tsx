"use client";

import { useEffect, useRef } from "react";
import type { Map as LeafletMap } from "leaflet";
import "leaflet/dist/leaflet.css";

export type MapPoint = {
  id: string;
  lat: number;
  lng: number;
  label: string;
  title: string;
  href: string;
  image: string | null;
  auction: boolean;
  subtitle: string;
};

const TILES = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function MapView({ points, className = "h-[70vh]", single = false }: { points: MapPoint[]; className?: string; single?: boolean }) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !el.current) return;
      map.current?.remove();
      const m = L.map(el.current, { scrollWheelZoom: !single, zoomControl: true }).setView([points[0]?.lat ?? -15.4, points[0]?.lng ?? 28.3], single ? 14 : 5);
      L.tileLayer(TILES, { attribution: ATTRIBUTION, maxZoom: 19 }).addTo(m);
      const bounds = L.latLngBounds([]);
      for (const p of points) {
        const icon = L.divIcon({ className: `map-pin ${p.auction ? "auction" : ""}`, html: `<span>${esc(p.label)}</span>`, iconSize: [0, 0] });
        const marker = L.marker([p.lat, p.lng], { icon }).addTo(m);
        if (!single) {
          marker.bindPopup(
            `<a href="${esc(p.href)}" style="display:block;width:200px;text-decoration:none;color:inherit">${p.image ? `<img src="${esc(p.image)}" alt="" style="width:100%;height:110px;object-fit:cover;border-radius:10px;margin-bottom:8px"/>` : ""}<strong style="display:block;font-size:13px">${esc(p.title)}</strong><span style="font-size:12px;opacity:.7">${esc(p.subtitle)}</span></a>`,
          );
        }
        bounds.extend([p.lat, p.lng]);
      }
      if (!single && points.length > 1) m.fitBounds(bounds, { padding: [40, 40], maxZoom: 13 });
      else if (!single && points.length === 1) m.setView([points[0].lat, points[0].lng], 12);
      map.current = m;
    })();
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
    };
  }, [points, single]);

  return <div ref={el} className={`w-full overflow-hidden rounded-xl border border-line ${className}`} role="region" aria-label="Map" />;
}
