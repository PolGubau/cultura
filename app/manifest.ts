import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Agenda cultural de Mataró",
    short_name: "Mataró Cultura",
    description: "La cultura de Mataró, tot l’any. Agenda, mapa i favorits.",
    start_url: "/",
    display: "standalone",
    background_color: "#faf8f5",
    theme_color: "#9f1239",
    lang: "ca",
    scope: "/",
    icons: [
      {
        src: "/culture-icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/culture-icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/culture-icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  }
}
