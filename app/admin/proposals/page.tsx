import Link from "next/link"
import { citySession } from "@/src/features/culture/server/auth"
import { CITY_ID } from "@/src/features/culture/server/config"
import { loadCatalog } from "@/src/features/culture/server/repository"
import { EventEditor } from "@/src/features/culture/ui/event-editor"
import { RejectProposal } from "@/src/features/culture/ui/proposal-review"
import type { Proposal } from "@/src/features/culture/domain/proposals"
import type { CulturalEvent } from "@/src/features/culture/domain/types"

export default async function Page({ searchParams }: { searchParams: Promise<{ edit?: string }> }) {
  const session = await citySession()
  if (!session || !["owner", "editor"].includes(session.role ?? "")) return null
  const { edit } = await searchParams
  const { data, error } = await session.db.from("city_event_proposals")
    .select("id,city_id,title,summary,description,place_name,organizer,booking_url,starts_at,ends_at,created_at")
    .eq("city_id", CITY_ID).eq("status", "pending").order("created_at").limit(100)
  if (error) return <section><h1>Propostes</h1><p role="alert">No es poden carregar les propostes. Revisa les migracions.</p></section>
  const proposals = (data ?? []) as Proposal[]
  const selected = proposals.find((item) => item.id === edit)
  const catalog = selected ? await loadCatalog(undefined, true) : null
  const event: CulturalEvent | undefined = selected ? {
    id: "", city_id: CITY_ID, festival_id: null, place_id: "", category_id: "",
    translations: { ca: { title: selected.title, summary: selected.summary, description: selected.description } },
    starts_at: selected.starts_at, ends_at: selected.ends_at, format: "timed", route: null,
    image_url: null, booking_url: selected.booking_url, price: "", accessibility: "", schedule_notes: "",
    organizer: selected.organizer, source: null, external_id: null, publication: "published", status: "scheduled",
    cancellation_reason: null, updated_at: selected.created_at,
  } : undefined
  return <section className="culture-stack"><h1>Propostes pendents</h1>
    <p>Revisa les dades i tria un lloc i una categoria abans de publicar.</p>
    <div className="culture-form-grid"><div className="culture-stack">
      {proposals.map((item) => <article key={item.id} className="culture-card"><Link href={`/admin/proposals?edit=${item.id}`}>{item.title}</Link><p className="culture-meta">{item.place_name}</p></article>)}
      {!proposals.length && <p>No hi ha propostes pendents.</p>}
      {proposals.length === 100 && <p>Es mostren les 100 propostes més antigues.</p>}
    </div><section className="culture-card">
      {edit && !selected && <p>Proposta no disponible o ja revisada.</p>}
      {selected && <><h2>Revisar proposta</h2><p>Lloc proposat: {selected.place_name}</p><RejectProposal id={selected.id} />
        {!catalog?.data ? <p role="alert">{catalog?.error ?? "No es pot carregar l’agenda."}</p> : !catalog.data.places.length || !catalog.data.categories.length
          ? <p>Crea primer un <Link href="/admin/places">lloc</Link> i una <Link href="/admin/categories">categoria</Link>.</p>
          : <EventEditor event={event} catalog={catalog.data} proposalId={selected.id} />}</>}
      {!edit && <p>Selecciona una proposta.</p>}
    </section></div></section>
}