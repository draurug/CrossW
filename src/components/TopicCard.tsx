import Link from 'next/link'
import type { Topic } from '@/core/model'
import { ru } from '@/i18n/ru'

/**
 * Карточка темы на главной. Число кроссвордов приходит снаружи: компонент
 * ничего не считает и в каталог не ходит — это забота страницы.
 */
export function TopicCard({ topic, puzzleCount }: { topic: Topic; puzzleCount: number }) {
  return (
    <li className="h-full">
      <Link
        href={`/tema/${topic.slug}/`}
        className="flex h-full flex-col rounded border p-6 transition-colors hover:border-current"
        style={{ borderColor: 'var(--cell-line)' }}
      >
        <h3 className="text-xl font-semibold tracking-tight" style={{ color: 'var(--accent)' }}>
          {topic.title}
        </h3>
        <p className="mt-2 leading-relaxed" style={{ color: 'var(--muted)' }}>
          {topic.description}
        </p>
        {/* Счётчик прижат к низу карточки: описания разной длины, а строки
            должны выстроиться в ряд. */}
        <p className="mt-4 pt-2 text-sm" style={{ color: 'var(--muted)', marginTop: 'auto' }}>
          {ru.puzzleCount(puzzleCount)}
        </p>
      </Link>
    </li>
  )
}
