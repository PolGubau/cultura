import Link from "next/link"
import { requireEditor } from "@/src/features/culture/server/auth"

export default async function FeedbackPage() {
  await requireEditor()
  return (
    <section className="culture-stack">
      <h1>Feedback de l’app antiga</h1>
      <p>
        El panell cultural no accedeix als missatges privats de 2026. El
        contacte d’aquesta versió està disponible a la pàgina de suport.
      </p>
      <Link href="/admin/events">Gestionar l’agenda cultural</Link>
    </section>
  )
}
