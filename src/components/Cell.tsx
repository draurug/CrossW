'use client'

/**
 * Одна клетка сетки. Ровно рендер: буква, номер в углу, фон по состоянию.
 *
 * Ничего не вычисляет: какого вида клетка и что читать скринридеру, решено выше
 * (`CrosswordGrid` спрашивает у движка). Обёрнута в `React.memo`, потому что
 * в сетке 13×13 сто шестьдесят девять клеток, а меняется на нажатие одна.
 */

import { memo } from 'react'

/**
 * Вид клетки в порядке приоритета: под кареткой → помечена неверной → открыта
 * подсказкой → подтверждена проверкой → входит в активное слово → обычная.
 *
 * Подсказка выше подтверждения не случайно: открытая буква верна по построению,
 * и если её красить зелёным вместе с проверенными, игрок перестанет видеть, где
 * он справился сам, а где ему подсказали.
 */
export type CellKind = 'block' | 'active' | 'wrong' | 'hint' | 'correct' | 'word' | 'plain'

const BACKGROUND: Record<CellKind, string> = {
  block: 'bg-cell-block',
  active: 'bg-cell-active',
  wrong: 'bg-cell-wrong',
  hint: 'bg-cell-hint',
  correct: 'bg-cell-correct',
  word: 'bg-cell-word',
  plain: 'bg-cell-bg',
}

export interface CellProps {
  /** Плоский индекс клетки: он же аргумент обработчика. */
  index: number
  kind: CellKind
  /** Номер клетки-начала слова. Ноль — номера нет. */
  number: number
  /** Введённая буква или пустая строка. */
  letter: string
  /** Готовый `aria-label` из движка. */
  label: string
  onSelect: (index: number) => void
}

function CellView({ index, kind, number, letter, label, onSelect }: CellProps) {
  // Блок — просто пустое место, а не чёрный квадрат. Сетки из тематического
  // пака разреженные, блоков в них больше, чем букв: залитые тёмным, они
  // превращали кроссворд в чёрную плиту с редкими окошками.
  if (kind === 'block') {
    return <div aria-hidden className="h-10 w-10" />
  }

  return (
    <button
      type="button"
      // Каретку по сетке водит клавиатура через скрытый input, поэтому клетки
      // из порядка обхода Tab убраны: Tab здесь переключает слова, а не клетки.
      tabIndex={-1}
      aria-label={label}
      onMouseDown={(event) => event.preventDefault()} // фокус остаётся на input
      onClick={() => onSelect(index)}
      className={`relative h-10 w-10 select-none rounded-sm border border-cell-line text-xl font-semibold uppercase leading-10 ${BACKGROUND[kind]}`}
    >
      {number > 0 && (
        <span className="absolute left-[3px] top-0 text-[10px] font-normal leading-tight opacity-70">
          {number}
        </span>
      )}
      {letter}
    </button>
  )
}

export const Cell = memo(CellView)
