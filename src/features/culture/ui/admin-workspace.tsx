import Link from "next/link"
import { requireEditor } from "../server/auth"
import { loadCatalog } from "../server/repository"
import { validDay } from "../domain/time"
import { EventEditor } from "./event-editor"
import {
  AnnouncementEditor,
  CategoryEditor,
  FestivalEditor,
  PlaceEditor,
} from "./resource-editors"
import { DuplicateForm } from "./admin-form"
import type { CultureCatalog } from "../domain/types"

type Section =
  | "events"
  | "festivals"
  | "places"
  | "categories"
  | "announcements"
type Params = Promise<{ edit?: string; from?: string; q?: string }>
const titles = {
  events: "Actes",
  festivals: "Festes",
  places: "Llocs",
  categories: "Categories",
  announcements: "Avisos",
}

export async function AdminWorkspace({
  section,
  searchParams,
}: {
  section: Section
  searchParams: Params
}) {
  await requireEditor()
  const params = await searchParams
  const from = params.from && validDay(params.from) ? params.from : undefined
  const result = await loadCatalog(from, true)
  if (!result.data)
    return (
      <section>
        <h1>{titles[section]}</h1>
        <p role="alert">{result.error}</p>
      </section>
    )
  const data = result.data
  const items =
    section === "events"
      ? data.events.map((item) => ({
          id: item.id,
          name: item.translations.ca.title,
          note: `${item.starts_at.slice(0, 10)} · ${item.publication}${item.status === "cancelled" ? " · Cancel·lat" : ""}`,
        }))
      : section === "announcements"
        ? data.announcements.map((item) => ({
            id: item.id,
            name: item.title,
            note: item.publication,
          }))
        : data[section].map((item) => ({
            id: item.id,
            name: item.name,
            note: "publication" in item ? String(item.publication) : "",
          }))
  const query = params.q?.slice(0, 160).toLocaleLowerCase() ?? ""
  const selectedExists =
    !params.edit || items.some((item) => item.id === params.edit)
  const suffix = from ? `&from=${encodeURIComponent(from)}` : ""
  return (
    <section className="culture-stack">
      <div>
        <h1>{titles[section]}</h1>
        <p>Agenda anual de {data.city.name} · Càrrega manual</p>
      </div>
      <form className="culture-filters" method="get">
        {section === "events" && (
          <label className="culture-field">
            Període de 90 dies des de
            <input type="date" name="from" defaultValue={data.from} />
          </label>
        )}
        <label className="culture-field">
          Cerca
          <input name="q" type="search" defaultValue={params.q} />
        </label>
        <button className="culture-button culture-quiet">Consultar</button>
      </form>
      <div className="culture-row">
        <Link
          className="culture-button"
          href={`/admin/${section}${from ? `?from=${from}` : ""}`}
        >
          Nou registre
        </Link>
      </div>
      <div className="culture-form-grid">
        <div className="culture-stack" style={{ alignContent: "start" }}>
          {items
            .filter((item) => item.name.toLocaleLowerCase().includes(query))
            .map((item) => (
              <article className="culture-card" key={item.id}>
                <Link href={`/admin/${section}?edit=${item.id}${suffix}`}>
                  {item.name}
                </Link>
                {item.note && <p className="culture-meta">{item.note}</p>}
                {section === "events" && <DuplicateForm id={item.id} />}
              </article>
            ))}
          {!items.length && <p>Encara no hi ha registres en aquest període.</p>}
          {data.hasMore && section === "events" && (
            <p>
              Hi ha més de 1.000 actes. Tria una data més recent per continuar.
            </p>
          )}
        </div>
        <section className="culture-card" key={params.edit ?? "new"}>
          <h2>{params.edit ? "Editar registre" : "Crear registre"}</h2>
          {!selectedExists ? (
            <p>
              Registre no trobat en aquest període. Canvia la data de consulta.
            </p>
          ) : (
            <Editor section={section} id={params.edit} catalog={data} />
          )}
        </section>
      </div>
    </section>
  )
}

function Editor({
  section,
  id,
  catalog,
}: {
  section: Section
  id?: string
  catalog: CultureCatalog
}) {
  if (section === "events")
    return catalog.places.length && catalog.categories.length ? (
      <EventEditor
        event={catalog.events.find((item) => item.id === id)}
        catalog={catalog}
      />
    ) : (
      <p>
        Crea primer un <Link href="/admin/places">lloc</Link> i una{" "}
        <Link href="/admin/categories">categoria</Link>.
      </p>
    )
  if (section === "festivals")
    return (
      <FestivalEditor
        festival={catalog.festivals.find((item) => item.id === id)}
      />
    )
  if (section === "places")
    return <PlaceEditor place={catalog.places.find((item) => item.id === id)} />
  if (section === "categories")
    return (
      <CategoryEditor
        category={catalog.categories.find((item) => item.id === id)}
      />
    )
  return (
    <AnnouncementEditor
      item={catalog.announcements.find((item) => item.id === id)}
      catalog={catalog}
    />
  )
}
