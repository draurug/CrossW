/**
 * Страница кроссворда. Серверный компонент: заголовок, метаданные и обвязка.
 *
 * Сам кроссворд сюда не попадает — ни сетка, ни тем более ответы. Страница знает
 * только id и карточку из каталога, всё остальное `Player` дозагружает в
 * браузере (docs/architecture.md §2.3).
 */

import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { puzzles, topics, type PuzzleCard } from '@/generated/catalog'
import { ru } from '@/i18n/ru'
import Player from './Player'

/** Отладочная фикстура движка: даёт открыть плеер, пока контента ещё нет. */
const DEV_ID = 'dev-fixture-9x9'

/**
 * Статический экспорт: страницы существуют только для кроссвордов каталога.
 *
 * Пустой список Next со `output: 'export'` не принимает — падает с «missing
 * generateStaticParams()». Пока `content/puzzles/` пуст, отдаём один адрес
 * отладочной фикстуры: он же нужен для проверки плеера в `npm run dev`. Появится
 * первый настоящий кроссворд — фикстура из сборки исчезнет сама.
 */
export function generateStaticParams(): { id: string }[] {
  if (puzzles.length === 0) return [{ id: DEV_ID }]
  return puzzles.map((puzzle) => ({ id: puzzle.id }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const card = cardOf(id)
  return { title: card?.title ?? ru.notFound }
}

export default async function PuzzlePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const card = cardOf(id)
  if (card === undefined) notFound()

  const topic = topics.find((item) => item.id === card.topicId)

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <header className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">{card.title}</h1>
        <p className="mt-2 flex flex-wrap gap-x-3 text-sm" style={{ color: 'var(--muted)' }}>
          {topic !== undefined && (
            <Link href={`/topic/${topic.slug}/`} className="underline underline-offset-2">
              {topic.title}
            </Link>
          )}
          <span>{ru.difficulty[card.difficulty]}</span>
          <span>{ru.gridSize(card.rows, card.cols)}</span>
          <span>{ru.wordCount(card.entries)}</span>
        </p>
      </header>

      <Player id={id} />
    </main>
  )
}

/**
 * Карточка кроссворда из каталога.
 *
 * Пока каталог пуст, к нему добавляется отладочная фикстура движка: иначе
 * открыть плеер негде, а сборке нечего экспортировать. Как только появится
 * первый кроссворд, ветка перестаёт срабатывать.
 */
function cardOf(id: string): PuzzleCard | undefined {
  const card = puzzles.find((puzzle) => puzzle.id === id)
  if (card !== undefined) return card
  if (puzzles.length > 0 || id !== DEV_ID) return undefined
  return {
    id: DEV_ID,
    topicId: 'dev',
    title: 'Отладочный кроссворд 9×9',
    difficulty: 'easy',
    rows: 9,
    cols: 9,
    entries: 16,
  }
}
