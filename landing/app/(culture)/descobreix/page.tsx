import Link from "next/link"
import { InstallButton } from "@/src/features/culture/ui/install-button"

export const metadata = {
  title: "Descobreix l’agenda",
  description: "Una agenda cultural per descobrir els municipis disponibles a Catalunya.",
}

export default function DiscoverPage() {
  return <main id="main-content" className="culture-app culture-container culture-main culture-stack">
    <Link href="/">← Tornar a l’agenda</Link>
    <section className="culture-intro">
      <p className="culture-meta">Una iniciativa independent</p>
      <h1>La cultura, més a prop</h1>
      <p>Descobreix actes culturals dels municipis disponibles en una sola agenda i un mapa compartit.</p>
      <p>Comencem amb Mataró i incorporarem municipis a mesura que hi hagi programació disponible.</p>
    </section>
    <div className="culture-row">
      <Link className="culture-button" href="/">Obrir l’agenda</Link>
      <Link className="culture-button culture-quiet" href="/mapa">Explorar el mapa</Link>
    </div>
    <section className="culture-card culture-stack">
      <h2>Porta l’agenda al teu dispositiu</h2>
      <p>Instal·la la versió web des del navegador. No cal compte ni passar per cap botiga.</p>
      <InstallButton />
    </section>
    <p className="culture-meta">La disponibilitat d’actes depèn de les dades incorporades. Consulta sempre l’organització per confirmar els detalls.</p>
  </main>
}