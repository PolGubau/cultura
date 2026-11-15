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
  const [error, setError] = useState("")
  const [location, setLocation] = useState("")
  useEffect(() => {
    let cancelled = false
    let map: MapInstance | undefined
    const markers: { remove: () => void }[] = []
    import("maplibre-gl")
      .then(({ default: maplibre }) => {
        if (cancelled || !container.current) return
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
          const bounds = new maplibre.LngLatBounds()
          const routes: GeoJSON.Feature<GeoJSON.LineString>[] = []
          for (const event of events) {
            const place = catalog.places.find(
              (item) => item.id === event.place_id
            )
            if (!place) continue
            const point: [number, number] = [place.longitude, place.latitude]
            bounds.extend(point)
            const popup = document.createElement("div")
            const link = document.createElement("a")
            link.href = `/actes/${event.id}`
            link.textContent = eventText(event, locale).title
            link.style.cssText =
              "color:#111;text-decoration:underline;font-size:16px"
            popup.append(link)
            markers.push(
              new maplibre.Marker({
                color: event.status === "cancelled" ? "#64748b" : "#9f1239",
              })
                .setLngLat(point)
                .setPopup(new maplibre.Popup().setDOMContent(popup))
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
          if (!bounds.isEmpty())
            map.fitBounds(bounds, { padding: 60, maxZoom: 15, animate: false })
          map.addSource("routes", {
            type: "geojson",
            data: { type: "FeatureCollection", features: routes },
          })
          map.addLayer({
            id: "routes",
            source: "routes",
            type: "line",
            paint: { "line-color": "#9f1239", "line-width": 4 },
          })
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
      markers.forEach((marker) => marker.remove())
      map?.remove()
      mapRef.current = null
    }
  }, [catalog.city, catalog.places, events, locale])

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
