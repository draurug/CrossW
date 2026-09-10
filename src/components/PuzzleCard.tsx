import Link from 'next/link'
import type { PuzzleCard as PuzzleCardData } from '@/generated/catalog'
import { ru } from '@/i18n/ru'

/**
 * Карточка кроссворда внутри темы.
 *
 * Тип из каталога называется так же, как компонент, поэтому импортируется под
 * псевдонимом: одно имя — один смысл.
 */
export function PuzzleCard({ puzzle }: { puzzle: PuzzleCardData }) {
  return (
    <li>
      <Link
        href={`/krossvord/${puzzle.id}/`}
        className="flex items-baseline justify-between gap-6 border p-5 transition-colors hover:border-current"
        style={{ borderColor: 'var(--cell-line)' }}
      >
        <span className="font-medium" style={{ color: 'var(--accent)' }}>
          {puzzle.title}
        </span>
        <span className="shrink-0 text-sm tabular-nums" style={{ color: 'var(--muted)' }}>
          {ru.difficulty[puzzle.difficulty]} · {ru.gridSize(puzzle.rows, puzzle.cols)} ·{' '}
          {ru.wordCount(puzzle.entries)}
        </span>
      </Link>
    </li>
  )
}
