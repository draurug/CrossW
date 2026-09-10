/**
 * `npm run gen` — генератор кроссвордов из тематического пака.
 *
 * Слова кладутся жадно: первое — в середину, каждое следующее цепляется одной
 * буквой к уже стоящему. Блоки получаются сами из незанятых клеток. Такой
 * генератор не может не сойтись: он просто останавливается, когда больше ничего
 * не влезает.
 *
 * Корректность проверяется не рассуждением о соседствах, а разбором готовой
 * сетки: после каждой постановки все слова в сетке обязаны быть словами из пака
 * и не короче трёх букв. Одно условие закрывает и случайные двухбуквенные
 * слова, и сочетания, приклеившиеся сбоку.
 */

import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseGrid } from '../src/core/grid'
import { BLOCK, type Difficulty, type Origin, type Pack, type PuzzleSource } from '../src/core/model'
import { CONTENT_DIR, readPacks } from './content-io'

/** Детерминизм по сиду: тот же сид даёт тот же кроссворд. */
function rng(seed: number): () => number {
  let s = seed >>> 0 || 1
  return () => {
    s ^= s << 13
    s ^= s >>> 17
    s ^= s << 5
    s >>>= 0
    return s / 0x1_0000_0000
  }
}

function shuffle<T>(items: readonly T[], rand: () => number): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[out[i], out[j]] = [out[j] as T, out[i] as T]
  }
  return out
}

type Grid = string[][]

const empty = (rows: number, cols: number): Grid =>
  Array.from({ length: rows }, () => Array.from({ length: cols }, () => BLOCK))

const render = (grid: Grid): string[] => grid.map((row) => row.join(''))

/**
 * Можно ли положить слово, и если да — новая сетка.
 *
 * Проверка одна: разобрать получившуюся сетку и убедиться, что каждое слово в
 * ней есть в паке. Если постановка склеила сбоку лишнее сочетание — его не
 * окажется в паке, и вариант отвергнется.
 */
function tryPlace(
  grid: Grid,
  word: string,
  row: number,
  col: number,
  dir: 'H' | 'V',
  known: ReadonlySet<string>,
): Grid | null {
  const rows = grid.length
  const cols = (grid[0] as string[]).length
  const endRow = dir === 'V' ? row + word.length - 1 : row
  const endCol = dir === 'H' ? col + word.length - 1 : col
  if (row < 0 || col < 0 || endRow >= rows || endCol >= cols) return null

  const next = grid.map((r) => [...r])
  for (let i = 0; i < word.length; i++) {
    const r = dir === 'V' ? row + i : row
    const c = dir === 'H' ? col + i : col
    const have = (next[r] as string[])[c] as string
    if (have !== BLOCK && have !== word[i]) return null
    ;(next[r] as string[])[c] = word[i] as string
  }

  const parsed = parseGrid(render(next))
  if (parsed.entries.some((entry) => !known.has(entry.answer))) return null

  // Клетка, не входящая ни в одно слово, нерешаема: её нечем подсказать.
  const covered = new Set(parsed.entries.flatMap((entry) => entry.cells))
  if (parsed.letterCells.some((cell) => !covered.has(cell))) return null

  return next
}

/**
 * Кладёт слова, пока лезут. Возвращает готовую сетку.
 *
 * `avoid` — слова, уже ушедшие в другие кроссворды этой темы. Они не запрещены
 * (иначе на третьей сетке может не хватить материала), а отодвинуты в конец
 * очереди: сначала берётся всё свежее. Без этого три кроссворда одной темы
 * состоят наполовину из одних и тех же слов — жадная укладка каждый раз
 * начинает с самого длинного слова пака и идёт по тому же пулу.
 */
function generate(
  words: readonly string[],
  rows: number,
  cols: number,
  seed: number,
  avoid: ReadonlySet<string> = new Set(),
  topical: ReadonlySet<string> = new Set(),
): string[] {
  const rand = rng(seed)
  const known = new Set(words)

  /**
   * Порядок очереди решает, каким выйдет кроссворд. Сначала свежие слова с
   * тематическим определением — в них весь смысл продукта и порог 60% из ТЗ;
   * слова без тематического определения и уже потраченные на другие сетки темы
   * идут в конец, но не запрещены: иначе на третьей сетке не хватит материала.
   */
  const rank = (w: string): number => (avoid.has(w) ? 2 : 0) + (topical.has(w) ? 0 : 1)
  const pool = shuffle(words, rand).sort((a, b) => rank(a) - rank(b))

  // Первое слово — самое длинное из свежих, горизонтально по центру: оно задаёт
  // костяк, к которому цепляется всё остальное, и именно оно сильнее всего
  // определяет, будут ли сетки темы похожи друг на друга.
  const fits = (w: string) => w.length <= cols
  const longest = (candidates: readonly string[]) =>
    [...candidates].sort((a, b) => b.length - a.length).find(fits)
  const first = longest(pool.filter((w) => rank(w) === 0)) ?? longest(pool)
  if (!first) throw new Error('В паке нет слова, которое поместилось бы в сетку')

  let grid = empty(rows, cols)
  const startRow = Math.floor(rows / 2)
  const startCol = Math.floor((cols - first.length) / 2)
  grid = tryPlace(grid, first, startRow, startCol, 'H', known) as Grid
  const used = new Set([first])

  let placed = true
  while (placed) {
    placed = false
    for (const word of pool) {
      if (used.has(word)) continue
      const spot = findSpot(grid, word, known, rand)
      if (!spot) continue
      grid = spot
      used.add(word)
      placed = true
    }
  }

  return render(grid)
}

/** Первое место, куда слово встаёт, зацепившись буквой за уже стоящее. */
function findSpot(grid: Grid, word: string, known: ReadonlySet<string>, rand: () => number): Grid | null {
  const rows = grid.length
  const cols = (grid[0] as string[]).length

  const anchors: { r: number; c: number }[] = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if ((grid[r] as string[])[c] !== BLOCK) anchors.push({ r, c })
    }
  }

  for (const anchor of shuffle(anchors, rand)) {
    const letter = (grid[anchor.r] as string[])[anchor.c] as string
    for (let i = 0; i < word.length; i++) {
      if (word[i] !== letter) continue
      // Пересечение перпендикулярно: буква слова садится на найденную клетку.
      const vertical = tryPlace(grid, word, anchor.r - i, anchor.c, 'V', known)
      if (vertical) return vertical
      const horizontal = tryPlace(grid, word, anchor.r, anchor.c - i, 'H', known)
      if (horizontal) return horizontal
    }
  }
  return null
}

/**
 * Определение к ответу.
 *
 * Предпочитаем тематическое: в нём весь смысл продукта. В лёгкий кроссворд не
 * берём помеченные `hard` — это спойлеры финала (spec §6.6).
 */
function pickClue(
  pack: Pack,
  answer: string,
  difficulty: Difficulty,
): { text: string; origin: Origin } {
  const entry = pack.entries.find((e) => e.answer === answer)
  if (!entry) throw new Error(`Слова ${answer} нет в паке ${pack.id}`)

  const allowed = entry.clues.filter((c) => !(difficulty === 'easy' && c.difficulty === 'hard'))
  const topic = allowed.find((c) => c.kind === 'topic')
  const chosen = topic ?? allowed.find((c) => c.kind === 'dict') ?? entry.clues[0]
  if (!chosen) throw new Error(`У слова ${answer} нет ни одного определения`)

  if (chosen.kind === 'dict') return { text: chosen.text, origin: 'filler' }
  // Тематическое определение к обычному слову — `dict`; к слову, которого вне
  // романа не существует, — `topic`. Различает наличие словарного значения.
  return { text: chosen.text, origin: entry.clues.some((c) => c.kind === 'dict') ? 'dict' : 'topic' }
}

function build(
  pack: Pack,
  grid: string[],
  meta: { id: string; title: string; difficulty: Difficulty },
): PuzzleSource {
  const parsed = parseGrid(grid)
  const clues: Record<string, string> = {}
  const origins: Record<string, Origin> = {}

  for (const entry of parsed.entries) {
    const { text, origin } = pickClue(pack, entry.answer, meta.difficulty)
    clues[entry.key] = text
    origins[entry.key] = origin
  }

  return {
    id: meta.id,
    lang: pack.lang,
    topicId: pack.topicId,
    title: meta.title,
    difficulty: meta.difficulty,
    grid,
    clues,
    origins,
  }
}

/**
 * Насколько сетка хороша.
 *
 * Слов побольше — но пересечения важнее: слово без пересечений угадывается без
 * опоры на соседей, и кроссворд рассыпается в список вопросов. Поэтому доля
 * пересечений входит в оценку с большим весом.
 */
function score(grid: string[]): number {
  const parsed = parseGrid(grid)
  const crossing = parsed.letterCells.filter(
    (cell) => parsed.entries.filter((entry) => entry.cells.includes(cell)).length > 1,
  ).length
  const crossShare = crossing / Math.max(1, parsed.letterCells.length)
  return parsed.entries.length + crossShare * 60
}

/** Лучшая сетка из нескольких попыток. Перебор сидов дешевле умного алгоритма. */
function best(
  words: readonly string[],
  rows: number,
  cols: number,
  tries: number,
  avoid: ReadonlySet<string>,
  topical: ReadonlySet<string>,
): string[] {
  let bestGrid: string[] | null = null
  let bestScore = -1
  for (let seed = 1; seed <= tries; seed++) {
    const grid = generate(words, rows, cols, seed * 2654435761, avoid, topical)
    const value = score(grid)
    if (value > bestScore) {
      bestScore = value
      bestGrid = grid
    }
  }
  return bestGrid as string[]
}

/** Размеры и сложности: одинаковые для всех тем, названия — свои у каждой. */
const SIZES: { difficulty: Difficulty; rows: number; cols: number }[] = [
  { difficulty: 'easy', rows: 11, cols: 11 },
  { difficulty: 'medium', rows: 13, cols: 13 },
  { difficulty: 'hard', rows: 15, cols: 15 },
]

/**
 * Названия кроссвордов по паку — по одному на каждый размер из `SIZES`.
 * Придумываются руками: осмысленное название из книги лучше «Кроссворд №2».
 */
const TITLES: Record<string, readonly [string, string, string]> = {
  'master-and-margarita-ru': ['Патриаршие пруды', 'Нехорошая квартира', 'Бал у сатаны'],
  'sherlock-ru': ['Бейкер-стрит', 'Собака на болотах', 'Рейхенбахский водопад'],
  'twelve-chairs-ru': ['Старгород', 'Погоня за гарнитуром', 'Сеанс в Васюках'],
}

/** Сколько сеток перебрать на каждый кроссворд. */
const TRIES = 8

/** Префикс для id кроссвордов темы: `sherlock-ru` → `sherlock`. */
const prefixOf = (packId: string): string => packId.replace(/-ru$/, '')

function main(): void {
  const packs = readPacks()
  if (packs.length === 0) throw new Error('В content/packs нет ни одного пака')

  const dir = join(CONTENT_DIR, 'puzzles')
  mkdirSync(dir, { recursive: true })

  for (const pack of packs) {
    const titles = TITLES[pack.id]
    if (!titles) {
      console.log(`  ${pack.id} — пропущен: в TITLES нет названий для этого пака`)
      continue
    }

    console.log(`${pack.title} (${pack.entries.length} слов)`)
    const words = pack.entries.map((entry) => entry.answer)
    /** Слова для знатоков: второстепенные имена и мелкие детали. */
    const hard = new Set(pack.entries.filter((e) => e.hard).map((e) => e.answer))
    /** Слова, у которых есть тематическое определение: их предпочитаем. */
    const topical = new Set(
      pack.entries.filter((e) => e.clues.some((c) => c.kind === 'topic')).map((e) => e.answer),
    )
    /** Слова, уже ушедшие в предыдущие кроссворды этой темы. */
    const spent = new Set<string>()

    SIZES.forEach((size, index) => {
      const id = `${prefixOf(pack.id)}-${index + 1}`
      const title = titles[index] as string
      // В лёгкий кроссворд слова для знатоков не берём вовсе, в средний и
      // сложный — берём: там они и должны быть.
      const allowed = size.difficulty === 'easy' ? words.filter((w) => !hard.has(w)) : words
      const grid = best(allowed, size.rows, size.cols, TRIES, spent, topical)
      const puzzle = build(pack, grid, { id, title, difficulty: size.difficulty })
      const answers = parseGrid(grid).entries.map((entry) => entry.answer)
      const repeats = answers.filter((word) => spent.has(word)).length
      for (const word of answers) spent.add(word)

      writeFileSync(join(dir, `${id}.json`), `${JSON.stringify(puzzle, null, 2)}\n`)
      console.log(
        `  ${id} «${title}» — ${size.rows}×${size.cols}, слов ${answers.length}, повторов ${repeats}`,
      )
    })
  }
}

main()
