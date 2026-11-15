"use client"

import { createContext, useContext, useSyncExternalStore } from "react"
import type { Locale } from "../domain/types"

interface Preferences {
  mode: string
  locale: Locale
  favorites: string[]
}
const defaults: Preferences = { mode: "auto", locale: "ca", favorites: [] }
const key = "mataro-culture:preferences:v1"
const listeners = new Set<() => void>()
let snapshot = defaults
let initialized = false
let storageError = false

function read() {
  if (initialized) return snapshot
  initialized = true
  snapshot = defaults
  try {
    const stored = JSON.parse(localStorage.getItem(key) || "null")
    if (stored && typeof stored === "object")
      snapshot = {
        mode: typeof stored.mode === "string" ? stored.mode : "auto",
        locale: ["ca", "es", "en"].includes(stored.locale)
          ? stored.locale
          : "ca",
        favorites: Array.isArray(stored.favorites)
          ? stored.favorites
              .filter((id: unknown) => typeof id === "string")
              .slice(0, 5000)
          : [],
      }
  } catch {
    storageError = true
  }
  return snapshot
}
function subscribe(listener: () => void) {
  listeners.add(listener)
  const sync = (event: StorageEvent) => {
    if (event.key === key || event.key === null) {
      initialized = false
      read()
      listeners.forEach((notify) => notify())
    }
  }
  window.addEventListener("storage", sync)
  return () => {
    listeners.delete(listener)
    window.removeEventListener("storage", sync)
  }
}
function update(patch: Partial<Preferences>) {
  snapshot = { ...read(), ...patch }
  try {
    localStorage.setItem(key, JSON.stringify(snapshot))
    storageError = false
  } catch {
    storageError = true
  }
  listeners.forEach((notify) => notify())
}
const Context = createContext<{
  preferences: Preferences
  storageError: boolean
  setMode: (mode: string) => void
  setLocale: (locale: Locale) => void
  toggleFavorite: (id: string) => void
} | null>(null)

export function PreferencesProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const preferences = useSyncExternalStore(subscribe, read, () => defaults)
  return (
    <Context.Provider
      value={{
        preferences,
        storageError,
        setMode: (mode) => update({ mode }),
        setLocale: (locale) => update({ locale }),
        toggleFavorite: (id) =>
          update({
            favorites: read().favorites.includes(id)
              ? read().favorites.filter((item) => item !== id)
              : [...read().favorites, id],
          }),
      }}
    >
      {children}
    </Context.Provider>
  )
}
export function usePreferences() {
  const context = useContext(Context)
  if (!context) throw new Error("PreferencesProvider is required.")
  return context
}
