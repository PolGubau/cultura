"use client"

import Link from "next/link"
import { useState } from "react"
import type { CulturalEvent, CultureCatalog } from "../domain/types"
import { eventText, readableForeground } from "../domain/catalog"
import { formatDate } from "../domain/time"
import { FavoriteButton } from "./event-card"
import { PreferencesProvider, usePreferences } from "./preferences"
import { PwaRegistration } from "./pwa"

export function EventDetail(props: {
  event: CulturalEvent
  catalog: CultureCatalog
}) {
  return (
    <PreferencesProvider>
      <PwaRegistration catalog={null} />
      <Content {...props} />
    </PreferencesProvider>
  )
}

function Content({
  event,
  catalog,
}: {
  event: CulturalEvent
  catalog: CultureCatalog
}) {
  const { preferences, storageError } = usePreferences()
  const [message, setMessage] = useState("")
  const text = eventText(event, preferences.locale)
  const place = catalog.places.find((item) => item.id === event.place_id)
  const festival = catalog.festivals.find(
    (item) => item.id === event.festival_id
  )
  return (
    <main
      id="main-content"
      className="culture-app culture-container culture-main"
      style={
        festival
          ? ({
              "--primary": festival.primary_color,
              "--primary-foreground": readableForeground(
                festival.primary_color
              ),
            } as React.CSSProperties)
          : undefined
      }
    >
      <Link href="/" className="culture-button culture-quiet">
        ← Tornar a l’agenda
      </Link>
      <article className="culture-detail culture-stack">
        <div className="culture-row culture-between">
          <p>{festival?.name ?? catalog.city.name}</p>
          <FavoriteButton id={event.id} />
        </div>
        <h1>{text.title}</h1>
        {storageError && (
          <p className="culture-notice">
            El favorit només es pot conservar en aquesta sessió.
          </p>
        )}
        {event.status === "cancelled" && (
          <p role="status" className="culture-notice">
            <strong>Acte cancel·lat</strong> · {event.cancellation_reason}
          </p>
        )}
        {event.image_url /* eslint-disable-next-line @next/next/no-img-element */ && (
          <img
            src={event.image_url}
            alt=""
            className="culture-event-image"
            width={1000}
            height={560}
          />
        )}
        <p className="culture-lead">{text.summary}</p>
        <dl className="culture-card culture-stack">
          <div>
            <dt>Quan</dt>
            <dd>
              <time dateTime={event.starts_at}>
                {formatDate(
                  event.starts_at,
                  catalog.city.timezone,
                  preferences.locale
                )}
              </time>{" "}
              —{" "}
              <time dateTime={event.ends_at}>
                {formatDate(
                  event.ends_at,
                  catalog.city.timezone,
                  preferences.locale
                )}
              </time>
            </dd>
          </div>
          {place && (
            <div>
              <dt>On</dt>
              <dd>
                {place.name} · {place.address}
              </dd>
            </div>
          )}
          <div>
            <dt>Preu</dt>
            <dd>{event.price || "No informat. Consulta l’organització."}</dd>
          </div>
          {event.organizer && (
            <div>
              <dt>Organitza</dt>
              <dd>{event.organizer}</dd>
            </div>
          )}
          {event.schedule_notes && (
            <div>
              <dt>Horaris i accés</dt>
              <dd className="culture-prewrap">{event.schedule_notes}</dd>
            </div>
          )}
          {event.accessibility && (
            <div>
              <dt>Accessibilitat</dt>
              <dd className="culture-prewrap">{event.accessibility}</dd>
            </div>
          )}
        </dl>
        {text.description && (
          <p className="culture-prewrap">{text.description}</p>
        )}
        {event.route && (
          <p>
            Acte itinerant. El punt indicat és el lloc de trobada; consulta el
            recorregut al mapa de l’agenda.
          </p>
        )}
        <div className="culture-row">
          {place && (
            <a
              className="culture-button"
              href={`https://www.google.com/maps/dir/?api=1&destination=${place.latitude},${place.longitude}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Com arribar-hi
            </a>
          )}
          {event.booking_url && (
            <a
              className="culture-button"
              href={event.booking_url}
              target="_blank"
              rel="noopener noreferrer"
            >
              Entrades / més informació
            </a>
          )}
          <a
            className="culture-button culture-quiet"
            href={`/api/culture/events/${event.id}/calendar`}
          >
            Afegir al calendari
          </a>
          <button
            className="culture-button culture-quiet"
            type="button"
            onClick={async () => {
              try {
                if (navigator.share)
                  await navigator.share({
                    title: text.title,
                    url: window.location.href,
                  })
                else {
                  await navigator.clipboard.writeText(window.location.href)
                  setMessage("Enllaç copiat.")
                }
              } catch (error) {
                if (
                  !(
                    error instanceof DOMException && error.name === "AbortError"
                  )
                )
                  setMessage(
                    "No es pot compartir automàticament. Copia l’adreça del navegador."
                  )
              }
            }}
          >
            Compartir
          </button>
        </div>
        <p role="status">{message}</p>
        <p className="culture-meta">
          Horaris en zona {catalog.city.timezone}. Confirma els canvis amb
          l’organització.
        </p>
      </article>
    </main>
  )
}
