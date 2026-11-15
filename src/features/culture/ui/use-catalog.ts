"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { CatalogResult } from "../domain/types"

export function useCatalog(initial: CatalogResult) {
  const [result, setResult] = useState(initial)
  const [offline, setOffline] = useState(false)
  const [pending, setPending] = useState(false)
  const currentFrom = useRef(initial.data?.from)
  const latestRequest = useRef(0)
  const refresh = useCallback(async (from?: string, signal?: AbortSignal) => {
    if (from) currentFrom.current = from
    const requestId = ++latestRequest.current
    setPending(true)
    try {
      const period = currentFrom.current
      const response = await fetch(
        `/api/culture${period ? `?from=${encodeURIComponent(period)}` : ""}`,
        { cache: "no-store", signal }
      )
      const next: CatalogResult = await response.json()
      if (!response.ok || !next.data)
        throw new Error(next.error || "No es pot actualitzar.")
      if (signal?.aborted || requestId !== latestRequest.current) return
      setResult(next)
      setOffline(response.headers.get("X-Culture-Offline") === "1")
    } catch (error) {
      if (signal?.aborted || requestId !== latestRequest.current) return
      setResult((previous) => ({
        ...previous,
        error:
          error instanceof Error ? error.message : "No es pot actualitzar.",
      }))
      setOffline(!navigator.onLine)
    } finally {
      if (!signal?.aborted && requestId === latestRequest.current)
        setPending(false)
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    let active = false
    const update = async () => {
      if (document.visibilityState !== "visible" || active) return
      active = true
      await refresh(undefined, controller.signal)
      active = false
    }
    const onOffline = () => setOffline(true)
    const interval = window.setInterval(update, 60_000)
    void update()
    window.addEventListener("online", update)
    window.addEventListener("offline", onOffline)
    document.addEventListener("visibilitychange", update)
    return () => {
      controller.abort()
      clearInterval(interval)
      window.removeEventListener("online", update)
      window.removeEventListener("offline", onOffline)
      document.removeEventListener("visibilitychange", update)
    }
  }, [refresh])
  return { ...result, offline, pending, refresh }
}
