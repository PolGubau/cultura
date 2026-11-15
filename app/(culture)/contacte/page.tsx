import Link from "next/link"
import { AUTHOR_NAME, CONTACT_EMAIL } from "@/lib/constants"

export const metadata = { title: "Contacte i suport" }

export default function Contact() {
  return (
    <main
      id="main-content"
      className="culture-app culture-container culture-main culture-detail culture-stack"
    >
      <Link href="/">← Agenda</Link>
      <h1>Contacte i suport</h1>
      <p>
        Mataró Cultura és una iniciativa independent de {AUTHOR_NAME}, no un
        servei oficial de l’Ajuntament.
      </p>
      <h2>Has trobat un error a l’agenda?</h2>
      <p>
        Envia’ns l’enllaç de l’acte i explica’ns què cal corregir. Per confirmar
        horaris, entrades o cancel·lacions, contacta també amb l’entitat
        organitzadora.
      </p>
      <a
        className="culture-button"
        href={`mailto:${CONTACT_EMAIL.support}?subject=${encodeURIComponent("Mataró Cultura · Suport")}`}
      >
        Escriure a suport
      </a>
      <p className="culture-meta">
        S’obrirà la teva aplicació de correu. No incloguis contrasenyes ni dades
        personals innecessàries. Aquest canal no és un servei d’emergències.
      </p>
      <Link href="/legal/privacitat">Privacitat de l’agenda web</Link>
    </main>
  )
}
