"use server"

import { revalidatePath } from "next/cache"
import { saveEntity, duplicateEvent } from "./writes"
import { ValidationError } from "../domain/validation"
import type { ActionResult } from "../domain/types"

function invalidate() {
  revalidatePath("/", "layout")
}

export async function saveCulture(
  _previous: ActionResult,
  form: FormData
): Promise<ActionResult> {
  try {
    const result = await saveEntity(form)
    if (result.success) invalidate()
    return result
  } catch (error) {
    return {
      error:
        error instanceof ValidationError ||
        (error instanceof Error && error.message.startsWith("No tens permisos"))
          ? error.message
          : "No s’ha pogut desar. Revisa les dates, la connexió i els permisos.",
    }
  }
}

export async function copyCultureEvent(
  _previous: ActionResult,
  form: FormData
): Promise<ActionResult> {
  try {
    const result = await duplicateEvent(String(form.get("id") ?? ""))
    if (result.success) invalidate()
    return result
  } catch {
    return { error: "No s’ha pogut duplicar. Comprova els permisos." }
  }
}
