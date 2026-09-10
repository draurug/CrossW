import { describe, expect, it } from 'vitest'

import { compile, normalizeAnswer } from './compile'
import { decodeSolution } from './solution'
import type { PuzzleSource } from './model'

/**
 * Та же фикстура 7×7, что и в grid.test.ts:
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
 * Ответы: КОШКА, МАКЕТ, ЛУНА, МАСКА, КОТЁЛ, АРКА, НОС.
 * Определения намеренно не содержат самих ответов — на это есть отдельный тест.
 */
const ANSWERS = ['КОШКА', 'МАКЕТ', 'ЛУНА', 'МАСКА', 'КОТЕЛ', 'АРКА', 'НОС']

function makeSource(overrides: Partial<PuzzleSource> = {}): PuzzleSource {
  return {
    id: 'proba-7x7',
    lang: 'ru',
    topicId: 'obshchaya-leksika',
    title: 'Пробный кроссворд',
    difficulty: 'easy',
    grid: ['КОШКА##', 'О###Р##', 'Т#МАКЕТ', 'Ё###А##', 'ЛУНА###', '##О####', 'МАСКА##'],
    clues: {
      '1A': 'Мурлыка, гуляющая сама по себе',
      '1D': 'Ёмкость, в которой варят на большом огне',
      '2D': 'Полукруглый свод над проходом',
      '3A': 'Уменьшенная модель здания',
      '4A': 'Спутница Земли в ночном небе',
      '5D': 'Орган обоняния и передняя часть корабля',
      '6A': 'Личина на лице ряженого',
    },
    ...overrides,
  }
}

describe('normalizeAnswer', () => {
  it('приводит к заглавным и сводит Ё к Е', () => {
    expect(normalizeAnswer('ёжик')).toBe('ЕЖИК')
    expect(normalizeAnswer('Ёлка')).toBe('ЕЛКА')
    expect(normalizeAnswer('КОТЁЛ')).toBe('КОТЕЛ')
    expect(normalizeAnswer('маска')).toBe('МАСКА')
  })

  it('не трогает уже нормализованное слово', () => {
    expect(normalizeAnswer('ЕЖИК')).toBe('ЕЖИК')
  })
})

describe('compile: метаданные и сетка', () => {
  it('переносит мету и размеры сетки', () => {
    const { puzzle } = compile(makeSource())

    expect(puzzle.meta).toEqual({
      id: 'proba-7x7',
      lang: 'ru',
      topicId: 'obshchaya-leksika',
      title: 'Пробный кроссворд',
      difficulty: 'easy',
      rows: 7,
      cols: 7,
    })
    expect(puzzle.cells).toHaveLength(49)
  })

  it('раскладывает определения по словам в порядке разбора', () => {
    const source = makeSource()
    const { puzzle, parsed } = compile(source)

    expect(puzzle.entries).toHaveLength(parsed.entries.length)
    for (let i = 0; i < puzzle.entries.length; i++) {
      const compiled = puzzle.entries[i]
      const entry = parsed.entries[i]
      expect(compiled?.number).toBe(entry?.id)
      expect(compiled?.dir).toBe(entry?.dir)
      expect(compiled?.cells).toEqual(entry?.cells)
      expect(compiled?.clue).toBe(source.clues[entry?.key ?? ''])
    }
  })
})

describe('compile: решение', () => {
  it('собирает буквы всех клеток по порядку чтения, заглавными и без Ё', () => {
    const { encodedSolution, parsed } = compile(makeSource())

    const letters = decodeSolution('proba-7x7', encodedSolution)
    expect(letters).not.toBeNull()
    expect(letters).toHaveLength(parsed.letterCells.length)
    expect(letters).toBe('КОШКАОРТМАКЕТЕАЛУНАОМАСКА')
    expect(letters).not.toContain('Ё')
  })

  it('encodeSolution → decodeSolution возвращает исходную строку', () => {
    const source = makeSource()
    const { encodedSolution } = compile(source)

    const decoded = decodeSolution(source.id, encodedSolution)
    expect(decoded).toBe('КОШКАОРТМАКЕТЕАЛУНАОМАСКА')
    // Зашифрованный текст — hex, ответов в нём глазами не видно.
    expect(encodedSolution).toMatch(/^[0-9a-f]+$/)
    expect(encodedSolution).not.toContain('КОШКА')
  })

  it('расшифровка чужим id даёт не то решение', () => {
    const { encodedSolution } = compile(makeSource())
    expect(decodeSolution('drugoy-id', encodedSolution)).not.toBe('КОШКАОРТМАКЕТЕАЛУНАОМАСКА')
  })

  it('хэш решения непустой и меняется вместе с решением', () => {
    const a = compile(makeSource())
    const b = compile(
      makeSource({
        grid: ['КОШКА##', 'О###Р##', 'Т#МАКЕТ', 'Ё###А##', 'ЛУПА###', '##О####', 'МАСКА##'],
      }),
    )

    expect(a.puzzle.solutionHash).toMatch(/^[0-9a-f]{8}$/)
    expect(a.puzzle.solutionHash).not.toBe(b.puzzle.solutionHash)
  })

  it('буквы решения соответствуют клеткам слов', () => {
    const { encodedSolution, parsed } = compile(makeSource())
    const letters = decodeSolution('proba-7x7', encodedSolution) as string

    // Позиция клетки в letterCells — это позиция её буквы в строке решения.
    const positionOf = new Map(parsed.letterCells.map((cell, i) => [cell, i]))
    for (const entry of parsed.entries) {
      const fromSolution = entry.cells
        .map((cell) => letters[positionOf.get(cell) as number])
        .join('')
      expect(fromSolution).toBe(normalizeAnswer(entry.answer))
    }
  })
})

describe('compile: скомпилированный кроссворд не содержит ответов', () => {
  it('в JSON нет ни одного слова-ответа', () => {
    const { puzzle } = compile(makeSource())

    const json = normalizeAnswer(JSON.stringify(puzzle))
    for (const answer of ANSWERS) {
      expect(json).not.toContain(answer)
    }
  })

  it('в JSON нет ни строки решения, ни исходной сетки', () => {
    const source = makeSource()
    const { puzzle } = compile(source)
    const json = JSON.stringify(puzzle)

    expect(json).not.toContain('КОШКАОРТМАКЕТЕАЛУНАОМАСКА')
    for (const row of source.grid) {
      expect(json).not.toContain(row)
    }
    expect(Object.keys(puzzle)).toEqual(['meta', 'cells', 'entries', 'solutionHash'])
    for (const entry of puzzle.entries) {
      expect(Object.keys(entry)).toEqual(['number', 'dir', 'cells', 'clue'])
    }
  })
})

describe('compile: ошибки', () => {
  it('бросает ошибку с ключом и ответом, если определения нет', () => {
    const source = makeSource()
    delete source.clues['2D']

    expect(() => compile(source)).toThrow(/2D/)
    expect(() => compile(source)).toThrow(/АРКА/)
  })

  it('пустое определение считается отсутствующим', () => {
    const source = makeSource({ clues: { ...makeSource().clues, '5D': '   ' } })
    expect(() => compile(source)).toThrow(/5D/)
  })

  it('битая сетка роняет компиляцию с ошибкой разбора', () => {
    const source = makeSource({ grid: ['КОШКА##', 'О###Р'] })
    expect(() => compile(source)).toThrow(/разной длины/)
  })
})

describe('compile: результат самодостаточен', () => {
  it('возвращает разбор сетки, чтобы валидатор не парсил второй раз', () => {
    const result = compile(makeSource())
    expect(result.parsed.entries.map((e) => e.key)).toEqual([
      '1A',
      '1D',
      '2D',
      '3A',
      '4A',
      '5D',
      '6A',
    ])
  })

  it('изменение cells в скомпилированном слове не портит разбор', () => {
    const result = compile(makeSource())
    const compiled = result.puzzle.entries[0]
    if (!compiled) throw new Error('В скомпилированном кроссворде нет слов')

    compiled.cells[0] = 999
    expect(result.parsed.entries[0]?.cells[0]).toBe(0)
  })
})
