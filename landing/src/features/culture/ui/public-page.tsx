import { loadCatalog } from "../server/repository"
import { CultureApp, type CultureView } from "./culture-app"

export async function PublicPage({ view }: { view: CultureView }) {
  const initial = await loadCatalog()
  return (
    <CultureApp
      initial={initial}
      view={view}
      initialNow={new Date().toISOString()}
    />
  )
}
