'use client'

/**
 * Сетка кроссворда.
 *
 * Вёрстка намеренно фиксированная: клетка 40 пикселей, ширина считается от числа
 * колонок и не подстраивается под экран. Мобильной версии в продукте нет (spec §2),
 * а «резиновая» сетка на десктопе только мешает попадать мышью.
 *
 * Клавиатуру ловит скрытый input: он держит фокус, а клетки и определения
 * гасят `mousedown`, чтобы клик мышью фокус не уводил. Так кроссворд решается
 * с клавиатуры целиком, даже если по нему кликали (spec §5.1).
 */

import { cellLabel, type PlayState, type PuzzleIndex } from '@/engine/engine'
import { ru } from '@/i18n/ru'
import { Cell, type CellKind } from './Cell'

/** Сторона клетки в пикселях. Совпадает с `h-10 w-10` в `Cell`. */
const CELL_PX = 40

export interface CrosswordGridProps {
  ix: PuzzleIndex
  state: PlayState
  /** Клетка под кареткой. */
  cursor: number | null
  /** Клетки активного слова. */
  wordCells: ReadonlySet<number>
  inputRef: React.RefObject<HTMLInputElement | null>
  focusInput: () => void
  onKeyDown: (event: React.KeyboardEvent) => void
  onCellClick: (cell: number) => void
}

export function CrosswordGrid({
  ix,
  state,
  cursor,
  wordCells,
  inputRef,
  focusInput,
  onKeyDown,
  onCellClick,
}: CrosswordGridProps) {
  const cells = []
  for (let index = 0; index < ix.rows * ix.cols; index++) {
    const value = ix.puzzle.cells[index] ?? -1
    cells.push(
      <Cell
        key={index}
        index={index}
        kind={kindOf(value, index, state, cursor, wordCells)}
        number={value > 0 ? value : 0}
        letter={state.letters[index] ?? ''}
        label={cellLabel(ix, state, index)}
        onSelect={onCellClick}
      />,
    )
  }

  return (
    <div className="relative" onClick={focusInput}>
      {/*
        Ввод идёт сюда. Поле пустое и только для чтения: буквы кладёт движок по
        событию, а не браузер по значению — поэтому автодополнению и автозамене
        нечего показать.
      */}
      <input
        ref={inputRef}
        value=""
        readOnly
        aria-label={ru.inputLabel}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        onKeyDown={onKeyDown}
        className="absolute left-0 top-0 h-px w-px opacity-0"
      />
      <div
        // Ни рамки, ни заливки у самой сетки: каждая клетка сама себе плитка,
        // а незанятые места остаются фоном страницы.
        className="grid w-fit gap-px"
        style={{ gridTemplateColumns: `repeat(${ix.cols}, ${CELL_PX}px)` }}
      >
        {cells}
      </div>
    </div>
  )
}

/** Вид клетки по приоритету состояний. Никаких вычислений — только чтение. */
function kindOf(
  value: number,
  index: number,
  state: PlayState,
  cursor: number | null,
  wordCells: ReadonlySet<number>,
): CellKind {
  if (value < 0) return 'block'
  if (index === cursor) return 'active'
  if (state.wrong.has(index)) return 'wrong'
  if (state.revealed.has(index)) return 'hint'
  if (wordCells.has(index)) return 'word'
  return 'plain'
}
