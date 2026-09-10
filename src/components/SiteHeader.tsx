import Link from 'next/link'
import { ru } from '@/i18n/ru'

/**
 * Шапка сайта: одно название, ведущее на главную.
 *
 * Навигации больше нет намеренно — весь сайт это две ступени, «темы» и «тема»,
 * и обе достижимы с главной. Меню из двух пунктов было бы мебелью.
 */
export function SiteHeader() {
  return (
    <header className="border-b" style={{ borderColor: 'var(--cell-line)' }}>
      <div className="mx-auto max-w-4xl px-6 py-5">
        <Link href="/" className="text-lg font-semibold tracking-tight hover:underline">
          {ru.siteName}
        </Link>
      </div>
    </header>
  )
}
