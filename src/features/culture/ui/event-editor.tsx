import type { CulturalEvent, CultureCatalog } from "../domain/types"
import { localInput } from "../domain/time"
import { EntityForm, Field, SelectField, PublicationField } from "./admin-form"

export function EventEditor({
  event,
  catalog,
}: {
  event?: CulturalEvent
  catalog: CultureCatalog
}) {
  return (
    <EntityForm entity="event" id={event?.id}>
      <p>
        Horaris de {catalog.city.name} ({catalog.city.timezone}). L’acte només
        és públic si també ho és la festa associada.
      </p>
      {(["ca", "es", "en"] as const).map((locale) => (
        <details key={locale} open={locale === "ca"} className="culture-card">
          <summary>
            {locale === "ca"
              ? "Català (obligatori)"
              : locale === "es"
                ? "Castellano (opcional)"
                : "English (optional)"}
          </summary>
          <div className="culture-stack">
            <Field
              name={`${locale}_title`}
              label="Títol"
              value={event?.translations[locale]?.title}
              maxLength={160}
              required={locale === "ca"}
            />
            <Field
              name={`${locale}_summary`}
              label="Resum"
              value={event?.translations[locale]?.summary}
              maxLength={500}
              required={locale === "ca"}
              multiline
            />
            <Field
              name={`${locale}_description`}
              label="Descripció"
              value={event?.translations[locale]?.description}
              maxLength={15000}
              multiline
            />
          </div>
        </details>
      ))}
      <div className="culture-form-grid">
        <SelectField
          name="place_id"
          label="Lloc / punt de trobada"
          value={event?.place_id}
          options={catalog.places}
          required
        />
        <SelectField
          name="category_id"
          label="Categoria"
          value={event?.category_id}
          options={catalog.categories}
          required
        />
        <SelectField
          name="festival_id"
          label="Festa (opcional)"
          value={event?.festival_id}
          options={catalog.festivals}
        />
        <SelectField
          name="format"
          label="Format"
          value={event?.format ?? "timed"}
          required
          options={[
            { id: "timed", name: "Acte amb horari" },
            { id: "exhibition", name: "Exposició / llarga durada" },
          ]}
        />
        <Field
          name="starts_at"
          label="Inici"
          type="datetime-local"
          value={
            event ? localInput(event.starts_at, catalog.city.timezone) : ""
          }
          required
        />
        <Field
          name="ends_at"
          label="Final"
          type="datetime-local"
          value={event ? localInput(event.ends_at, catalog.city.timezone) : ""}
          required
        />
        <Field
          name="price"
          label="Preu (escriu Gratuït si ho és)"
          value={event?.price}
          maxLength={160}
        />
        <Field
          name="organizer"
          label="Organitza"
          value={event?.organizer}
          maxLength={160}
        />
        <Field
          name="image_url"
          label="URL de la imatge (HTTPS)"
          type="url"
          value={event?.image_url}
        />
        <Field
          name="booking_url"
          label="URL d’entrades / informació (HTTPS)"
          type="url"
          value={event?.booking_url}
        />
      </div>
      <Field
        name="schedule_notes"
        label="Horaris d’obertura, pauses, instruccions"
        value={event?.schedule_notes}
        multiline
        maxLength={2000}
      />
      <Field
        name="accessibility"
        label="Informació d’accessibilitat"
        value={event?.accessibility}
        multiline
        maxLength={2000}
      />
      <details>
        <summary>Recorregut i origen (avançat)</summary>
        <div className="culture-stack">
          <Field
            name="route"
            label={
              'Recorregut JSON: [{"lat":41.53,"lng":2.44},{"lat":41.54,"lng":2.45}]'
            }
            value={event?.route ? JSON.stringify(event.route) : ""}
            multiline
            maxLength={50000}
          />
          <Field
            name="source"
            label="Origen"
            value={event?.source}
            maxLength={160}
          />
          <Field
            name="external_id"
            label="ID extern"
            value={event?.external_id}
            maxLength={160}
          />
        </div>
      </details>
      <div className="culture-form-grid">
        <PublicationField value={event?.publication} />
        <SelectField
          name="status"
          label="Estat de l’acte"
          value={event?.status ?? "scheduled"}
          required
          options={[
            { id: "scheduled", name: "Programat" },
            { id: "cancelled", name: "Cancel·lat" },
          ]}
        />
      </div>
      <Field
        name="cancellation_reason"
        label="Motiu de cancel·lació (obligatori si està cancel·lat)"
        value={event?.cancellation_reason}
        maxLength={1000}
      />
    </EntityForm>
  )
}
