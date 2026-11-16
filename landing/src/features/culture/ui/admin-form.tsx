"use client"

import { useActionState } from "react"
import { saveCulture, copyCultureEvent } from "../server/actions"
import { reviewProposal } from "../server/proposal-actions"
import type { ActionResult } from "../domain/types"

export function EntityForm({
  entity,
  id,
  children,
  proposalId,
}: {
  entity: string
  id?: string
  children: React.ReactNode
  proposalId?: string
}) {
  const [state, action, pending] = useActionState<ActionResult, FormData>(
    proposalId ? reviewProposal : saveCulture,
    {}
  )
  return (
    <form action={action} className="culture-stack">
      <input type="hidden" name="entity" value={entity} />
      <input type="hidden" name="id" value={state.id ?? id ?? ""} />
      {proposalId && <><input type="hidden" name="proposal_id" value={proposalId} /><input type="hidden" name="decision" value="accept" /></>}
      <fieldset disabled={pending} className="culture-stack">
        {children}
      </fieldset>
      {state.error && (
        <p role="alert" className="culture-notice">
          {state.error}
        </p>
      )}
      {state.success && (
        <div role="status" className="culture-notice">
          <p>{state.success}</p>
          <a
            className="culture-button culture-quiet"
            href={proposalId ? "/admin/proposals" : `/admin/${entity === "event" ? "events" : entity === "festival" ? "festivals" : entity === "place" ? "places" : entity === "category" ? "categories" : "announcements"}`}
          >
            {proposalId ? "Tornar a les propostes" : "Crear un altre registre"}
          </a>
        </div>
      )}
      <button className="culture-button" type="submit" disabled={pending || Boolean(proposalId && state.success)}>
        {pending ? "Desant…" : proposalId ? "Acceptar i publicar" : "Desar"}
      </button>
    </form>
  )
}

export function DuplicateForm({ id }: { id: string }) {
  const [state, action, pending] = useActionState<ActionResult, FormData>(
    copyCultureEvent,
    {}
  )
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <button
        className="culture-button culture-quiet"
        disabled={pending || Boolean(state.success)}
      >
        Duplicar com a esborrany
      </button>
      {state.error && <p role="alert">{state.error}</p>}
      {state.success && (
        <p role="status">
          {state.success}{" "}
          <a href={`/admin/events?edit=${state.id}`}>Editar la còpia</a>
        </p>
      )}
    </form>
  )
}

export function Field({
  name,
  label,
  value,
  required = false,
  type = "text",
  maxLength,
  multiline = false,
}: {
  name: string
  label: string
  value?: string | number | null
  required?: boolean
  type?: string
  maxLength?: number
  multiline?: boolean
}) {
  return (
    <label className="culture-field">
      {label}
      {multiline ? (
        <textarea
          name={name}
          defaultValue={value ?? ""}
          required={required}
          maxLength={maxLength}
        />
      ) : (
        <input
          name={name}
          type={type}
          defaultValue={value ?? ""}
          required={required}
          maxLength={maxLength}
          step={type === "number" ? "any" : undefined}
        />
      )}
    </label>
  )
}

export function SelectField({
  name,
  label,
  value,
  options,
  required = false,
}: {
  name: string
  label: string
  value?: string | null
  options: { id: string; name: string }[]
  required?: boolean
}) {
  return (
    <label className="culture-field">
      {label}
      <select name={name} defaultValue={value ?? ""} required={required}>
        {!required && <option value="">Cap</option>}
        {required && !value && (
          <option value="" disabled>
            Selecciona…
          </option>
        )}
        {options.map((item) => (
          <option value={item.id} key={item.id}>
            {item.name}
          </option>
        ))}
      </select>
    </label>
  )
}

export function PublicationField({ value = "draft" }: { value?: string }) {
  return (
    <SelectField
      name="publication"
      label="Visibilitat"
      value={value}
      required
      options={[
        { id: "draft", name: "Esborrany (només administració)" },
        { id: "published", name: "Publicat" },
      ]}
    />
  )
}
