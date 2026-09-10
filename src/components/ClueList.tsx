'use client'

/**
 * Определения: «По горизонтали» и «По вертикали».
 *
 * `dir` берётся у индекса только ради этого деления — для логики он движку не
 * нужен (docs/architecture.md §4). Номер в списке тот же, что нарисован в клетке:
 * это `IndexEntry.number`, а не идентификатор слова.
 */

import { useEffect, useRef } from 'react'
import type { Dir } from '@/core/model'
import type { IndexEntry, PuzzleIndex } from '@/engine/engine'
import { ru } from '@/i18n/ru'

export interface ClueListProps {
  ix: PuzzleIndex
  /** `IndexEntry.id` активного слова. */
  activeEntryId: number
  /** Слова, заполненные целиком: показываем приглушённо. */
  filledEntries: ReadonlySet<number>
  /** Слова, у которых игрок открыл категорию. */
  revealedCategories: ReadonlySet<number>
  onSelect: (entryId: number) => void
}

export function ClueList({
  ix,
  activeEntryId,
  filledEntries,
  revealedCategories,
  onSelect,
}: ClueListProps) {
  const items = useRef(new Map<number, HTMLLIElement>())

  // Каретка ушла в слово за пределами видимости — подтягиваем список к ней.
  // `nearest` обязателен: любой другой режим дёргает всю страницу.
  useEffect(() => {
    items.current.get(activeEntryId)?.scrollIntoView({ block: 'nearest' })
  }, [activeEntryId])

  const column = (dir: Dir, title: string) => (
    <section>
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--muted)' }}>
        {title}
      </h2>
      <ul className="space-y-px">
        {ix.order
          .filter((entry) => entry.dir === dir)
          .map((entry) => (
            <ClueItem
              key={entry.id}
              entry={entry}
              active={entry.id === activeEntryId}
              filled={filledEntries.has(entry.id)}
              showCategory={revealedCategories.has(entry.id)}
              onSelect={onSelect}
              register={(node) => {
                if (node === null) items.current.delete(entry.id)
                else items.current.set(entry.id, node)
              }}
            />
          ))}
      </ul>
    </section>
  )

  return (
    <div className="grid grid-cols-2 gap-8">
      {column('H', ru.across)}
      {column('V', ru.down)}
    </div>
  )
}

interface ClueItemProps {
  entry: IndexEntry
  active: boolean
  filled: boolean
  /** Игрок попросил категорию этого слова. */
  showCategory: boolean
  onSelect: (entryId: number) => void
  register: (node: HTMLLIElement | null) => void
}

function ClueItem({ entry, active, filled, showCategory, onSelect, register }: ClueItemProps) {
  return (
    <li ref={register}>
      <button
        type="button"
        tabIndex={-1}
        aria-current={active}
        onMouseDown={(event) => event.preventDefault()} // фокус остаётся на поле ввода
        onClick={() => onSelect(entry.id)}
        className={`flex w-full gap-2 rounded px-2 py-1 text-left text-sm leading-snug ${
          active ? 'bg-cell-word font-medium' : ''
        }`}
        style={filled && !active ? { color: 'var(--muted)' } : undefined}
      >
        <span className="w-6 shrink-0 text-right tabular-nums font-semibold">{entry.number}</span>
        <span>
          {entry.clue}
          {showCategory && (
            <em className="ml-1 not-italic" style={{ color: 'var(--muted)' }}>
              — {entry.category ?? ru.categoryUnknown}
            </em>
          )}
        </span>
      </button>
    </li>
  )
}
