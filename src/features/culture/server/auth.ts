import "server-only"
import { createClient } from "@/lib/supabase/server"
import { CITY_ID, hasDatabase } from "./config"
import type { CityRole } from "../domain/types"

export async function citySession() {
  if (!hasDatabase()) return null
  const db = await createClient()
  const {
    data: { user },
    error,
  } = await db.auth.getUser()
  if (error || !user) return null
  const { data } = await db
    .from("city_memberships")
    .select("role")
    .eq("city_id", CITY_ID)
    .eq("user_id", user.id)
    .maybeSingle()
  return {
    db,
    user: { id: user.id, email: user.email },
    role: (data?.role as CityRole | undefined) ?? null,
  }
}

export async function requireEditor() {
  const session = await citySession()
  if (!session || !["owner", "editor"].includes(session.role ?? "")) {
    throw new Error("No tens permisos per editar l’agenda d’aquesta ciutat.")
  }
  return session.db
}
