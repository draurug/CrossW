'use client'

/**
 * Кроссворд наугад: выбрать сложность и открыть случайный из подходящих.
 *
 * Выбор делается по клику, а не при отрисовке. На сервере и на клиенте
 * `Math.random()` дал бы разные значения, и React ругался бы на расхождение
 * разметки; к тому же сайт статический, и «случайный» на сборке означал бы
 * один и тот же кроссворд до следующего деплоя.
 */

import { useRouter } from 'next/navigation'
import { useRef, useState } from 'react'
import type { Difficulty } from '@/core/model'
import { puzzles } from '@/generated/catalog'
import { ru } from '@/i18n/ru'

type Level = Difficulty | 'any'

const LEVELS: Level[] = ['any', 'easy', 'medium', 'hard']

const label = (level: Level): string =>
  level === 'any' ? ru.randomAnyLevel : ru.difficulty[level]

export function RandomPuzzle() {
  const router = useRouter()
  const [level, setLevel] = useState<Level>('any')
  const [empty, setEmpty] = useState(false)
  // Что выпало в прошлый раз. Кроссвордов на уровень немного, и без этого
  // «наугад» дважды подряд слишком часто открывает то же самое.
  const last = useRef<string | null>(null)

  const open = (): void => {
    const matching = level === 'any' ? puzzles : puzzles.filter((p) => p.difficulty === level)
    if (matching.length === 0) {
      setEmpty(true)
      return
    }
    const pool =
      matching.length > 1 ? matching.filter((p) => p.id !== last.current) : matching
    const pick = pool[Math.floor(Math.random() * pool.length)]
    if (!pick) return
    last.current = pick.id
    router.push(`/crossword/${pick.id}/`)
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <select
        value={level}
        onChange={(event) => {
          setLevel(event.target.value as Level)
          setEmpty(false)
        }}
        aria-label={ru.randomAnyLevel}
        className="rounded border border-cell-line bg-transparent px-3 py-2 text-sm"
      >
        {LEVELS.map((value) => (
          <option key={value} value={value}>
            {label(value)}
          </option>
        ))}
      </select>

      <button
        type="button"
        onClick={open}
        className="rounded border border-cell-line px-4 py-2 text-sm font-medium hover:bg-cell-word"
      >
        {ru.randomButton}
      </button>

      {empty && (
        <span className="text-sm" style={{ color: 'var(--muted)' }}>
          {ru.randomEmpty}
        </span>
      )}
    </div>
  )
}
