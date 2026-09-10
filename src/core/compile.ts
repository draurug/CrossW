/**
 * Компиляция кроссворда: source → то, что уезжает в браузер.
 *
 * Смысл всего файла в одной строчке: `CompiledPuzzle` не содержит ни одной буквы
 * ответа. Ответы уходят отдельным зашифрованным файлом `<id>.sol`, а сетка,
 * номера и определения — открытым JSON.
 *
 * Чистый TypeScript: файлы пишет `tools/build-content.ts`, здесь только функции.
 */

import type { CompiledEntry, CompiledPuzzle, EncodedSolution, PuzzleSource } from './model'
import { parseGrid, type ParsedGrid } from './grid'
import { encodeSolution, solutionHash } from './solution'

export interface CompileResult {
  /** Уедет в `public/p/<id>.json`. Ответов внутри нет. */
  puzzle: CompiledPuzzle
  /** Уедет в `public/p/<id>.sol`. */
  encodedSolution: EncodedSolution
  /** Разбор сетки — пригодится валидатору, чтобы не парсить второй раз. */
  parsed: ParsedGrid
}

/** Заглавные буквы, Ё → Е. Русская традиция кроссвордов. */
export function normalizeAnswer(word: string): string {
  return word.toUpperCase().replace(/Ё/g, 'Е')
}

/**
 * Собирает из источника то, что получит плеер.
 *
 * @throws если сетка битая (см. `parseGrid`) или у какого-то слова нет определения.
 */
export function compile(source: PuzzleSource): CompileResult {
  const parsed = parseGrid(source.grid)

  // Строки сетки одинаковой длины (это уже проверил parseGrid), поэтому
  // склейка даёт плоскую строку, где индекс символа равен `row * cols + col`.
  const flat = source.grid.join('')

  let letters = ''
  for (const index of parsed.letterCells) {
    const ch = flat[index]
    if (ch === undefined) {
      throw new Error(`Кроссворд «${source.id}»: клетка ${index} вне сетки.`)
    }
    letters += ch
  }
  letters = normalizeAnswer(letters)

  const entries: CompiledEntry[] = parsed.entries.map((entry) => {
    const clue = source.clues[entry.key]
    if (clue === undefined || clue.trim() === '') {
      throw new Error(
        `Кроссворд «${source.id}»: нет определения для слова ${entry.key} ` +
          `(ответ «${normalizeAnswer(entry.answer)}»).`,
      )
    }
    const category = source.categories?.[entry.key]
    const quote = source.quotes?.[entry.key]
    return {
      number: entry.id,
      dir: entry.dir,
      // Копия: скомпилированный кроссворд не должен делить массивы с parsed.
      cells: [...entry.cells],
      clue,
      ...(category ? { category } : {}),
      ...(quote ? { quote } : {}),
    }
  })

  const puzzle: CompiledPuzzle = {
    meta: {
      id: source.id,
      lang: source.lang,
      topicId: source.topicId,
      title: source.title,
      difficulty: source.difficulty,
      rows: parsed.rows,
      cols: parsed.cols,
    },
    cells: [...parsed.cells],
    entries,
    solutionHash: solutionHash(letters),
  }

  return {
    puzzle,
    encodedSolution: encodeSolution(source.id, letters),
    parsed,
  }
}
