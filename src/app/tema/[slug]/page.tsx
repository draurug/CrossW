import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { PuzzleCard } from '@/components/PuzzleCard'
import type { Difficulty } from '@/core/model'
import { puzzlesOfTopic, topicBySlug, topics, type PuzzleCard as PuzzleCardData } from '@/generated/catalog'
import { ru } from '@/i18n/ru'

/**
 * Статический экспорт: список страниц известен на сборке.
 *
 * Заглушка на случай пустого каталога не прихоть: Next 15 с `output: export`
 * останавливает сборку, если динамический маршрут не дал ни одного пути
 * («Page … is missing "generateStaticParams()"», build/index.js). Один
 * синтетический слаг снимает эту проверку; страница по нему отдаёт 404, а как
 * только в `content/topics.json` появится тема, ветка перестанет срабатывать.
 */
export function generateStaticParams() {
  if (topics.length === 0) return [{ slug: 'net-tem' }]
  return topics.map((topic) => ({ slug: topic.slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const topic = topicBySlug(slug)
  if (!topic) return { title: ru.pageNotFound }
  return { title: topic.title, description: topic.description }
}

/** Порядок показа: сначала лёгкие — с них начинают знакомство с темой. */
const difficultyOrder: Record<Difficulty, number> = { easy: 0, medium: 1, hard: 2 }

function byDifficulty(a: PuzzleCardData, b: PuzzleCardData): number {
  return difficultyOrder[a.difficulty] - difficultyOrder[b.difficulty]
}

export default async function TopicPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const topic = topicBySlug(slug)
  if (!topic) notFound()

  // Сортируется копия: `puzzlesOfTopic` возвращает свежий массив, но полагаться
  // на это не стоит — модуль каталога генерируемый и может измениться.
  const puzzles = [...puzzlesOfTopic(topic.id)].sort(byDifficulty)

  return (
    <main className="mx-auto max-w-4xl px-6 py-16">
      <Link href="/" className="text-sm hover:underline" style={{ color: 'var(--accent)' }}>
        ← {ru.topics}
      </Link>

      <h1 className="mt-6 text-4xl font-bold tracking-tight">{topic.title}</h1>
      <p className="mt-4 max-w-2xl leading-relaxed" style={{ color: 'var(--muted)' }}>
        {topic.description}
      </p>

      {puzzles.length === 0 ? (
        <p className="mt-12" style={{ color: 'var(--muted)' }}>
          {ru.puzzlesEmpty}
        </p>
      ) : (
        <>
          <p className="mt-10 text-sm" style={{ color: 'var(--muted)' }}>
            {ru.puzzleCount(puzzles.length)}
          </p>
          <ul className="mt-4 space-y-3">
            {puzzles.map((puzzle) => (
              <PuzzleCard key={puzzle.id} puzzle={puzzle} />
            ))}
          </ul>
        </>
      )}
    </main>
  )
}
