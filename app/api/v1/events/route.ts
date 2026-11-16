import { listIntegrationEvents, saveIntegrationEvent } from "@/src/features/culture/server/integration-events"
export const GET = listIntegrationEvents
export function POST(request: Request) { return saveIntegrationEvent(request) }