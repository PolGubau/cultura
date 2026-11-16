"use client"
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main id="main-content" className="culture-container culture-main">
      <h1>No es pot carregar l’agenda</h1>
      <p>
        No s’han pogut recuperar les dades. Comprova la connexió i torna-ho a
        provar.
      </p>
      <button type="button" className="culture-button" onClick={reset}>
        Reintentar
      </button>
    </main>
  )
}
