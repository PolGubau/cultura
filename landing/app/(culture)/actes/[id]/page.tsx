import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { cache } from "react"
import { loadEventContext } from "@/src/features/culture/server/repository"
import { EventDetail } from "@/src/features/culture/ui/event-detail"

const load = cache(loadEventContext)
// Generate details on first visit, then serve the shared ISR page.
export function generateStaticParams() {
  return []
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const result = await load((await params).id)
  if (!result) return { title: "Acte no trobat", robots: { index: false } }
  const { ca } = result.event.translations
  return {
    title: ca.title,
    description: ca.summary,
    alternates: { canonical: `/actes/${result.event.id}` },
    openGraph: {
      title: ca.title,
      description: ca.summary,
      ...(result.event.image_url ? { images: [result.event.image_url] } : {}),
    },
  }
}
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const result = await load((await params).id)
  if (!result) notFound()
  const place = result.catalog.places.find(
    (item) => item.id === result.event.place_id
  )
  const structured = {
    "@context": "https://schema.org",
    "@type": result.event.format === "exhibition" ? "ExhibitionEvent" : "Event",
    name: result.event.translations.ca.title,
    description: result.event.translations.ca.summary,
    startDate: result.event.starts_at,
    endDate: result.event.ends_at,
    eventStatus:
      result.event.status === "cancelled"
        ? "https://schema.org/EventCancelled"
        : "https://schema.org/EventScheduled",
    location: place
      ? { "@type": "Place", name: place.name, address: place.address }
      : undefined,
  }
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structured).replace(/</g, "\\u003c"),
        }}
      />
      <EventDetail {...result} />
    </>
  )
}
