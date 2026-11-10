"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap, Marker } from "leaflet";
import { Crosshair, Loader2, MapPin, Search, X } from "lucide-react";
import "leaflet/dist/leaflet.css";

type Pos = { lat: number; lng: number } | null;

export function LocationPicker({ initial, queryHint }: { initial?: Pos; queryHint?: () => string }) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const marker = useRef<Marker | null>(null);
  const leaflet = useRef<typeof import("leaflet") | null>(null);
  const [pos, setPos] = useState<Pos>(initial ?? null);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const place = (p: Pos, zoom?: number) => {
    const L = leaflet.current;
    const m = map.current;
    if (!L || !m) return;
    marker.current?.remove();
    marker.current = null;
    if (p) {
      marker.current = L.marker([p.lat, p.lng], { draggable: true }).addTo(m);
      marker.current.on("dragend", () => {
        const ll = marker.current!.getLatLng();
        setPos({ lat: +ll.lat.toFixed(6), lng: +ll.lng.toFixed(6) });
      });
      m.setView([p.lat, p.lng], zoom ?? Math.max(m.getZoom(), 13));
    }
    setPos(p);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !el.current) return;
      // Default Leaflet marker images aren't bundled; draw a CSS pin instead
      L.Marker.prototype.options.icon = L.divIcon({ className: "map-pin", html: "<span>●</span>", iconSize: [0, 0] });
      leaflet.current = L;
      const m = L.map(el.current).setView([initial?.lat ?? -15.4, initial?.lng ?? 28.3], initial ? 14 : 5);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>', maxZoom: 19 }).addTo(m);
      m.on("click", (e) => place({ lat: +e.latlng.lat.toFixed(6), lng: +e.latlng.lng.toFixed(6) }));
      map.current = m;
      if (initial) place(initial, 14);
    })();
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const search = async () => {
    const q = (query || queryHint?.() || "").trim();
    if (!q) return setNote("Type an address or place to search");
    setBusy(true);
    setNote(null);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`, { headers: { Accept: "application/json" } });
      const [hit] = (await res.json()) as { lat: string; lon: string }[];
      if (hit) place({ lat: +(+hit.lat).toFixed(6), lng: +(+hit.lon).toFixed(6) }, 15);
      else setNote("No match found — click the map to drop a pin instead");
    } catch {
      setNote("Search is unavailable right now — click the map to drop a pin");
    } finally {
      setBusy(false);
    }
  };

  const locate = () => {
    if (!navigator.geolocation) return setNote("Geolocation isn't supported on this device");
    navigator.geolocation.getCurrentPosition(
      (g) => place({ lat: +g.coords.latitude.toFixed(6), lng: +g.coords.longitude.toFixed(6) }, 15),
      () => setNote("Couldn't get your location"),
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-52 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void search();
              }
            }}
            placeholder="Search an address or area"
            className="field !pl-9"
          />
        </div>
        <button type="button" onClick={search} disabled={busy} className="btn-ghost">
          {busy ? <Loader2 className="size-4 animate-spin" /> : <MapPin className="size-4" />} Find
        </button>
        <button type="button" onClick={locate} className="btn-ghost"><Crosshair className="size-4" /> My location</button>
        {pos && <button type="button" onClick={() => place(null)} className="btn-ghost" aria-label="Clear pin"><X className="size-4" /></button>}
      </div>
      <div ref={el} className="h-64 w-full overflow-hidden rounded-xl border border-line" />
      <p className="text-xs text-muted">{note ?? (pos ? `Pin set at ${pos.lat}, ${pos.lng}. Drag it to fine-tune.` : "Click the map to drop a pin. Listings with a pin appear on the map view.")}</p>
      <input type="hidden" name="lat" value={pos?.lat ?? ""} />
      <input type="hidden" name="lng" value={pos?.lng ?? ""} />
    </div>
  );
}
