"use client"

import Link from "next/link"
import { useActionState } from "react"
import { submitProposal } from "../server/proposal-actions"
import { Field } from "./admin-form"
import type { ActionResult } from "../domain/types"

export function ProposalForm() {
  const [state, action, pending] = useActionState<ActionResult, FormData>(submitProposal, {})
  if (state.success) return <div className="culture-notice" role="status"><p>{state.success}</p><Link href="/">Tornar a l’agenda</Link></div>
  return <form action={action} className="culture-card culture-stack">
    <p>Proposa un acte de Mataró. No cal cap compte; l’equip el revisarà abans de publicar-lo.</p>
    <fieldset disabled={pending} className="culture-stack">
      <Field name="title" label="Títol de l’acte" maxLength={160} required />
      <Field name="summary" label="Resum" maxLength={500} multiline required />
      <Field name="description" label="Descripció (opcional)" maxLength={5000} multiline />
      <Field name="place_name" label="Lloc i adreça" maxLength={160} required />
      <div className="culture-form-grid">
        <Field name="starts_at" label="Inici (hora local)" type="datetime-local" required />
        <Field name="ends_at" label="Final (hora local)" type="datetime-local" required />
      </div>
      <Field name="organizer" label="Organitza (opcional)" maxLength={160} />
      <Field name="booking_url" label="Enllaç d’informació o entrades (HTTPS, opcional)" type="url" maxLength={2048} />
    </fieldset>
    <p className="culture-meta">No incloguis dades personals que no vulguis publicar. Consulta la <Link href="/legal/privacitat">política de privacitat</Link>.</p>
    {state.error && <p role="alert" className="culture-notice">{state.error}</p>}
    <button className="culture-button" disabled={pending}>{pending ? "Enviant…" : "Enviar proposta"}</button>
  </form>
}