"use client"
import Link from "next/link"
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <section>
      <h1>No es pot obrir el panell</h1>
      <p>Comprova la sessió, els permisos i la configuració de Supabase.</p>
      <button className="culture-button" onClick={reset}>
        Reintentar
      </button>{" "}
      <Link href="/admin">Tornar a l’accés</Link>
    </section>
  )
}
