"use server"

import { createHmac } from "node:crypto"
import { isIP } from "node:net"
import { headers } from "next/headers"
import { revalidatePath, updateTag } from "next/cache"
import { createAdminClient } from "@/lib/supabase/server"
import { parseProposal } from "../domain/proposals"
import { parseEvent, text, uuid, ValidationError } from "../domain/validation"
import type { ActionResult } from "../domain/types"
import { requireEditor } from "./auth"
import { CITY_ID, hasDatabase } from "./config"
import { PUBLIC_CACHE_TAG } from "./public-cache"

export async function submitProposal(_previous: ActionResult, form: FormData): Promise<ActionResult> {
  try {
    const secret = process.env.PROPOSAL_HASH_SECRET
    if (!hasDatabase() || !process.env.SUPABASE_SERVICE_KEY || !secret || secret.length < 32)
      return { error: "Les propostes encara no estan disponibles." }
    const requestHeaders = await headers()
    const ip = process.env.NODE_ENV === "development"
      ? "127.0.0.1"
      : process.env.VERCEL === "1" && process.env.PROPOSALS_TRUST_VERCEL_IP === "1"
        ? requestHeaders.get("x-vercel-forwarded-for")?.trim() : null
    if (!ip || !isIP(ip)) return { error: "Les propostes encara no estan disponibles." }
    const db = await createAdminClient()
    const { data: city, error: cityError } = await db.from("cities").select("timezone").eq("id", CITY_ID).single()
    if (cityError || !city) return { error: "No es pot carregar la ciutat." }
    const proposal = parseProposal(form, city.timezone)
    const key = createHmac("sha256", secret).update(ip).digest("hex")
    const { data, error } = await db.rpc("submit_city_proposal", { p_city: CITY_ID, p_key: key, p_data: proposal })
    if (error) return { error: "No s’ha pogut enviar la proposta. Torna-ho a provar." }
    if (!data) return { error: "S’ha arribat al límit de propostes. Torna-ho a provar més tard." }
    return { success: "Proposta enviada. La revisarem abans de publicar-la." }
  } catch (error) {
    return { error: error instanceof ValidationError || (error instanceof Error && error.message.includes("horari"))
      ? error.message : "No s’ha pogut enviar la proposta. Revisa les dades i torna-ho a provar." }
  }
}

export async function reviewProposal(_previous: ActionResult, form: FormData): Promise<ActionResult> {
  try {
    const db = await requireEditor()
    const id = uuid(text(form, "proposal_id", 36, true))
    const accept = text(form, "decision", 10, true) === "accept"
    if (!accept && form.get("decision") !== "reject") throw new ValidationError("Decisió no vàlida.")
    let payload = null
    if (accept) {
      const { data: city, error } = await db.from("cities").select("timezone").eq("id", CITY_ID).single()
      if (error || !city) return { error: "No es pot carregar la ciutat." }
      payload = parseEvent(form, city.timezone)
    }
    const { data, error } = await db.rpc("review_city_proposal", { p_id: id, p_city: CITY_ID, p_accept: accept, p_event: payload })
    if (error) return { error: "No s’ha pogut revisar. Comprova les dades: potser ja s’ha revisat." }
    if (accept) { updateTag(PUBLIC_CACHE_TAG); revalidatePath("/", "layout") }
    revalidatePath("/admin/proposals")
    return { success: accept ? "Proposta acceptada i acte publicat." : "Proposta rebutjada.", ...(data ? { id: data } : {}) }
  } catch (error) {
    return { error: error instanceof ValidationError ? error.message : "No s’ha pogut revisar la proposta." }
  }
}