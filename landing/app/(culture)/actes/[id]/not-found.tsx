import Link from "next/link"
export default function NotFound() {
  return (
    <main id="main-content" className="culture-container culture-main">
      <h1>Acte no trobat</h1>
      <p>Pot ser que encara no s’hagi publicat.</p>
      <Link href="/">Tornar a l’agenda</Link>
    </main>
  )
}
