import type { Metadata } from 'next'
import { Hero } from '@/components/sections/hero'
import { AppScreens } from '@/components/sections/app-screens'
import { Features } from '@/components/sections/features'
import { Trust } from '@/components/sections/trust'
import { PostersMarquee } from '@/components/sections/posters-marquee'
import { Programme } from '@/components/sections/programme'
import { Faq } from '@/components/sections/faq'

export const metadata: Metadata = {
  title: 'Arxiu · Les Santes 2026',
  description: 'Pàgina històrica de l’app nativa de Les Santes 2026.',
  alternates: { canonical: '/santes-2026' },
}
export default function Page() {
  return <main id="main-content"><p className="mx-auto max-w-5xl p-6">Arxiu de 2026. La nova agenda cultural és a l’inici.</p>
    <Hero /><AppScreens /><Features /><Trust /><PostersMarquee /><Programme /><Faq />
  </main>
}