"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { CatalogResult } from "../domain/types"
import { nextRefreshDelay, REFRESH_INTERVAL_MS } from "../domain/refresh"

export function useCatalog(initial: CatalogResult) {
  const [result, setResult] = useState(initial)
  const [offline, setOffline] = useState(false)
  const [pending, setPending] = useState(false)
  const currentFrom = useRef(initial.data?.from)
  const latestRequest = useRef(0)
  const activeRequest = useRef<AbortController | null>(null)
  const lastAttempt = useRef(
    initial.data ? Date.parse(initial.data.fetchedAt) : 0
  )
  const refresh = useCallback(async (from?: string, signal?: AbortSignal) => {
    if (from) currentFrom.current = from
    const requestId = ++latestRequest.current
    activeRequest.current?.abort()
    const controller = new AbortController()
    activeRequest.current = controller
    const requestSignal = signal
      ? AbortSignal.any([signal, controller.signal])
      : controller.signal
    lastAttempt.current = Date.now()
    setPending(true)
    try {
      const period = currentFrom.current
      const response = await fetch(
        `/api/culture${period ? `?from=${encodeURIComponent(period)}` : ""}`,
        { signal: requestSignal }
      )
      const next: CatalogResult = await response.json()
      if (!response.ok || !next.data)
        throw new Error(next.error || "No es pot actualitzar.")
      if (requestSignal.aborted || requestId !== latestRequest.current) return
      setResult((previous) =>
        previous.data?.fetchedAt === next.data?.fetchedAt && !previous.error
          ? previous
          : next
      )
      setOffline(response.headers.get("X-Culture-Offline") === "1")
    } catch (error) {
      if (requestSignal.aborted || requestId !== latestRequest.current) return
      setResult((previous) => ({
        ...previous,
        error:
          error instanceof Error ? error.message : "No es pot actualitzar.",
      }))
      setOffline(!navigator.onLine)
    } finally {
      if (!requestSignal.aborted && requestId === latestRequest.current)
        setPending(false)
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    let active = false
    const update = async () => {
      if (document.visibilityState !== "visible" || !navigator.onLine || active)
        return
      if (Date.now() - lastAttempt.current < REFRESH_INTERVAL_MS) return
      active = true
      await refresh(undefined, controller.signal)
      active = false
    }
    let timer: number
    const schedule = () => {
      timer = window.setTimeout(
        async () => {
          await update()
          if (!controller.signal.aborted) schedule()
        },
        document.visibilityState === "visible" && navigator.onLine
          ? nextRefreshDelay(lastAttempt.current, Date.now())
          : REFRESH_INTERVAL_MS
      )
    }
    // Returning to the tab also waits a random interval, rather than making
    // everyone hit the server together when a concert ends or connectivity returns.
    const onVisible = () => {
      clearTimeout(timer)
      schedule()
    }
    const onOnline = () => {
      lastAttempt.current = 0
      onVisible()
    }
    const onOffline = () => setOffline(true)
    setOffline(!navigator.onLine)
    schedule()
    window.addEventListener("online", onOnline)
    window.addEventListener("offline", onOffline)
    document.addEventListener("visibilitychange", onVisible)
    return () => {
      controller.abort()
      activeRequest.current?.abort()
      clearTimeout(timer)
      window.removeEventListener("online", onOnline)
      window.removeEventListener("offline", onOffline)
      document.removeEventListener("visibilitychange", onVisible)
    }
  }, [refresh])
  return { ...result, offline, pending, refresh }
}
