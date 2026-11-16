"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { CatalogResult } from "../domain/types"
import { nextRefreshDelay, REFRESH_INTERVAL_MS } from "../domain/refresh"
import { createCultureClient } from "../../../../../shared/culture/client"
import { mergeCatalogPages } from "../../../../../shared/culture/public-catalog"

const client = createCultureClient("")

export function useCatalog(initial: CatalogResult) {
  const [result, setResult] = useState(initial)
  const [offline, setOffline] = useState(false)
  const [pending, setPending] = useState(false)
  const currentFrom = useRef(initial.data?.from)
  const currentCity = useRef(initial.data?.selectedCity ?? "")
  const resultCity = useRef(initial.data?.selectedCity ?? "")
  const loadedExtraPages = useRef(false)
  const latestRequest = useRef(0)
  const activeRequest = useRef<AbortController | null>(null)
  const lastAttempt = useRef(
    initial.data ? Date.parse(initial.data.fetchedAt) : 0
  )
  const refresh = useCallback(async (from?: string, signal?: AbortSignal, city?: string) => {
    if (from) currentFrom.current = from
    if (city !== undefined) currentCity.current = city
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
      const snapshot = await client.catalog(period, requestSignal, currentCity.current)
      const next: CatalogResult = { data: snapshot.data, error: null }
      if (requestSignal.aborted || requestId !== latestRequest.current) return
      loadedExtraPages.current = false
      resultCity.current = snapshot.data.selectedCity ?? ""
      setResult(next)
      setOffline(snapshot.offline)
    } catch (error) {
      if (requestSignal.aborted || requestId !== latestRequest.current) return
      currentCity.current = resultCity.current
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

  const loadMore = useCallback(async () => {
    const current = result.data
    if (!current || current.nextOffset == null || pending) return
    const requestId = ++latestRequest.current
    activeRequest.current?.abort()
    const controller = new AbortController()
    activeRequest.current = controller
    setPending(true)
    try {
      const page = await client.catalog(current.from, controller.signal, current.selectedCity, current.nextOffset)
      if (controller.signal.aborted || requestId !== latestRequest.current) return
      loadedExtraPages.current = true
      setResult((previous) => previous.data ? { data: mergeCatalogPages(previous.data, page.data), error: null } : previous)
      setOffline(page.offline)
    } catch (error) {
      if (!controller.signal.aborted && requestId === latestRequest.current)
        setResult((previous) => ({ ...previous, error: error instanceof Error ? error.message : "No es poden carregar més actes." }))
    } finally {
      if (!controller.signal.aborted && requestId === latestRequest.current) setPending(false)
    }
  }, [pending, result.data])

  useEffect(() => {
    const controller = new AbortController()
    let active = false
    const update = async () => {
      if (document.visibilityState !== "visible" || !navigator.onLine || active || loadedExtraPages.current)
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
  return { ...result, offline, pending, refresh, loadMore }
}
