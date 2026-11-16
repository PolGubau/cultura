import Link from "next/link"
import { ProposalForm } from "@/src/features/culture/ui/proposal-form"

export const metadata = { title: "Proposa un acte", robots: { index: false, follow: true } }
export default function Page() {
  return <main id="main-content" className="culture-app culture-container culture-main culture-detail culture-stack">
    <Link href="/">← Agenda</Link><h1>Proposa un acte</h1><ProposalForm />
  </main>
}