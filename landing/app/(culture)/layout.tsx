import type { Metadata } from "next"
import "@/src/features/culture/ui/culture.css"

// Public HTML is shared. Preferences and favorites are applied only in the client.
export const revalidate = 30

export const metadata: Metadata = {
  title: {
    default: "Agenda cultural de Catalunya",
    template: "%s · Agenda cultural",
  },
  description:
    "Descobreix actes culturals dels municipis disponibles. Agenda, mapa i favorits, sense crear un compte.",
  applicationName: "Agenda cultural",
  openGraph: {
    title: "Agenda cultural de Catalunya",
    description: "La cultura dels municipis disponibles, tot l’any.",
    locale: "ca_ES",
    type: "website",
  },
  icons: {
    icon: "/culture-icon.svg",
    apple: "/culture-icons/apple-touch-icon.png",
  },
}
export default function CultureLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
