'use client'

/**
 * Плеер: загрузка кроссворда в браузере и раскладка партии.
 *
 * Данные грузятся здесь, а не на сборке, ровно по одной причине: ответы не
 * должны попадать в HTML (docs/architecture.md §2.3). Страница отдаёт только id,
 * а сетка и решение приезжают двумя файлами из `public/p/`.
 *
 * Сетка и решение грузятся параллельно и независимо: как только пришёл `.json`,
 * можно вписывать буквы, даже если `.sol` ещё в пути — проверка и подсказка до
 * его приезда просто выключены.
 */

import { useEffect, useState } from 'react'
import { ClueList } from '@/components/ClueList'
import { CrosswordGrid } from '@/components/CrosswordGrid'
import { ResultPanel } from '@/components/ResultPanel'
import { Toolbar } from '@/components/Toolbar'
import type { CompiledPuzzle } from '@/core/model'
import { decodeSolution } from '@/core/solution'
import { puzzles } from '@/generated/catalog'
import { usePuzzle } from '@/hooks/usePuzzle'
import { ru } from '@/i18n/ru'

/** Отладочная фикстура движка: подменяет контент, пока кроссвордов ещё нет. */
const DEV_ID = 'dev-fixture-9x9'

export default function Player({ id }: { id: string }) {
  const [puzzle, setPuzzle] = useState<CompiledPuzzle | null>(null)
  const [solution, setSolution] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let alive = true
    const file = encodeURIComponent(id)

    void (async () => {
      try {
        const response = await fetch(`/p/${file}.json`)
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const data = (await response.json()) as CompiledPuzzle
        if (alive) setPuzzle(data)
      } catch {
        const fixture = await devFixture(id)
        if (!alive) return
        if (fixture === null) {
          setFailed(true)
          return
        }
        setPuzzle(fixture.puzzle)
        setSolution(fixture.solution)
      }
    })()

    void (async () => {
      try {
        const response = await fetch(`/p/${file}.sol`)
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const decoded = decodeSolution(id, (await response.text()).trim())
        if (alive && decoded !== null) setSolution(decoded)
      } catch {
        // Без решения кроссворд заполняется, но не проверяется. Движок это умеет.
      }
    })()

    return () => {
      alive = false
    }
  }, [id])

  if (failed) return <p className="py-8">{ru.loadFailed}</p>
  if (puzzle === null) return <p className="py-8">{ru.loading}</p>
  // key: смена кроссворда — это новая партия, а не новые пропсы старой.
  return <Board key={puzzle.meta.id} puzzle={puzzle} solution={solution} />
}

function Board({ puzzle, solution }: { puzzle: CompiledPuzzle; solution: string | null }) {
  const api = usePuzzle(puzzle, solution)
  const { focusInput } = api

  // Кроссворд рассчитан на клавиатуру: поле ввода забирает фокус сразу.
  useEffect(() => {
    focusInput()
  }, [focusInput])

  return (
    <div className="space-y-4">
      <Toolbar
        timer={api.timer}
        hints={api.state.hints}
        checks={api.state.checks}
        ready={api.ready}
        onCheck={api.onCheck}
        lastCheck={api.lastCheck}
        onHint={api.onHint}
        onClear={api.onClear}
      />

      {api.storageBlocked && (
        <p className="text-sm" style={{ color: 'var(--muted)' }}>
          {ru.progressUnavailable}
        </p>
      )}

      {api.solved && (
        <ResultPanel
          puzzle={puzzle}
          timer={api.timer}
          hints={api.state.hints}
          checks={api.state.checks}
        />
      )}

      <div className="flex items-start gap-8">
        <CrosswordGrid
          ix={api.ix}
          state={api.state}
          cursor={api.cursor}
          wordCells={api.wordCells}
          inputRef={api.inputRef}
          focusInput={api.focusInput}
          onKeyDown={api.onKeyDown}
          onCellClick={api.onCellClick}
        />
        <div className="min-w-0 flex-1">
          <ClueList
            ix={api.ix}
            activeEntryId={api.state.cursor.entryId}
            filledEntries={api.filledEntries}
            onSelect={api.onSelectEntry}
          />
        </div>
      </div>

      <p className="text-sm" style={{ color: 'var(--muted)' }}>
        {ru.keyboardHelp}
      </p>
    </div>
  )
}

/**
 * Фикстура вместо контента, пока `content/puzzles/` пуст.
 *
 * Условие то же, что в `page.tsx`: страница фикстуры существует ровно тогда,
 * когда каталог пуст. Импорт динамический — отладочный кроссворд уезжает в
 * отдельный чанк и в бандл страницы не входит; при живом каталоге чанк
 * не запрашивается никогда.
 */
async function devFixture(
  id: string,
): Promise<{ puzzle: CompiledPuzzle; solution: string | null } | null> {
  if (puzzles.length > 0 || id !== DEV_ID) return null
  const dev = await import('@/engine/devPuzzle')
  return { puzzle: dev.DEV_PUZZLE, solution: decodeSolution(id, dev.DEV_SOLUTION_ENCODED) }
}
