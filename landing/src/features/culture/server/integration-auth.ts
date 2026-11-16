import "server-only"
import { createClient } from "@supabase/supabase-js"
import { CITY_ID, hasDatabase } from "./config"

export class IntegrationError extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string) { super(message) }
}
export async function integrationSession(request: Request, writing = false) {
  const authorization = request.headers.get("authorization")
  if (!authorization || !/^Bearer [^\s]+$/i.test(authorization) || authorization.length > 16_384)
    throw new IntegrationError(401, "unauthorized", "A valid Bearer access token is required.")
  if (!hasDatabase()) throw new IntegrationError(503, "unavailable", "Database not configured.")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: authorization }, fetch: (input, init) => fetch(input, { ...init, cache: "no-store", signal: AbortSignal.timeout(8_000) }) },
  })
  const { data: { user }, error } = await db.auth.getUser(authorization.slice(7))
  if (error || !user) throw new IntegrationError(401, "unauthorized", "Invalid or expired access token.")
  const integration = await db.from("city_integrations").select("city_id,source,can_write,can_publish,enabled").eq("user_id", user.id).eq("city_id", CITY_ID).maybeSingle()
  if (integration.error) throw new IntegrationError(503, "unavailable", "Integration configuration unavailable.")
  if (!integration.data?.enabled || (writing && !integration.data.can_write))
    throw new IntegrationError(403, "forbidden", "Integration is disabled or lacks the required permission.")
  const budget = await db.rpc("consume_culture_api_request")
  if (budget.error) throw new IntegrationError(503, "unavailable", "Rate limiter unavailable.")
  if (!budget.data) throw new IntegrationError(429, "rate_limited", "Request budget exceeded. Retry in one minute.")
  return { db, ...integration.data }
}
