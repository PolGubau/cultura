"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import dynamic from "next/dynamic"
import { dayKey, addDays } from "../domain/time"
import {
  filterEvents,
  isLive,
  readableForeground,
  resolveFestival,
} from "../domain/catalog"
import type { CatalogResult, Locale } from "../domain/types"
import { EventCard } from "./event-card"
import { PreferencesProvider, usePreferences } from "./preferences"
import { InstallHelp, PwaRegistration } from "./pwa"
import { useCatalog } from "./use-catalog"
import { CalendarDotsIcon, LightningIcon, MapTrifoldIcon, HeartIcon, GearSixIcon } from "@phosphor-icons/react"
import { cultureNavigation } from "../../../../../shared/culture/presentation"

const EventMap = dynamic(() => import("./event-map"), {
  ssr: false,
  loading: () => <p>Carregant el mapa…</p>,
})
export type CultureView = "agenda" | "now" | "map" | "favorites" | "settings"
const navViews = ["agenda", "now", "map", "favorites", "settings"] as const
const navIcons = [CalendarDotsIcon, LightningIcon, MapTrifoldIcon, HeartIcon, GearSixIcon]

export function CultureApp({
  initial,
  view,
  initialNow,
}: {
  initial: CatalogResult
  view: CultureView
  initialNow: string
}) {
  return (
    <PreferencesProvider>
      <CultureContent initial={initial} view={view} initialNow={initialNow} />
    </PreferencesProvider>
  )
}

function CultureContent({
  initial,
  view,
  initialNow,
}: {
  initial: CatalogResult
  view: CultureView
  initialNow: string
}) {
  const { data, error, offline, pending, refresh } = useCatalog(initial)
  const { preferences, setMode, setLocale, storageError } = usePreferences()
  const [now, setNow] = useState(() => new Date(initialNow))
  const [query, setQuery] = useState("")
  const [category, setCategory] = useState("")
  const [selectedDay, setSelectedDay] = useState("")
  const [visibleCount, setVisibleCount] = useState(60)
  useEffect(() => {
    // ISR HTML may have been generated earlier; correct its clock after hydration.
    const initialTick = setTimeout(() => setNow(new Date()), 0)
    const timer = setInterval(() => setNow(new Date()), 30_000)
    return () => { clearTimeout(initialTick); clearInterval(timer) }
  }, [])
  const today = dayKey(now, data?.city.timezone)
  const festival = resolveFestival(
    data?.festivals ?? [],
    preferences.mode,
    today
  )
  const filtered = useMemo(
    () =>
      filterEvents(data?.events ?? [], {
        festivalId: festival?.id,
        query,
        category,
        locale: preferences.locale,
        favorites: view === "favorites" ? preferences.favorites : undefined,
      }),
    [
      data?.events,
      festival?.id,
      query,
      category,
      preferences.locale,
      preferences.favorites,
      view,
    ]
  )
  const liveNow = view === "now" ? now : null
  const events = useMemo(
    () =>
      filtered.filter((event) => {
        if (liveNow) return isLive(event, liveNow)
        if (!selectedDay) return true
        return (
          dayKey(event.starts_at, data?.city.timezone) <= selectedDay &&
          dayKey(
            new Date(new Date(event.ends_at).getTime() - 1),
            data?.city.timezone
          ) >= selectedDay
        )
      }),
    [filtered, liveNow, selectedDay, data?.city.timezone]
  )
  const mapEvents = useMemo(() => events.slice(0, 200), [events])
  const titles = {
    agenda: "Què fem a Mataró?",
    now: "Està passant ara",
    map: "La cultura, al mapa",
    favorites: "La teva agenda",
    settings: "Al teu gust",
  }

  return (
    <div
      className="culture-app"
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
      <PwaRegistration catalog={data} />
      <header className="culture-header">
        <div className="culture-container culture-row culture-between">
          <Link href="/" className="culture-brand">
            {festival?.name ?? "Mataró · Cultura"}
          </Link>
          <Link href="/admin" className="culture-meta">
            Administració
          </Link>
        </div>
      </header>
      <nav className="culture-nav" aria-label="Navegació principal">
        <div className="culture-container culture-row">
          {cultureNavigation.map(({ path: href, title }, index) => {
            const key = navViews[index]
            const Icon = navIcons[index]
            return (
            <Link
              key={key}
              href={href}
              prefetch={false}
              aria-current={view === key ? "page" : undefined}
            >
              <Icon size={22} weight={view === key ? "fill" : "regular"} aria-hidden />
              <span>{title}</span>
            </Link>
          )})}
        </div>
      </nav>
      <main id="main-content" className="culture-container culture-main">
        <section className="culture-intro">
          <p className="culture-meta">
            Tot l’any, a prop teu · {data?.city.name ?? "Mataró"}
          </p>
          <h1>{titles[view]}</h1>
          <p>
            {festival
              ? festival.description ||
                `Descobreix el programa de ${festival.name}.`
              : "Música, cultura popular, exposicions i plans per compartir."}
          </p>
          {festival && (
            <div className="culture-row">
              {festival.logo_url && (
                // Admin-provided HTTPS URLs are not limited to the legacy image hosts.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={festival.logo_url}
                  alt={`Logo de ${festival.name}`}
                  width={64}
                  height={64}
                  className="culture-logo"
                />
              )}
              <p className="culture-meta">
                Mode {festival.name} · {festival.starts_on} — {festival.ends_on}
              </p>
              <button
                className="culture-button culture-quiet"
                type="button"
                onClick={() => setMode("city")}
              >
                Veure tota la ciutat
              </button>
            </div>
          )}
        </section>
        {(offline || error) && (
          <aside className="culture-notice" role="status">
            <p>
              {offline
                ? "Sense connexió: dades guardades. Els horaris i les cancel·lacions poden haver canviat."
                : error}
            </p>
            <button
              className="culture-button culture-quiet"
              disabled={pending}
              onClick={() => refresh(data?.from)}
            >
              Reintentar
            </button>
          </aside>
        )}
        {storageError && (
          <p className="culture-notice" role="status">
            No es poden desar les preferències. Els canvis només duraran aquesta
            sessió.
          </p>
        )}
        {data?.announcements
          .filter(
            (item) =>
              (!item.festival_id || item.festival_id === festival?.id) &&
              new Date(item.starts_at) <= now &&
              new Date(item.ends_at) > now
          )
          .map((item) => (
            <aside key={item.id} className="culture-notice" role="status">
              <strong>
                {item.severity === "critical" ? "Important · " : ""}
                {item.title}
              </strong>
              <p>{item.message}</p>
            </aside>
          ))}
        {view === "settings" ? (
          <div className="culture-stack">
            <section className="culture-card">
              <h2>Ciutat o festa</h2>
              <label className="culture-field">
                Què vols veure?
                <select
                  value={preferences.mode}
                  onChange={(event) => setMode(event.target.value)}
                >
                  <option value="auto">Automàtic segons les dates</option>
                  <option value="city">Tota l’agenda de Mataró</option>
                  {data?.festivals.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
              <p className="culture-meta">
                El mode automàtic destaca una festa durant les seves dates. Pots
                canviar-ho en qualsevol moment.
              </p>
              <label className="culture-field">
                Idioma dels actes
                <select
                  value={preferences.locale}
                  onChange={(event) => setLocale(event.target.value as Locale)}
                >
                  <option value="ca">Català</option>
                  <option value="es">Castellano</option>
                  <option value="en">English</option>
                </select>
              </label>
              <p className="culture-meta">
                Si un acte no té traducció, es mostra en català. La interfície
                és en català.
              </p>
            </section>
            <InstallHelp />
            <section className="culture-card">
              <h2>Una iniciativa independent</h2>
              <p>
                Aquesta agenda encara no és un servei oficial de l’Ajuntament.
                Consulta sempre les indicacions de l’organització.
              </p>
              <Link href="/legal/privacitat">Privacitat</Link>
            </section>
          </div>
        ) : (
          <>
            <form
              className="culture-filters"
              onSubmit={(event) => event.preventDefault()}
            >
              <label className="culture-field">
                Cerca
                <input
                  type="search"
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value)
                    setVisibleCount(60)
                  }}
                  placeholder="Acte, artista o organització"
                />
              </label>
              <label className="culture-field">
                Categoria
                <select
                  value={category}
                  onChange={(event) => {
                    setCategory(event.target.value)
                    setVisibleCount(60)
                  }}
                >
                  <option value="">Totes</option>
                  {data?.categories.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
              {view !== "now" && (
                <label className="culture-field">
                  Dia
                  <input
                    type="date"
                    value={selectedDay}
                    onChange={(event) => {
                      const value = event.target.value
                      setSelectedDay(value)
                      setVisibleCount(60)
                      if (
                        value &&
                        (!data || value < data.from || value >= data.to)
                      )
                        void refresh(value)
                    }}
                  />
                </label>
              )}
              {selectedDay && (
                <button
                  type="button"
                  className="culture-button culture-quiet"
                  onClick={() => setSelectedDay("")}
                >
                  Tots els dies
                </button>
              )}
            </form>
            {view === "now" && (
              <p className="culture-meta">
                Les exposicions i activitats de llarga durada es mostren a
                l’agenda, no com a actes en directe.
              </p>
            )}
            {view === "map" && data && (
              <EventMap
                catalog={data}
                events={mapEvents}
                locale={preferences.locale}
              />
            )}
            {view === "map" && events.length > 200 && (
              <p>
                El mapa mostra els primers 200 actes. Filtra per dia per veure’n
                més.
              </p>
            )}
            <div aria-busy={pending} className="culture-grid">
              {data &&
                events
                  .slice(0, visibleCount)
                  .map((event) => (
                    <EventCard
                      key={event.id}
                      event={event}
                      catalog={data}
                      now={now}
                    />
                  ))}
            </div>
            {events.length > visibleCount && (
              <button
                type="button"
                className="culture-button"
                onClick={() => setVisibleCount((count) => count + 60)}
              >
                Mostrar més actes ({visibleCount} de {events.length})
              </button>
            )}
            {events.length === 0 && (
              <section className="culture-empty">
                <h2>
                  {view === "favorites"
                    ? "Encara no tens actes desats aquí"
                    : "No hi ha actes per mostrar"}
                </h2>
                <p>
                  {view === "favorites"
                    ? "Desa els teus plans amb el cor. Els favorits es mostren dins del període i la festa seleccionats."
                    : "Canvia els filtres o consulta un altre període. No mostrem programació de prova."}
                </p>
                {festival && (
                  <button
                    type="button"
                    className="culture-button"
                    onClick={() => setMode("city")}
                  >
                    Consultar tota l’agenda
                  </button>
                )}
              </section>
            )}
            {data && view !== "now" && (
              <div className="culture-row culture-between culture-pagination">
                <button
                  className="culture-button culture-quiet"
                  disabled={pending}
                  onClick={() => {
                    setSelectedDay("")
                    void refresh(addDays(data.from, -90))
                  }}
                >
                  ← Període anterior
                </button>
                <span className="culture-meta">
                  {data.from} — {addDays(data.to, -1)}
                </span>
                <button
                  className="culture-button culture-quiet"
                  disabled={pending}
                  onClick={() => {
                    setSelectedDay("")
                    void refresh(data.to)
                  }}
                >
                  Període següent →
                </button>
              </div>
            )}
            {data?.hasMore && (
              <p className="culture-notice">
                S’ha arribat al límit de 1.000 actes en aquest període. Tria una
                data posterior per carregar els següents.
              </p>
            )}
          </>
        )}
        <footer className="culture-footer">
          <p>Mataró · Cultura · Iniciativa independent</p>
          <div className="culture-row">
            <Link href="/proposa">Proposa un acte</Link>
            <Link href="/legal/privacitat">Privacitat</Link>
            <Link href="/contacte">Contacte</Link>
            <Link href="/santes-2026">App de 2026</Link>
          </div>
          {data && (
            <p className="culture-meta">
              Dades actualitzades:{" "}
              {new Date(data.fetchedAt).toLocaleString("ca", {
                timeZone: data.city.timezone,
              })}
            </p>
          )}
        </footer>
      </main>
    </div>
  )
}
