import { LoginForm } from "./LoginForm"
import { redirect } from "next/navigation"
import { citySession } from "@/src/features/culture/server/auth"

export default async function LoginPage() {
  const session = await citySession()
  if (session && ["owner", "editor"].includes(session.role ?? ""))
    redirect("/admin/events")
  return <LoginForm />
}
