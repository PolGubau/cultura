"use client"

import Link from "next/link"
import { eventText, isLive } from "../domain/catalog"
import { formatDate } from "../domain/time"
import { usePreferences } from "./preferences"
import type { CulturalEvent, CultureCatalog } from "../domain/types"

export function FavoriteButton({ id }: { id: string }) {
  const { preferences, toggleFavorite } = usePreferences()
  const favorite = preferences.favorites.includes(id)
  return (
    <button
      type="button"
      className="culture-button culture-quiet"
      aria-pressed={favorite}
      aria-label={favorite ? "Treure dels favorits" : "Desar als favorits"}
      onClick={() => toggleFavorite(id)}
    >
      <span aria-hidden>{favorite ? "♥" : "♡"}</span>
      <span className="sr-only">Favorit</span>
    </button>
  )
}

export function EventCard({
  event,
  catalog,
  now,
}: {
  event: CulturalEvent
  catalog: CultureCatalog
  now: Date
}) {
  const { preferences } = usePreferences()
  const text = eventText(event, preferences.locale)
  const place = catalog.places.find((item) => item.id === event.place_id)
  const category = catalog.categories.find(
    (item) => item.id === event.category_id && (!item.city_id || item.city_id === event.city_id)
  )
  return (
    <article
      className={`culture-card ${event.status === "cancelled" ? "culture-cancelled" : ""}`}
    >
      <div className="culture-row culture-between">
        <p className="culture-meta">
          {category?.name}
          {isLive(event, now) && <span className="culture-badge">Ara</span>}
          {event.format === "exhibition" && (
            <span className="culture-badge">Exposició</span>
          )}
        </p>
        <FavoriteButton id={event.id} />
      </div>
      <h2>
        <Link href={`/actes/${event.id}`} prefetch={false}>
          {text.title}
        </Link>
      </h2>
      {event.status === "cancelled" && (
        <p role="status" className="culture-warning">
          Cancel·lat · {event.cancellation_reason}
        </p>
      )}
      <p className="culture-meta">
        <time dateTime={event.starts_at}>
          {formatDate(
            event.starts_at,
            catalog.city.timezone,
            preferences.locale
          )}
        </time>
        {event.format === "exhibition" && (
          <>
            {" "}
            —{" "}
            {formatDate(
              event.ends_at,
              catalog.city.timezone,
              preferences.locale
            )}
          </>
        )}
      </p>
      <p>{text.summary}</p>
      <p className="culture-meta">
        {place?.name ?? "Ubicació pendent"}
        {catalog.cities?.find((city) => city.id === event.city_id)?.name ? ` · ${catalog.cities.find((city) => city.id === event.city_id)!.name}` : ""}
        {event.price ? ` · ${event.price}` : ""}
      </p>
    </article>
  )
}
