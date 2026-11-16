import { getIntegrationEvent, saveIntegrationEvent } from "@/src/features/culture/server/integration-events"
type Context = { params: Promise<{ id: string }> }
export async function GET(request: Request, context: Context) { return getIntegrationEvent(request, (await context.params).id) }
export async function PUT(request: Request, context: Context) { return saveIntegrationEvent(request, (await context.params).id) }