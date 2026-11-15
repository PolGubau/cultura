"use client"

import { useEffect, useRef, useState } from "react"
import "maplibre-gl/dist/maplibre-gl.css"
import type { Map as MapInstance } from "maplibre-gl"
import type { CulturalEvent, CultureCatalog, Locale } from "../domain/types"
import { eventText } from "../domain/catalog"

export default function EventMap({
  catalog,
  events,
  locale,
}: {
  catalog: CultureCatalog
  events: CulturalEvent[]
  locale: Locale
}) {
  const container = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapInstance | null>(null)
  const libraryRef = useRef<typeof import("maplibre-gl").default | null>(null)
  const [loadedMap, setLoadedMap] = useState<MapInstance | null>(null)
  const fitted = useRef(false)
  const [error, setError] = useState("")
  const [location, setLocation] = useState("")
  useEffect(() => {
    let cancelled = false
    let map: MapInstance | undefined
    import("maplibre-gl")
      .then(({ default: maplibre }) => {
        if (cancelled || !container.current) return
        libraryRef.current = maplibre
        map = new maplibre.Map({
          container: container.current,
          style: "https://tiles.openfreemap.org/styles/liberty",
          center: [catalog.city.longitude, catalog.city.latitude],
          zoom: 13,
          attributionControl: { compact: true },
        })
        mapRef.current = map
        map.addControl(new maplibre.NavigationControl(), "top-right")
        map.on("error", () => {
          if (!cancelled)
            setError(
              "No es pot carregar alguna part del mapa. Consulta la llista d’actes."
            )
        })
        map.on("load", () => {
          if (!map || cancelled) return
          map.addSource("routes", {
            type: "geojson",
            data: { type: "FeatureCollection", features: [] },
          })
          map.addLayer({
            id: "routes",
            source: "routes",
            type: "line",
            paint: { "line-color": "#9f1239", "line-width": 4 },
          })
          fitted.current = false
          setLoadedMap(map)
        })
      })
      .catch(() => {
        if (!cancelled)
          setError(
            "Mapa no disponible. Els actes continuen disponibles a la llista."
          )
      })
    return () => {
      cancelled = true
      map?.remove()
      mapRef.current = null
    }
  }, [catalog.city.latitude, catalog.city.longitude])

  useEffect(() => {
    const map = loadedMap
    const maplibre = libraryRef.current
    if (!map || map !== mapRef.current || !maplibre) return
    const markers: { remove: () => void }[] = []
    const bounds = new maplibre.LngLatBounds()
    const routes: GeoJSON.Feature<GeoJSON.LineString>[] = []
    const places = new Map(catalog.places.map((place) => [place.id, place]))
    for (const event of events) {
      const place = places.get(event.place_id)
      if (!place) continue
      const point: [number, number] = [place.longitude, place.latitude]
      bounds.extend(point)
      const link = document.createElement("a")
      link.href = `/actes/${event.id}`
      link.textContent = eventText(event, locale).title
      link.style.cssText = "color:#111;text-decoration:underline;font-size:16px"
      markers.push(
        new maplibre.Marker({
          color: event.status === "cancelled" ? "#64748b" : "#9f1239",
        })
          .setLngLat(point)
          .setPopup(new maplibre.Popup().setDOMContent(link))
          .addTo(map)
      )
      if (event.route)
        routes.push({
          type: "Feature",
          properties: {},
          geometry: {
            type: "LineString",
            coordinates: event.route.map((item) => [item.lng, item.lat]),
          },
        })
    }
    const source = map.getSource(
      "routes"
    ) as import("maplibre-gl").GeoJSONSource
    source.setData({ type: "FeatureCollection", features: routes })
    if (!fitted.current && !bounds.isEmpty()) {
      map.fitBounds(bounds, { padding: 60, maxZoom: 15, animate: false })
      fitted.current = true
    }
    return () => {
      markers.forEach((marker) => marker.remove())
    }
  }, [loadedMap, catalog.places, events, locale])

  return (
    <section aria-label="Mapa dels actes">
      <div
        ref={container}
        className="culture-map"
        role="region"
        aria-label="Mapa interactiu. Alternativa accessible: llista d’actes a continuació."
      />
      <button
        type="button"
        className="culture-button culture-quiet"
        onClick={() => {
          if (!navigator.geolocation) {
            setLocation("Ubicació no disponible en aquest navegador.")
            return
          }
          setLocation("Obtenint ubicació…")
          navigator.geolocation.getCurrentPosition(
            ({ coords }) => {
              mapRef.current?.jumpTo({
                center: [coords.longitude, coords.latitude],
                zoom: 15,
              })
              setLocation(
                "Mapa centrat a la teva ubicació. No es desa ni s’envia al servidor."
              )
            },
            () =>
              setLocation(
                "No s’ha pogut obtenir la ubicació. Pots continuar sense donar permisos."
              ),
            { timeout: 10000 }
          )
        }}
      >
        Centrar a la meva ubicació
      </button>
      <p role="status">{location}</p>
      {error && (
        <p className="culture-warning" role="status">
          {error}
        </p>
      )}
    </section>
  )
}
