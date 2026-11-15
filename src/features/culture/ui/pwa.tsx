"use client"

import { useEffect, useState } from "react"

export function PwaRegistration({ from }: { from?: string }) {
  useEffect(() => {
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      let cancelled = false
      navigator.serviceWorker
        .register("/sw.js", { scope: "/", updateViaCache: "none" })
        .then(async () => {
          await navigator.serviceWorker.ready
          if (cancelled) return
          // Prime the first visit too: the new worker may not control this page yet.
          const url = `/api/culture${from ? `?from=${encodeURIComponent(from)}` : ""}`
          const response = await fetch(url, { cache: "no-store" })
          if (response.ok && response.headers.get("X-Culture-Public") === "1") {
            const cache = await caches.open("culture-v1-data")
            await cache.put(url, response)
            const keys = await cache.keys()
            await Promise.all(
              keys
                .slice(0, Math.max(0, keys.length - 12))
                .map((key) => cache.delete(key))
            )
          }
        })
        .catch(() => {})
      return () => {
        cancelled = true
      }
    }
  }, [from])
  return null
}

export function InstallHelp() {
  const [message, setMessage] = useState("")
  return (
    <section className="culture-card">
      <h2>Instal·lar l’agenda</h2>
      <p>
        A l’iPhone: Compartir → Afegir a la pantalla d’inici. A Android: menú
        del navegador → Instal·lar o Afegir a la pantalla d’inici.
      </p>
      <p>
        Els favorits es desen només en aquest dispositiu. L’agenda consultada es
        guarda per llegir-la sense connexió; el mapa i les imatges necessiten
        xarxa.
      </p>
      <button
        className="culture-button"
        type="button"
        onClick={async () => {
          if (!("serviceWorker" in navigator)) {
            setMessage("Aquest navegador no admet el mode sense connexió.")
            return
          }
          try {
            const registration =
              await navigator.serviceWorker.getRegistration("/")
            const response = await fetch("/api/culture", { cache: "no-store" })
            const saved = await caches
              .open("culture-v1-data")
              .then((cache) => cache.match("/api/culture"))
            setMessage(
              response.ok && registration?.active && saved
                ? "Agenda actualitzada. Ja pots consultar-la sense connexió."
                : "El mode sense connexió requereix una versió de producció instal·lada i dades disponibles. Torna-ho a provar després de recarregar."
            )
          } catch {
            setMessage("No s’ha pogut actualitzar. Comprova la connexió.")
          }
        }}
      >
        Actualitzar l’agenda offline
      </button>
      <p role="status">{message}</p>
      <p className="culture-meta">
        Els avisos s’actualitzen amb l’agenda oberta. Aquesta versió encara no
        envia notificacions push.
      </p>
    </section>
  )
}
