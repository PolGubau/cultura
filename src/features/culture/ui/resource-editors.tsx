import type {
  Announcement,
  Category,
  CultureCatalog,
  Festival,
  Place,
} from "../domain/types"
import { localInput } from "../domain/time"
import { EntityForm, Field, SelectField, PublicationField } from "./admin-form"

export function FestivalEditor({ festival }: { festival?: Festival }) {
  return (
    <EntityForm entity="festival" id={festival?.id}>
      <div className="culture-form-grid">
        <Field
          name="name"
          label="Nom (inclou l’edició, p. ex. Les Santes 2027)"
          value={festival?.name}
          required
          maxLength={160}
        />
        <Field
          name="starts_on"
          label="Primer dia del mode festa"
          type="date"
          value={festival?.starts_on}
          required
        />
        <Field
          name="ends_on"
          label="Últim dia del mode festa"
          type="date"
          value={festival?.ends_on}
          required
        />
        <Field
          name="logo_url"
          label="URL del logo (HTTPS)"
          type="url"
          value={festival?.logo_url}
        />
        <Field
          name="primary_color"
          label="Color principal"
          type="color"
          value={festival?.primary_color ?? "#9f1239"}
          required
        />
        <Field
          name="priority"
          label="Prioritat (0–100, per a festes coincidents)"
          type="number"
          value={festival?.priority ?? 0}
        />
      </div>
      <Field
        name="description"
        label="Presentació de la festa"
        value={festival?.description}
        multiline
        maxLength={5000}
      />
      <label className="culture-row">
        <input
          type="checkbox"
          name="auto_activate"
          defaultChecked={festival?.auto_activate ?? true}
        />{" "}
        Activar automàticament durant aquestes dates
      </label>
      <PublicationField value={festival?.publication} />
      <p>
        El color del text s’ajusta automàticament al color triat per mantenir el
        contrast dels botons.
      </p>
    </EntityForm>
  )
}

export function PlaceEditor({ place }: { place?: Place }) {
  return (
    <EntityForm entity="place" id={place?.id}>
      <div className="culture-form-grid">
        <Field
          name="name"
          label="Nom del lloc"
          value={place?.name}
          required
          maxLength={160}
        />
        <Field
          name="address"
          label="Adreça"
          value={place?.address}
          maxLength={500}
        />
        <Field
          name="latitude"
          label="Latitud"
          type="number"
          value={place?.latitude}
          required
        />
        <Field
          name="longitude"
          label="Longitud"
          type="number"
          value={place?.longitude}
          required
        />
      </div>
      <p>
        Les coordenades s’introdueixen en graus decimals. Els llocs són públics
        i es reutilitzen entre actes.
      </p>
    </EntityForm>
  )
}

export function CategoryEditor({ category }: { category?: Category }) {
  return (
    <EntityForm entity="category" id={category?.id}>
      <Field
        name="slug"
        label="Identificador (minúscules i guions)"
        value={category?.id}
        required
        maxLength={80}
      />
      <Field
        name="name"
        label="Nom de la categoria"
        value={category?.name}
        required
        maxLength={80}
      />
    </EntityForm>
  )
}

export function AnnouncementEditor({
  item,
  catalog,
}: {
  item?: Announcement
  catalog: CultureCatalog
}) {
  return (
    <EntityForm entity="announcement" id={item?.id}>
      <Field
        name="title"
        label="Títol"
        value={item?.title}
        required
        maxLength={160}
      />
      <Field
        name="message"
        label="Missatge"
        value={item?.message}
        required
        maxLength={2000}
        multiline
      />
      <div className="culture-form-grid">
        <Field
          name="starts_at"
          label="Visible a partir de (hora local)"
          type="datetime-local"
          value={item ? localInput(item.starts_at, catalog.city.timezone) : ""}
          required
        />
        <Field
          name="ends_at"
          label="Visible fins a (hora local)"
          type="datetime-local"
          value={item ? localInput(item.ends_at, catalog.city.timezone) : ""}
          required
        />
        <SelectField
          name="festival_id"
          label="Festa (buit = tota la ciutat)"
          value={item?.festival_id}
          options={catalog.festivals}
        />
        <SelectField
          name="severity"
          label="Importància"
          value={item?.severity ?? "info"}
          required
          options={[
            { id: "info", name: "Informació" },
            { id: "warning", name: "Avís" },
            { id: "critical", name: "Important" },
          ]}
        />
        <PublicationField value={item?.publication} />
      </div>
      <p>
        Els avisos es mostren amb l’agenda oberta; no són notificacions push ni
        un sistema d’emergències.
      </p>
    </EntityForm>
  )
}
