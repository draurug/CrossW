import { describe, expect, it } from 'vitest'

import { parseGrid, type GridEntry, type ParsedGrid } from './grid'

/**
 * Фикстура 7×7. Буквы на пересечениях сверены руками:
 *
 * ```
 *   К О Ш К А # #
 *   О # # # Р # #
 *   Т # М А К Е Т
 *   Ё # # # А # #
 *   Л У Н А # # #
 *   # # О # # # #
 *   М А С К А # #
 * ```
 *
 * По горизонтали: КОШКА, МАКЕТ, ЛУНА, МАСКА.
 * По вертикали:   КОТЁЛ, АРКА, НОС.
 */
const GRID_7X7 = [
  'КОШКА##',
  'О###Р##',
  'Т#МАКЕТ',
  'Ё###А##',
  'ЛУНА###',
  '##О####',
  'МАСКА##',
]

/** Индекс клетки в плоском массиве. */
const flat = (row: number, col: number, cols = 7): number => row * cols + col

/** Находит слово по ключу; падает с понятным сообщением, если его нет. */
function entryByKey(parsed: ParsedGrid, key: string): GridEntry {
  const found = parsed.entries.find((e) => e.key === key)
  if (!found) throw new Error(`В разборе нет слова с ключом ${key}`)
  return found
}

describe('parseGrid: размеры и клетки', () => {
  it('определяет размеры сетки', () => {
    const parsed = parseGrid(GRID_7X7)
    expect(parsed.rows).toBe(7)
    expect(parsed.cols).toBe(7)
    expect(parsed.cells).toHaveLength(49)
  })

  it('помечает блоки как -1, а буквенные клетки собирает по порядку чтения', () => {
    const parsed = parseGrid(GRID_7X7)

    expect(parsed.cells[flat(0, 5)]).toBe(-1)
    expect(parsed.cells[flat(1, 1)]).toBe(-1)

    // 25 буквенных клеток: 5 + 2 + 6 + 2 + 4 + 1 + 5
    expect(parsed.letterCells).toHaveLength(25)
    expect(parsed.letterCells[0]).toBe(flat(0, 0))
    expect(parsed.letterCells[5]).toBe(flat(1, 0))
    // Порядок строго возрастающий — это и есть «порядок чтения».
    const sorted = [...parsed.letterCells].sort((a, b) => a - b)
    expect(parsed.letterCells).toEqual(sorted)
  })
})

describe('parseGrid: нумерация', () => {
  it('находит все слова длиной ≥ 2 и сортирует их по номеру, H перед V', () => {
    const parsed = parseGrid(GRID_7X7)

    expect(parsed.entries.map((e) => `${e.key}=${e.answer}`)).toEqual([
      '1A=КОШКА',
      '1D=КОТЁЛ',
      '2D=АРКА',
      '3A=МАКЕТ',
      '4A=ЛУНА',
      '5D=НОС',
      '6A=МАСКА',
    ])
  })

  it('клетка, начинающая и горизонтальное, и вертикальное слово, получает ОДИН номер', () => {
    const parsed = parseGrid(GRID_7X7)

    const across = entryByKey(parsed, '1A')
    const down = entryByKey(parsed, '1D')
    expect(across.id).toBe(1)
    expect(down.id).toBe(1)
    expect(across.cells[0]).toBe(flat(0, 0))
    expect(down.cells[0]).toBe(flat(0, 0))
    expect(parsed.cells[flat(0, 0)]).toBe(1)

    // Никакая другая клетка номер 1 не носит.
    expect(parsed.cells.filter((v) => v === 1)).toHaveLength(1)
  })

  it('нумерует клетки по порядку чтения и не пропускает номеров', () => {
    const parsed = parseGrid(GRID_7X7)

    const numbered = parsed.cells.filter((v) => v > 0)
    expect(numbered).toEqual([1, 2, 3, 4, 5, 6])
    expect(parsed.cells[flat(0, 4)]).toBe(2) // начало АРКА
    expect(parsed.cells[flat(2, 2)]).toBe(3) // начало МАКЕТ
    expect(parsed.cells[flat(4, 0)]).toBe(4) // начало ЛУНА
    expect(parsed.cells[flat(4, 2)]).toBe(5) // начало НОС
    expect(parsed.cells[flat(6, 0)]).toBe(6) // начало МАСКА
  })

  it('буквенная клетка внутри слова номера не получает', () => {
    const parsed = parseGrid(GRID_7X7)
    expect(parsed.cells[flat(0, 1)]).toBe(0) // О внутри КОШКА
    expect(parsed.cells[flat(2, 0)]).toBe(0) // Т внутри КОТЁЛ, по горизонтали слова нет
    expect(parsed.cells[flat(5, 2)]).toBe(0) // О внутри НОС
  })

  it('одиночная буквенная клетка вне слов номера не получает, но остаётся клеткой', () => {
    // Я в последней строке зажата блоками со всех сторон.
    const parsed = parseGrid(['КОТ', '###', '#Я#'])

    expect(parsed.entries).toHaveLength(1)
    expect(parsed.entries[0]?.key).toBe('1A')
    expect(parsed.entries[0]?.answer).toBe('КОТ')

    const isolated = flat(2, 1, 3)
    expect(parsed.cells[isolated]).toBe(0)
    expect(parsed.letterCells).toContain(isolated)
    // Ни одно слово эту клетку не покрывает.
    expect(parsed.entries.some((e) => e.cells.includes(isolated))).toBe(false)
  })

  it('слово длиной 1 не считается словом ни по горизонтали, ни по вертикали', () => {
    // Столбец из одной буквы рядом с горизонтальным словом.
    const parsed = parseGrid(['ДОМ', '#А#', '##Ж'])

    expect(parsed.entries.map((e) => e.key)).toEqual(['1A', '2D'])
    // 2D — это ОА (О из ДОМ, А под ней), а Ж одиночная.
    expect(entryByKey(parsed, '2D').answer).toBe('ОА')
    expect(parsed.cells[flat(2, 2, 3)]).toBe(0)
  })
})

describe('parseGrid: пересечения', () => {
  it('клетка пересечения входит в оба слова под одним и тем же плоским индексом', () => {
    const parsed = parseGrid(GRID_7X7)

    const crossings: [string, number, string, number, number][] = [
      // ключ H, позиция в H, ключ V, позиция в V, ожидаемый плоский индекс
      ['1A', 0, '1D', 0, flat(0, 0)],
      ['1A', 4, '2D', 0, flat(0, 4)],
      ['3A', 2, '2D', 2, flat(2, 4)],
      ['4A', 2, '5D', 0, flat(4, 2)],
      ['6A', 2, '5D', 2, flat(6, 2)],
    ]

    for (const [hKey, hPos, vKey, vPos, index] of crossings) {
      const h = entryByKey(parsed, hKey)
      const v = entryByKey(parsed, vKey)
      expect(h.cells[hPos]).toBe(index)
      expect(v.cells[vPos]).toBe(index)
      // Общая клетка ⇒ общая буква: расхождение между словами невозможно.
      expect(h.answer[hPos]).toBe(v.answer[vPos])
    }
  })

  it('каждая клетка каждого слова лежит внутри сетки и является буквенной', () => {
    const parsed = parseGrid(GRID_7X7)
    const letters = new Set(parsed.letterCells)

    for (const entry of parsed.entries) {
      expect(entry.cells.length).toBe(entry.answer.length)
      expect(entry.cells.length).toBeGreaterThanOrEqual(2)
      for (const index of entry.cells) {
        expect(letters.has(index)).toBe(true)
      }
    }
  })
})

describe('parseGrid: ошибки', () => {
  it('строки разной длины дают понятную ошибку', () => {
    expect(() => parseGrid(['КОТ', 'ОК'])).toThrow(/разной длины/)
  })

  it('пустая сетка даёт ошибку', () => {
    expect(() => parseGrid([])).toThrow(/[Пп]устая сетка/)
    expect(() => parseGrid([''])).toThrow(/[Пп]устая сетка/)
  })
})
