import type { Metadata } from 'next'
import { SiteFooter } from '@/components/SiteFooter'
import { SiteHeader } from '@/components/SiteHeader'
import { ru } from '@/i18n/ru'
import './globals.css'

export const metadata: Metadata = {
  title: {
    default: ru.siteTitle,
    template: `%s — ${ru.siteName}`,
  },
  description: ru.siteDescription,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      {/* Колонка на всю высоту: подвал прижат к низу даже на короткой странице. */}
      <body className="flex min-h-screen flex-col antialiased">
        <SiteHeader />
        <div className="flex-1">{children}</div>
        <SiteFooter />
      </body>
    </html>
  )
}
