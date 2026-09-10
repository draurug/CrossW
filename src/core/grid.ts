/**
 * Разбор сетки кроссворда в список слов.
 *
 * Единственный источник правды о геометрии: и компилятор, и валидатор, и
 * генератор нумеруют клетки только здесь, чтобы номера нигде не разъехались.
 *
 * Чистый TypeScript: ни React, ни DOM, ни файловой системы.
 */

import { BLOCK, type Dir, type EntryKey } from './model'

/** Слово, найденное в сетке. */
export interface GridEntry {
  /** Сквозной номер клетки-начала, тот же что показывается в сетке. */
  id: number
  dir: Dir
  /** Плоские индексы клеток по порядку чтения: `row * cols + col`. */
  cells: number[]
  /** Буквы из сетки как есть, без нормализации. В compiled-формат не попадает. */
  answer: string
  /** Ключ определения в `PuzzleSource.clues`: «12A» или «3D». */
  key: EntryKey
}

export interface ParsedGrid {
  rows: number
  cols: number
  /** Плоский массив: `-1` блок, `0` буквенная клетка без номера, `> 0` номер клетки. */
  cells: number[]
  entries: GridEntry[]
  /** Плоские индексы всех буквенных клеток по порядку чтения. */
  letterCells: number[]
}

/**
 * Считается ли символ буквенной клеткой.
 *
 * Блок — это `#`. Пробельные символы блоком тоже считаются: они появляются
 * в сетке только по недосмотру, и трактовать их как букву было бы хуже.
 */
function isLetterChar(ch: string): boolean {
  return ch !== BLOCK && ch.trim() !== ''
}

/**
 * Разбирает сетку из строк в слова с классической сквозной нумерацией.
 *
 * Клетка начинает слово по горизонтали, если слева от неё блок или край сетки
 * И справа есть буквенная клетка; по вертикали — симметрично. Клетка, начинающая
 * хотя бы одно слово, получает следующий номер; нумерация общая для обоих
 * направлений. Слова длиной 1 словами не считаются и номеров не порождают.
 *
 * @throws если сетка пуста или строки разной длины.
 */
export function parseGrid(grid: string[]): ParsedGrid {
  const rows = grid.length
  if (rows === 0) {
    throw new Error('Пустая сетка: не передано ни одной строки.')
  }

  const firstRow = grid[0]
  if (firstRow === undefined) {
    throw new Error('Пустая сетка: первая строка отсутствует.')
  }
  const cols = firstRow.length
  if (cols === 0) {
    throw new Error('Пустая сетка: в первой строке нет ни одной клетки.')
  }

  for (let r = 0; r < rows; r++) {
    const row = grid[r]
    if (row === undefined) {
      throw new Error(`Строка ${r + 1} сетки отсутствует.`)
    }
    if (row.length !== cols) {
      throw new Error(
        `Строки сетки разной длины: строка 1 — ${cols} клеток, строка ${r + 1} — ${row.length}.`,
      )
    }
  }

  // Плоская карта «клетка буквенная» — дальше работаем только с ней.
  const letter: boolean[] = new Array(rows * cols).fill(false)
  const chars: string[] = new Array(rows * cols).fill(BLOCK)
  for (let r = 0; r < rows; r++) {
    const row = grid[r] as string
    for (let c = 0; c < cols; c++) {
      const ch = row[c] as string
      const index = r * cols + c
      chars[index] = ch
      letter[index] = isLetterChar(ch)
    }
  }

  const at = (r: number, c: number): boolean => {
    if (r < 0 || r >= rows || c < 0 || c >= cols) return false
    return letter[r * cols + c] === true
  }

  const cells: number[] = new Array(rows * cols).fill(0)
  const letterCells: number[] = []
  const entries: GridEntry[] = []
  let nextNumber = 1

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const index = r * cols + c

      if (!at(r, c)) {
        cells[index] = -1
        continue
      }
      letterCells.push(index)

      const startsH = !at(r, c - 1) && at(r, c + 1)
      const startsV = !at(r - 1, c) && at(r + 1, c)
      if (!startsH && !startsV) continue

      // Один номер на клетку, даже если она начинает сразу оба слова.
      const id = nextNumber++
      cells[index] = id

      // Порядок внутри одного номера: сначала горизонталь, потом вертикаль.
      if (startsH) {
        const wordCells: number[] = []
        let answer = ''
        for (let cc = c; at(r, cc); cc++) {
          const i = r * cols + cc
          wordCells.push(i)
          answer += chars[i] as string
        }
        entries.push({ id, dir: 'H', cells: wordCells, answer, key: `${id}A` })
      }
      if (startsV) {
        const wordCells: number[] = []
        let answer = ''
        for (let rr = r; at(rr, c); rr++) {
          const i = rr * cols + c
          wordCells.push(i)
          answer += chars[i] as string
        }
        entries.push({ id, dir: 'V', cells: wordCells, answer, key: `${id}D` })
      }
    }
  }

  return { rows, cols, cells, entries, letterCells }
}
