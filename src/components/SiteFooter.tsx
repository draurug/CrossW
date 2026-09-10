import Link from 'next/link'
import { ru } from '@/i18n/ru'

/**
 * Подвал. Ссылка на «Источники» здесь не для симметрии: ТЗ §5.12 требует, чтобы
 * страница с лицензиями была доступна с любой страницы сайта.
 *
 * Оговорка про авторские определения — того же происхождения: тексты книг мы не
 * копируем, и это должно быть написано там, где читатель ищет мелкий шрифт.
 */
export function SiteFooter() {
  return (
    <footer className="mt-24 border-t" style={{ borderColor: 'var(--cell-line)' }}>
      <div className="mx-auto max-w-4xl px-6 py-8 text-sm" style={{ color: 'var(--muted)' }}>
        <Link href="/istochniki/" className="hover:underline" style={{ color: 'var(--accent)' }}>
          {ru.sources}
        </Link>
        <p className="mt-3 max-w-2xl">{ru.footerRights}</p>
      </div>
    </footer>
  )
}
