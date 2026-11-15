import type { Metadata } from "next"
import "@/src/features/culture/ui/culture.css"

// Public HTML is shared. Preferences and favorites are applied only in the client.
export const revalidate = 30

export const metadata: Metadata = {
  title: {
    default: "Agenda cultural de Mataró",
    template: "%s · Mataró Cultura",
  },
  description:
    "Descobreix els actes culturals de Mataró tot l’any. Agenda, mapa i favorits, sense crear un compte.",
  applicationName: "Mataró Cultura",
  openGraph: {
    title: "Agenda cultural de Mataró",
    description: "La cultura de la ciutat, tot l’any.",
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
