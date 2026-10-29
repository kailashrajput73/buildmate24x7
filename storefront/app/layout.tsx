import type { Metadata, Viewport } from 'next'
import { Toaster } from 'sonner'
import '@fontsource/dm-sans/400.css'
import '@fontsource/dm-sans/500.css'
import '@fontsource/dm-sans/600.css'
import '@fontsource/dm-sans/700.css'
import '@fontsource/dm-sans/800.css'
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import '@fontsource/inter/700.css'
import '@fontsource/jetbrains-mono/500.css'
import '@fontsource/noto-sans-devanagari/400.css'
import '@fontsource/noto-sans-devanagari/600.css'
import 'primeicons/primeicons.css'
import './globals.css'
import { ShopProvider } from '@/lib/shop'
import { serverApi } from '@/lib/server-api'
import StyledComponentsRegistry from './registry'
import { UiProviders } from '@/ui/Providers'

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
  title: { default: 'BuildMate 24x7 — Plumbing, sanitary, electrical & hardware', template: '%s · BuildMate 24x7' },
  description: 'Genuine pipes, fittings, taps, wires, switches, fans, tools and building materials. Order online for store pickup or home delivery, with GST invoice.',
  icons: { icon: '/favicon.svg' },
  openGraph: { siteName: 'BuildMate 24x7', type: 'website' },
}
export const viewport: Viewport = { themeColor: '#1B2A47', width: 'device-width', initialScale: 1 }

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [categories, store] = await Promise.all([serverApi.categories(), serverApi.store()])
  return (
    <html lang="en">
      <body>
        <StyledComponentsRegistry>
          <ShopProvider>
            <UiProviders categories={categories ?? []} store={store ?? null}>
              {children}
              <Toaster position="top-center" richColors closeButton />
            </UiProviders>
          </ShopProvider>
        </StyledComponentsRegistry>
      </body>
    </html>
  )
}
