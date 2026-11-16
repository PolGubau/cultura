import { cultureOpenApi } from "@/src/features/culture/domain/openapi"
export function GET() { return Response.json(cultureOpenApi, { headers: { "Cache-Control": "public, max-age=3600" } }) }