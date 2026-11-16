import { PublicPage } from "@/src/features/culture/ui/public-page"
export const metadata = { title: "Favorits", robots: { index: false } }
export default function Page() {
  return <PublicPage view="favorites" />
}
