"use client"

import { useActionState } from "react"
import { reviewProposal } from "../server/proposal-actions"
import type { ActionResult } from "../domain/types"

export function RejectProposal({ id }: { id: string }) {
  const [state, action, pending] = useActionState<ActionResult, FormData>(reviewProposal, {})
  return <form action={action} className="culture-stack">
    <input type="hidden" name="proposal_id" value={id} />
    <input type="hidden" name="decision" value="reject" />
    <button className="culture-button culture-quiet" disabled={pending || Boolean(state.success)}>{pending ? "Desant…" : "Rebutjar proposta"}</button>
    {state.error && <p role="alert">{state.error}</p>}
    {state.success && <p role="status">{state.success}</p>}
  </form>
}