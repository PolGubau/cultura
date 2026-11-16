"use client"

import Link from "next/link"
import { useEffect, useRef, useState, useSyncExternalStore } from "react"
import { createInstallController } from "./install-controller"
import { registerCultureServiceWorker } from "./service-worker"

function subscribeToDisplayMode(onChange: () => void) {
  const media = window.matchMedia("(display-mode: standalone)")
  media.addEventListener("change", onChange)
  return () => media.removeEventListener("change", onChange)
}

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches ||
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
}

export function InstallButton() {
  const controller = useRef<ReturnType<typeof createInstallController> | null>(null)
  const installedRef = useRef(false)
  const [help, setHelp] = useState(false)
  const [installed, setInstalled] = useState(false)
  const [message, setMessage] = useState("")
  const standalone = useSyncExternalStore(subscribeToDisplayMode, isStandalone, () => false)

  useEffect(() => {
    let active = true
    controller.current = createInstallController(window, () => {
      if (active) {
        installedRef.current = true
        setInstalled(true)
        setHelp(false)
        setMessage("L’agenda s’ha instal·lat al dispositiu.")
      }
    })
    registerCultureServiceWorker()
    return () => {
      active = false
      controller.current?.dispose()
      controller.current = null
    }
  }, [])

  async function install() {
    const current = controller.current
    const result = await current?.install() ?? "unavailable"
    if (controller.current !== current || installedRef.current) return
    if (result === "accepted") {
      setMessage("Has acceptat la instal·lació. Segueix les indicacions del navegador.")
      setHelp(false)
    } else {
      setMessage(result === "dismissed" ? "Instal·lació cancel·lada." : "")
      setHelp(true)
    }
  }

  return (
    <div className="space-y-3">
      {installed || standalone ? (
        <Link href="/" className="inline-flex items-center justify-center gap-3 rounded-xl bg-foreground px-6 py-3 text-background">
          Obrir l’agenda
        </Link>
      ) : (
        <button type="button" onClick={() => void install()} aria-expanded={help} aria-controls="install-help"
          className="inline-flex items-center justify-center gap-3 rounded-xl bg-foreground px-6 py-3 text-left text-background hover:opacity-90">
          <svg aria-hidden="true" focusable="false" className="size-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3v12m-4-4 4 4 4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
          </svg>
          <span><span className="block text-xs opacity-75">Per a mòbil i ordinador</span><span className="block font-semibold">Instal·la l’agenda web</span></span>
        </button>
      )}
      <p role="status" className="text-sm text-muted-foreground">{message}</p>
      <div id="install-help" hidden={!help} className="rounded-xl border border-border bg-card p-4 text-sm text-left space-y-2">
        <p>Per instal·lar l’agenda web, primer <Link href="/" className="font-semibold underline">obre l’agenda</Link> al navegador.</p>
        <p><strong>iPhone o iPad:</strong> toca Compartir i després «Afegir a la pantalla d’inici».</p>
        <p><strong>Android:</strong> obre el menú del navegador i tria «Instal·lar aplicació» o «Afegir a la pantalla d’inici».</p>
        <p><strong>Ordinador:</strong> busca l’opció d’instal·lar al menú o a la barra d’adreces. La disponibilitat depèn del navegador.</p>
      </div>
    </div>
  )
}
