import Link from "next/link"
import { AUTHOR_NAME, CONTACT_EMAIL } from "@/lib/constants"

export const metadata = { title: "Privacitat de l’agenda web" }
export default function Privacy() {
  return (
    <main
      id="main-content"
      className="culture-container culture-main culture-detail culture-stack"
    >
      <Link href="/">← Agenda</Link>
      <h1>Privacitat de l’agenda web</h1>
      <p>
        Responsable de la iniciativa independent: {AUTHOR_NAME}. Contacte:{" "}
        <a href={`mailto:${CONTACT_EMAIL.support}`}>{CONTACT_EMAIL.support}</a>.
      </p>
      <h2>Sense compte per consultar</h2>
      <p>
        La consulta pública no requereix registre. Aquesta versió web no envia
        esdeveniments d’analítica ni sincronitza els teus favorits amb el
        servidor.
      </p>
      <h2>Dades en aquest dispositiu</h2>
      <p>
        El navegador conserva els favorits, l’idioma dels actes i la festa
        triada a l’emmagatzematge local. El mode offline guarda fins a 12
        consultes de programació pública i els fitxers necessaris per
        llegir-les. Pots esborrar-ho des de la configuració de dades del lloc
        del teu navegador.
      </p>
      <h2>Ubicació, mapes i imatges</h2>
      <p>
        La ubicació només es demana si prems el botó del mapa. No es guarda ni
        s’envia al nostre servidor. El mapa fa peticions a OpenFreeMap per la
        zona visible; aquestes peticions i les imatges externes poden revelar la
        teva IP i la zona consultada als proveïdors. Les rutes i les entrades
        s’obren a serveis externs amb les seves pròpies polítiques.
      </p>
      <h2>Administració i infraestructura</h2>
      <p>
        Les propostes d’actes s’envien sense compte i es guarden per a la seva
        revisió. No demanem correu de contacte. No hi incloguis dades personals
        que no vulguis publicar. Per limitar abusos es conserva temporalment una
        empremta pseudònima de la IP; les entrades caducades es netegen amb nous
        enviaments. Contacta amb el responsable per sol·licitar-ne la retirada.
      </p>
      <p>
        Només les persones convidades poden editar. Supabase gestiona la seva
        autenticació i les galetes tècniques de sessió. L’allotjament i el
        servidor poden tractar IP i registres tècnics per prestar i protegir el
        servei. Abans de publicar oficialment cal documentar els proveïdors, la
        regió i la retenció efectivament contractats.
      </p>
      <h2>Els teus drets</h2>
      <p>
        Per consultar el tractament de dades del compte d’administració o
        exercir els drets aplicables, contacta amb el responsable. Pots retirar
        els permisos d’ubicació des del navegador.
      </p>
      <p>
        La <Link href="/privacy">política de l’app nativa de 2026</Link> és
        independent d’aquesta versió web.
      </p>
    </main>
  )
}
