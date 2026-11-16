import Link from "next/link"
import { citySession } from "@/src/features/culture/server/auth"
import { hasDatabase } from "@/src/features/culture/server/config"
import "@/src/features/culture/ui/culture.css"
import { AdminNav, AdminSignOutButton } from "./AdminNav"
import { LoginForm } from "./LoginForm"

export const dynamic = "force-dynamic"

export const metadata = {
  title: "Administració · Mataró Cultura",
  robots: { index: false, follow: false },
}

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  if (!hasDatabase())
    return (
      <main id="main-content" className="culture-admin">
        <h1>Configuració pendent</h1>
        <p>
          Configura Supabase i aplica les migracions indicades a
          docs/CULTURE.md.
        </p>
        <Link href="/">Tornar a l’agenda</Link>
      </main>
    )
  const session = await citySession()
  if (!session)
    return (
      <main id="main-content">
        <LoginForm />
      </main>
    )
  if (!["owner", "editor"].includes(session.role ?? ""))
    return (
      <main id="main-content" className="culture-admin">
        <h1>Sense permisos d’edició</h1>
        <p>
          El teu compte no té permisos per gestionar aquesta ciutat. Demana
          accés a la persona responsable.
        </p>
        <AdminSignOutButton />
      </main>
    )
  return (
    <div className="culture-admin">
      <header>
        <div className="culture-row culture-between">
          <Link href="/">Mataró · Cultura</Link>
          <div className="culture-row">
            <span>{session.user.email}</span>
            <AdminSignOutButton />
          </div>
        </div>
        <AdminNav />
      </header>
      <main id="main-content">{children}</main>
    </div>
  )
}
