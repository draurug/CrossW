import type { Metadata } from 'next'
import Link from 'next/link'
import { ru } from '@/i18n/ru'

export const metadata: Metadata = {
  title: ru.sources,
  description: 'Словари, лицензии и атрибуция данных, на которых собран CrossW.',
}

/**
 * Страница обязательна не для красоты: словарь русских существительных взят из
 * OpenCorpora под CC-BY-SA, а эта лицензия требует named attribution.
 */
const sources = [
  {
    title: 'OpenCorpora',
    href: 'https://opencorpora.org/',
    what: 'Словарь русских существительных: из него генератор берёт слова для заполнения сетки.',
    licence: 'CC BY-SA 4.0',
    licenceHref: 'https://creativecommons.org/licenses/by-sa/4.0/',
  },
  {
    title: 'wordfreq',
    href: 'https://github.com/rspeer/wordfreq',
    what: 'Частотность слов. По ней отсеиваются редкие слова, которых читатель не знает.',
    licence: 'Apache 2.0',
    licenceHref: 'https://www.apache.org/licenses/LICENSE-2.0',
  },
]

export default function SourcesPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <Link href="/" className="text-sm hover:underline" style={{ color: 'var(--accent)' }}>
        ← {ru.siteName}
      </Link>

      <h1 className="mt-6 text-3xl font-bold tracking-tight">{ru.sources}</h1>

      <p className="mt-4" style={{ color: 'var(--muted)' }}>
        Определения к словам написаны нами. Данные, на которых собраны сетки, взяты из открытых
        источников — вот они.
      </p>

      <ul className="mt-8 space-y-6">
        {sources.map((source) => (
          <li key={source.title} className="border-l-2 pl-4" style={{ borderColor: 'var(--cell-line)' }}>
            <a
              href={source.href}
              className="font-semibold hover:underline"
              style={{ color: 'var(--accent)' }}
              rel="noreferrer noopener"
              target="_blank"
            >
              {source.title}
            </a>
            <p className="mt-1 text-sm">{source.what}</p>
            <p className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>
              Лицензия:{' '}
              <a href={source.licenceHref} className="hover:underline" rel="noreferrer noopener" target="_blank">
                {source.licence}
              </a>
            </p>
          </li>
        ))}
      </ul>

      <h2 className="mt-12 text-xl font-semibold">Книги и фильмы</h2>
      <p className="mt-3 text-sm" style={{ color: 'var(--muted)' }}>
        Тексты произведений не копируются и не хранятся. Определения — это отсылки к сюжету и
        деталям, написанные своими словами, вроде «Что разлила Аннушка». У каждого такого
        определения в исходниках указано, откуда взят факт, чтобы его можно было проверить.
      </p>
    </main>
  )
}
