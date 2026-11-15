import Link from "next/link"
import { requireEditor } from "@/src/features/culture/server/auth"

export default async function AnalyticsPage() {
  await requireEditor()
  return (
    <section className="culture-stack">
      <h1>Analítiques de l’app antiga</h1>
      <p>
        El panell cultural no accedeix a les dades privades de l’app de 2026.
        Aquesta versió no recull analítica d’ús.
      </p>
      <Link href="/admin/events">Gestionar l’agenda cultural</Link>
    </section>
  )
}
