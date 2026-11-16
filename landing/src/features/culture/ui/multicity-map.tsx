"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { Map as MapInstance, GeoJSONSource } from "maplibre-gl"
import "maplibre-gl/dist/maplibre-gl.css"
import { createCultureClient } from "../../../../../shared/culture/client"
import { eventText } from "../../../../../shared/culture/catalog"
import type { Locale, MapBounds, MapEvent, MapFilters } from "../../../../../shared/culture/types"

const client = createCultureClient("")
const emptyFilters: MapFilters = { cities: [], festivals: [] }

export default function MulticityMap({ from, locale }: { from: string; locale: Locale }) {
  const container = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapInstance | null>(null)
  const [map, setMap] = useState<MapInstance | null>(null)
  const [bounds, setBounds] = useState<MapBounds | null>(null)
  const [filters, setFilters] = useState(emptyFilters)
  const [city, setCity] = useState("")
  const [festival, setFestival] = useState("")
  const [day, setDay] = useState("")
  const [events, setEvents] = useState<MapEvent[]>([])
  const [nextOffset, setNextOffset] = useState<number | null>(null)
  const [limitReached, setLimitReached] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")
  const request = useRef<AbortController | null>(null)
  useEffect(() => {
    const controller = new AbortController()
    void client.mapFilters(controller.signal).then(setFilters).catch(() => { if (!controller.signal.aborted) setError("No es poden carregar els filtres.") })
    return () => controller.abort()
  }, [])
  useEffect(() => {
    let disposed = false
    let instance: MapInstance | undefined
    void import("maplibre-gl").then(({ default: lib }) => {
      if (disposed || !container.current) return
      instance = new lib.Map({ container: container.current, style: "https://tiles.openfreemap.org/styles/liberty", center: [1.7, 41.75], zoom: 7, minZoom: 3, renderWorldCopies: false, maxBounds: [[-180, -85], [180, 85]], attributionControl: { compact: true } })
      mapRef.current = instance
      instance.addControl(new lib.NavigationControl(), "top-right")
      const updateBounds = () => {
        if (!instance) return
        const b = instance.getBounds()
        setBounds({ west: Math.max(-180, b.getWest()), east: Math.min(180, b.getEast()), south: Math.max(-90, b.getSouth()), north: Math.min(90, b.getNorth()) })
      }
      instance.on("load", () => {
        if (!instance || disposed) return
        instance.addSource("events", { type: "geojson", data: { type: "FeatureCollection", features: [] }, cluster: true, clusterRadius: 45, clusterMaxZoom: 14 })
        instance.addLayer({ id: "clusters", type: "circle", source: "events", filter: ["has", "point_count"], paint: { "circle-color": "#9f1239", "circle-radius": 20 } })
        instance.addLayer({ id: "counts", type: "symbol", source: "events", filter: ["has", "point_count"], layout: { "text-field": ["get", "point_count_abbreviated"], "text-size": 13 }, paint: { "text-color": "#ffffff" } })
        instance.addLayer({ id: "points", type: "circle", source: "events", filter: ["!", ["has", "point_count"]], paint: { "circle-color": "#9f1239", "circle-radius": 7, "circle-stroke-color": "#ffffff", "circle-stroke-width": 2 } })
        instance.on("click", "clusters", async (event) => {
          const feature = event.features?.[0]
          if (!feature || feature.geometry.type !== "Point" || !instance) return
          const zoom = await (instance.getSource("events") as GeoJSONSource).getClusterExpansionZoom(feature.properties.cluster_id)
          instance.easeTo({ center: feature.geometry.coordinates as [number, number], zoom })
        })
        instance.on("click", "points", (event) => {
          const feature = event.features?.[0]
          if (!feature || feature.geometry.type !== "Point" || !instance) return
          const link = document.createElement("a")
          link.href = `/actes/${encodeURIComponent(String(feature.properties.id))}`
          link.textContent = String(feature.properties.title)
          new lib.Popup().setLngLat(feature.geometry.coordinates as [number, number]).setDOMContent(link).addTo(instance)
        })
        setMap(instance)
        updateBounds()
      })
      instance.on("moveend", updateBounds)
      instance.on("error", () => { if (!disposed) setError("No s’ha pogut carregar una part del mapa.") })
    }).catch(() => { if (!disposed) setError("Mapa no disponible.") })
    return () => { disposed = true; instance?.remove(); mapRef.current = null }
  }, [])
  const load = useCallback(async (offset: number, signal: AbortSignal) => {
    if (!bounds) return
    setPending(true)
    try {
      const page = await client.mapEvents({ bounds, from, day, city, festival, offset }, signal)
      if (signal.aborted) return
      setEvents((previous) => offset ? [...previous, ...page.events.filter((item) => !previous.some((old) => old.id === item.id))] : page.events)
      setNextOffset(page.nextOffset)
      setLimitReached(Boolean(page.limitReached))
      setError("")
    } catch { if (!signal.aborted) setError("No es poden carregar els actes. Torna-ho a provar.") }
    finally { if (!signal.aborted) setPending(false) }
  }, [bounds, from, day, city, festival])
  useEffect(() => {
    request.current?.abort()
    const controller = new AbortController()
    request.current = controller
    const timer = setTimeout(() => { setEvents([]); setNextOffset(null); setLimitReached(false); void load(0, controller.signal) }, 300)
    return () => { clearTimeout(timer); controller.abort(); request.current?.abort() }
  }, [load])
  useEffect(() => {
    if (!map || map !== mapRef.current) return
    const source = map.getSource("events") as GeoJSONSource | undefined
    source?.setData({ type: "FeatureCollection", features: events.map((event) => ({ type: "Feature", properties: { id: event.id, title: eventText(event, locale).title }, geometry: { type: "Point", coordinates: [event.place.longitude, event.place.latitude] } })) })
  }, [map, events, locale])
  return <section aria-label="Mapa dels actes" className="culture-stack">
    <div className="culture-filters">
      <label className="culture-field">Municipi<select value={city} onChange={(e) => { setCity(e.target.value); setFestival("") }}><option value="">Tots els municipis</option>{filters.cities.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label className="culture-field">Festa<select value={festival} onChange={(e) => setFestival(e.target.value)}><option value="">Totes les festes</option>{filters.festivals.filter((item) => !city || item.city_id === city).map((item) => <option key={item.id} value={item.id}>{item.name} · {filters.cities.find((c) => c.id === item.city_id)?.name}</option>)}</select></label>
      <label className="culture-field">Dia<input type="date" value={day} onChange={(e) => setDay(e.target.value)} /></label>
    </div>
    <div ref={container} className="culture-map" role="region" aria-label="Mapa interactiu; la llista accessible és a continuació" />
    <button type="button" className="culture-button culture-quiet" onClick={() => navigator.geolocation?.getCurrentPosition(({ coords }) => mapRef.current?.jumpTo({ center: [coords.longitude, coords.latitude], zoom: 13 }), () => setError("No s’ha pogut obtenir la ubicació."), { timeout: 10000 })}>Centrar a la meva ubicació</button>
    <p className="culture-meta">Actes de l’àrea visible, dels propers 90 dies si no tries una data. La zona visible s’envia al servidor per consultar els actes.</p>
    {error && <p role="status" className="culture-warning">{error} <button type="button" onClick={() => { request.current?.abort(); const controller = new AbortController(); request.current = controller; void load(0, controller.signal) }}>Reintentar</button></p>}
    <p role="status">{pending ? "Carregant actes…" : `${events.length} actes carregats`}</p>
    <ul>{events.map((event) => <li key={event.id}><a href={`/actes/${event.id}`}>{eventText(event, locale).title}</a> · {event.place.name} · {event.city.name}{event.status === "cancelled" ? " · Cancel·lat" : ""}</li>)}</ul>
    {nextOffset !== null && <><p className="culture-meta">Hi ha més actes en aquesta zona que encara no es mostren al mapa.</p><button type="button" className="culture-button" disabled={pending} onClick={() => { request.current?.abort(); const controller = new AbortController(); request.current = controller; void load(nextOffset, controller.signal) }}>Carregar més actes d’aquesta zona</button></>}
    {limitReached && <p className="culture-warning">S’ha arribat al límit de consulta. Acosta el mapa o aplica un filtre per veure més actes.</p>}
  </section>
}
