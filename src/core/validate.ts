/**
 * Правила контента.
 *
 * Валидатор ловит то, что глазами не видно: кроссворд с опечаткой в ответе
 * нерешаем, а в JSON на 60 слов это не заметно. Правил намеренно немного —
 * каждое отвечает на вопрос «из-за чего кроссворд окажется испорченным».
 *
 * Чистые функции. Чтение файлов — в `tools/validate.ts`.
 */

import { normalizeAnswer } from './compile'
import { parseGrid, type ParsedGrid } from './grid'
import type { Pack, PuzzleSource } from './model'

export type Severity = 'error' | 'warn'

export interface Issue {
  severity: Severity
  /** Где: id кроссворда или пака, при возможности с ключом слова. */
  where: string
  message: string
}

/** Метрики кроссворда. Показываются на dev-странице ревью. */
export interface PuzzleStats {
  entries: number
  letterCells: number
  /** Доля слов, у которых определение тематическое. Целимся в 0.6–0.8. */
  topicShare: number
  /** Доля буквенных клеток, входящих в два слова. Ниже 0.5 сетка рыхлая. */
  crossShare: number
  minWordLength: number
  maxWordLength: number
}

/**
 * Максимальная длина определения.
 *
 * Калибруется по вёрстке: список определений справа шириной около 320 пикселей
 * держит две строки, то есть примерно 55 символов. Прежние 40 были поставлены
 * на глаз и мешали писать определения с категорией — «Предмет одежды, в котором
 * Иван явился» в них не влезало.
 */
export const MAX_CLUE_LENGTH = 55

/** Слова короче трёх букв в кроссвордах не используются. */
export const MIN_WORD_LENGTH = 3

/** Минимальная доля тематических подсказок в кроссворде. spec §5.8. */
export const MIN_TOPIC_SHARE = 0.6

/** Категория — два-три слова: «предмет одежды», а не пересказ определения. */
export const MAX_CATEGORY_LENGTH = 30

/**
 * Однокоренное ли определение с ответом.
 *
 * Стеммер тут не нужен: достаточно проверить, не встречается ли в определении
 * начало ответа. МАСТЕР → «мастерская» ловится, МАСЛО → «Что разлила Аннушка»
 * проходит. Порог в 4 буквы — чтобы КОТ не ловился на «который».
 */
export function isCognate(answer: string, clue: string): boolean {
  const stem = normalizeAnswer(answer).slice(0, Math.max(4, answer.length - 2))
  if (stem.length < 4) return false
  return normalizeAnswer(clue).includes(stem)
}

/** Связны ли буквенные клетки: из любой можно дойти до любой по словам. */
function isConnected(parsed: ParsedGrid): boolean {
  const { letterCells, cols } = parsed
  if (letterCells.length === 0) return true
  const letters = new Set(letterCells)
  const seen = new Set<number>([letterCells[0] as number])
  const queue = [letterCells[0] as number]
  while (queue.length > 0) {
    const cell = queue.pop() as number
    const row = Math.floor(cell / cols)
    const col = cell % cols
    const neighbours = [
      col > 0 ? cell - 1 : -1,
      col < cols - 1 ? cell + 1 : -1,
      row > 0 ? cell - cols : -1,
      cell + cols,
    ]
    for (const next of neighbours) {
      if (next < 0 || !letters.has(next) || seen.has(next)) continue
      seen.add(next)
      queue.push(next)
    }
  }
  return seen.size === letterCells.length
}

/** Проверка одного кроссворда. Пустой массив — кроссворд годен к публикации. */
export function validatePuzzle(source: PuzzleSource): { issues: Issue[]; stats: PuzzleStats | null } {
  const issues: Issue[] = []
  const at = (key?: string) => (key ? `${source.id} ${key}` : source.id)

  let parsed: ParsedGrid
  try {
    parsed = parseGrid(source.grid)
  } catch (error) {
    issues.push({ severity: 'error', where: at(), message: (error as Error).message })
    return { issues, stats: null }
  }

  if (parsed.entries.length === 0) {
    issues.push({ severity: 'error', where: at(), message: 'В сетке нет ни одного слова' })
    return { issues, stats: null }
  }

  // Каждая буквенная клетка должна входить хотя бы в одно слово: иначе её
  // невозможно заполнить, потому что к ней не привязано ни одно определение.
  const covered = new Set(parsed.entries.flatMap((entry) => entry.cells))
  for (const cell of parsed.letterCells) {
    if (!covered.has(cell)) {
      const row = Math.floor(cell / parsed.cols) + 1
      const col = (cell % parsed.cols) + 1
      issues.push({
        severity: 'error',
        where: at(),
        message: `Клетка ${row}:${col} не входит ни в одно слово — её нечем разгадать`,
      })
    }
  }

  if (!isConnected(parsed)) {
    issues.push({
      severity: 'error',
      where: at(),
      message: 'Сетка распадается на несвязанные куски',
    })
  }

  const seenAnswers = new Map<string, string>()
  let topicClues = 0

  for (const entry of parsed.entries) {
    const answer = normalizeAnswer(entry.answer)
    const clue = source.clues[entry.key]

    if (answer.length < MIN_WORD_LENGTH) {
      issues.push({
        severity: 'error',
        where: at(entry.key),
        message: `Слово ${answer} короче ${MIN_WORD_LENGTH} букв`,
      })
    }

    const duplicate = seenAnswers.get(answer)
    if (duplicate) {
      issues.push({
        severity: 'error',
        where: at(entry.key),
        message: `Ответ ${answer} уже есть в этом кроссворде (${duplicate})`,
      })
    } else {
      seenAnswers.set(answer, entry.key)
    }

    if (!clue || clue.trim() === '') {
      issues.push({
        severity: 'error',
        where: at(entry.key),
        message: `Нет определения к ответу ${answer}`,
      })
      continue
    }

    if (clue.length > MAX_CLUE_LENGTH) {
      issues.push({
        severity: 'warn',
        where: at(entry.key),
        message: `Определение длиннее ${MAX_CLUE_LENGTH} символов (${clue.length}): «${clue}»`,
      })
    }

    if (isCognate(answer, clue)) {
      issues.push({
        severity: 'error',
        where: at(entry.key),
        message: `Определение однокоренное с ответом ${answer}: «${clue}»`,
      })
    }

    if ((source.origins?.[entry.key] ?? 'filler') !== 'filler') topicClues++
  }

  const crossing = parsed.letterCells.filter(
    (cell) => parsed.entries.filter((entry) => entry.cells.includes(cell)).length > 1,
  ).length
  const lengths = parsed.entries.map((entry) => entry.cells.length)

  const stats: PuzzleStats = {
    entries: parsed.entries.length,
    letterCells: parsed.letterCells.length,
    topicShare: topicClues / parsed.entries.length,
    crossShare: crossing / parsed.letterCells.length,
    minWordLength: Math.min(...lengths),
    maxWordLength: Math.max(...lengths),
  }

  // Порог из spec §5.8. Это не придирка к качеству, а проверка того, что кроссворд
  // вообще выполняет обещание продукта: ниже 60% тема не чувствуется, и получается
  // обычный кроссворд с названием книги в заголовке.
  if (stats.topicShare < MIN_TOPIC_SHARE) {
    issues.push({
      severity: 'error',
      where: at(),
      message:
        `Тематических определений всего ${Math.round(stats.topicShare * 100)}%` +
        ` при минимуме ${Math.round(MIN_TOPIC_SHARE * 100)}% — темы не почувствуется`,
    })
  }

  return { issues, stats }
}

/** Проверка тематического пака. */
export function validatePack(pack: Pack): Issue[] {
  const issues: Issue[] = []
  const seen = new Map<string, number>()

  pack.entries.forEach((entry, index) => {
    const where = `${pack.id} #${index + 1} ${entry.answer}`
    const answer = entry.answer

    if (answer !== normalizeAnswer(answer)) {
      issues.push({
        severity: 'error',
        where,
        message: `Ответ должен быть заглавными без Ё: ожидалось ${normalizeAnswer(answer)}`,
      })
    }

    if (answer.length < MIN_WORD_LENGTH) {
      issues.push({ severity: 'error', where, message: `Слово короче ${MIN_WORD_LENGTH} букв` })
    }

    const duplicate = seen.get(answer)
    if (duplicate !== undefined) {
      issues.push({ severity: 'error', where, message: `Дубль: ответ уже есть в записи #${duplicate + 1}` })
    } else {
      seen.set(answer, index)
    }

    if (entry.clues.length === 0) {
      issues.push({ severity: 'error', where, message: 'Нет ни одного определения' })
    }

    if (entry.category !== undefined) {
      if (entry.category.length > MAX_CATEGORY_LENGTH) {
        issues.push({
          severity: 'warn',
          where,
          message: `Категория длиннее ${MAX_CATEGORY_LENGTH} символов: «${entry.category}»`,
        })
      }
      // Категория с корнем ответа внутри — это не подсказка, а выданный ответ.
      if (isCognate(answer, entry.category)) {
        issues.push({
          severity: 'error',
          where,
          message: `Категория выдаёт ответ: «${entry.category}»`,
        })
      }
    }

    for (const clue of entry.clues) {
      if (clue.category !== undefined && isCognate(answer, clue.category)) {
        issues.push({
          severity: 'error',
          where,
          message: `Категория определения выдаёт ответ: «${clue.category}»`,
        })
      }
      if (clue.text.length > MAX_CLUE_LENGTH) {
        issues.push({
          severity: 'warn',
          where,
          message: `Определение длиннее ${MAX_CLUE_LENGTH} символов: «${clue.text}»`,
        })
      }
      if (isCognate(answer, clue.text)) {
        issues.push({ severity: 'error', where, message: `Однокоренное определение: «${clue.text}»` })
      }
      // Тематическое определение — это факт из книги. Факт без указания источника
      // невозможно проверить на ревью и нечем отличить от красивой выдумки.
      // Словарные определения источника не требуют: spec §6.8.
      if (clue.kind === 'topic' && !entry.source) {
        issues.push({ severity: 'error', where, message: 'Тематическое определение без указания источника' })
      }
    }
  })

  // Хвост коротких слов — то, из-за чего паки обычно оказываются бесполезными:
  // в сетке больше половины слотов на 3–5 букв, и заполнять их нечем.
  const short = pack.entries.filter((entry) => entry.answer.length <= 5).length
  if (short < pack.entries.length * 0.4) {
    issues.push({
      severity: 'warn',
      where: pack.id,
      message: `Коротких слов (3–5 букв) всего ${short} из ${pack.entries.length} — генератору не хватит на сетку`,
    })
  }

  return issues
}
