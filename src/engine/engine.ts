/**
 * Движок игры: всё поведение плеера в чистых функциях.
 *
 * Правила этого файла:
 * - ни одного импорта React, DOM, Next или `node:fs` — движок обязан работать
 *   в голом Node, поэтому его и можно покрыть тестами без окружения браузера;
 * - `PlayState` иммутабелен. Каждая функция возвращает новое состояние, а если
 *   ничего не изменилось — тот же объект, чтобы React мог сравнивать по ссылке;
 * - геометрию сетки знает только `buildIndex`. Остальные функции работают с
 *   готовым индексом и позицией внутри слова, а не с рядами и колонками.
 *
 * Про пересечения: клетка на пересечении — один и тот же плоский индекс в `cells`
 * обоих слов. Поэтому буква, записанная в клетку, автоматически видна обоим
 * словам, и сверять их между собой не нужно.
 */

import type { CompiledPuzzle, Dir, Lang } from '../core/model'

// ─────────────────────────────────────────────────────────────────────────────
// Индекс кроссворда
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Слово в индексе движка.
 *
 * `id` — не тот номер, что нарисован в сетке. Сквозная нумерация даёт клетке
 * один номер на оба направления (№1 — это сразу «1 по горизонтали» и «1 по
 * вертикали»), поэтому словом он не идентифицируется. Движок нумерует слова
 * сам: сквозной `id` в порядке чтения, горизонталь раньше вертикали. Номер для
 * показа человеку лежит рядом, в `number`.
 */
export interface IndexEntry {
  /** Уникальный идентификатор слова внутри движка: 1..N в порядке чтения. */
  id: number
  /** Номер клетки-начала из сквозной нумерации — то, что видно в сетке и в списке. */
  number: number
  dir: Dir
  /** Плоские индексы клеток по порядку чтения. */
  cells: readonly number[]
  clue: string
}

/** Слово, которому принадлежит клетка, и позиция клетки внутри него. */
export interface EntryAtCell {
  /** `IndexEntry.id`. */
  e: number
  pos: number
}

/** Всё, что движку нужно знать о кроссворде. Строится один раз на кроссворд. */
export interface PuzzleIndex {
  puzzle: CompiledPuzzle
  rows: number
  cols: number
  lang: Lang
  /** Слова в порядке чтения. */
  order: readonly IndexEntry[]
  /** Плоские индексы буквенных клеток в порядке чтения — порядок строки решения. */
  letterCells: readonly number[]
  byId: ReadonlyMap<number, IndexEntry>
  /** Клетка → слова, её содержащие. Горизонталь всегда первая. */
  atCell: ReadonlyMap<number, readonly EntryAtCell[]>
  /** Клетка → её позиция в строке решения. */
  solutionAt: ReadonlyMap<number, number>
}

/** Пустой список — общий объект, чтобы не плодить мусор на каждый промах. */
const NO_ENTRIES: readonly EntryAtCell[] = []

/**
 * Разбирает скомпилированный кроссворд в индекс.
 *
 * Вызывается один раз на кроссворд: дальше все функции движка принимают готовый
 * индекс и не сканируют сетку заново.
 */
export function buildIndex(puzzle: CompiledPuzzle): PuzzleIndex {
  const { rows, cols, lang } = puzzle.meta

  const letterCells: number[] = []
  const solutionAt = new Map<number, number>()
  for (let index = 0; index < rows * cols; index++) {
    // -1 — блок, 0 и больше — буквенная клетка (0 значит «без номера»).
    if ((puzzle.cells[index] ?? -1) >= 0) {
      solutionAt.set(index, letterCells.length)
      letterCells.push(index)
    }
  }

  // Порядок чтения задаём сами: полагаться на порядок в JSON не хочется.
  const sorted = [...puzzle.entries].sort((a, b) => {
    const fa = a.cells[0] ?? 0
    const fb = b.cells[0] ?? 0
    if (fa !== fb) return fa - fb
    if (a.dir === b.dir) return 0
    return a.dir === 'H' ? -1 : 1
  })

  const order: IndexEntry[] = sorted.map((entry, i) => ({
    id: i + 1,
    number: entry.number,
    dir: entry.dir,
    cells: [...entry.cells],
    clue: entry.clue,
  }))

  const byId = new Map<number, IndexEntry>()
  const atCell = new Map<number, EntryAtCell[]>()
  for (const entry of order) {
    byId.set(entry.id, entry)
    entry.cells.forEach((cell, pos) => {
      const list = atCell.get(cell)
      const match: EntryAtCell = { e: entry.id, pos }
      // Горизонталь первая: она направление по умолчанию.
      if (list === undefined) atCell.set(cell, [match])
      else if (entry.dir === 'H') list.unshift(match)
      else list.push(match)
    })
  }

  return { puzzle, rows, cols, lang, order, letterCells, byId, atCell, solutionAt }
}

/** Слова, которым принадлежит клетка. Пусто, если клетка — блок. */
export function entriesAtCell(ix: PuzzleIndex, cell: number): readonly EntryAtCell[] {
  return ix.atCell.get(cell) ?? NO_ENTRIES
}

/** Подходит ли строка решения этому кроссворду. Проверка от опечаток в контенте. */
export function solutionFits(ix: PuzzleIndex, solution: string | null): solution is string {
  return solution !== null && solution.length === ix.letterCells.length
}

// ─────────────────────────────────────────────────────────────────────────────
// Состояние партии
// ─────────────────────────────────────────────────────────────────────────────

/** Каретка: слово и позиция буквы внутри него. */
export interface Cursor {
  entryId: number
  pos: number
}

/** Состояние партии. Иммутабельно: меняют его только функции этого файла. */
export interface PlayState {
  /** Введённые буквы по плоскому индексу клетки. Пустой клетки в объекте нет. */
  letters: Readonly<Record<number, string>>
  /** Клетки, открытые подсказкой. */
  revealed: ReadonlySet<number>
  /** Клетки, помеченные проверкой как неверные. */
  wrong: ReadonlySet<number>
  cursor: Cursor
  /** Сколько букв открыто подсказкой. Каждая клетка считается один раз. */
  hints: number
  /** Сколько раз игрок нажимал «проверить». */
  checks: number
}

/** Новая партия: пустая сетка, каретка на первом слове. */
export function initialState(ix: PuzzleIndex): PlayState {
  const first = ix.order[0]
  return {
    letters: {},
    revealed: new Set<number>(),
    wrong: new Set<number>(),
    cursor: { entryId: first?.id ?? 0, pos: 0 },
    hints: 0,
    checks: 0,
  }
}

/** Клетка под кареткой. `null`, если каретка указывает в никуда. */
export function cursorCell(ix: PuzzleIndex, cursor: Cursor): number | null {
  return ix.byId.get(cursor.entryId)?.cells[cursor.pos] ?? null
}

// ─────────────────────────────────────────────────────────────────────────────
// Выбор слова и каретка
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Куда встанет каретка при щелчке по клетке.
 *
 * Без `prefer` предпочитается горизонталь: так работают все кроссворды, к которым
 * игрок привык. `null` — клетка не буквенная.
 */
export function focusCell(ix: PuzzleIndex, cell: number, prefer?: Dir): Cursor | null {
  const matches = entriesAtCell(ix, cell)
  if (matches.length === 0) return null
  const wanted = prefer === undefined ? undefined : matches.find((m) => dirOf(ix, m.e) === prefer)
  const match = wanted ?? matches[0]
  if (match === undefined) return null
  return { entryId: match.e, pos: match.pos }
}

function dirOf(ix: PuzzleIndex, entryId: number): Dir | undefined {
  return ix.byId.get(entryId)?.dir
}

/**
 * Щелчок по клетке.
 *
 * Повторный щелчок по клетке, где уже стоит каретка, меняет направление — но
 * только если клетка на пересечении, иначе менять не на что. Щелчок по другой
 * клетке сохраняет направление активного слова: игрок заполняет строку и не
 * хочет, чтобы каретка внезапно повернула.
 */
export function clickCell(ix: PuzzleIndex, cell: number, cursor: Cursor | null): Cursor | null {
  const matches = entriesAtCell(ix, cell)
  if (matches.length === 0) return cursor
  if (cursor === null) return focusCell(ix, cell)

  const same = matches.find((m) => m.e === cursor.entryId)
  if (same !== undefined) {
    // Клетка принадлежит активному слову: либо переезд внутри слова, либо разворот.
    if (same.pos !== cursor.pos) return { entryId: cursor.entryId, pos: same.pos }
    return toggleDirection(ix, cursor)
  }

  return focusCell(ix, cell, dirOf(ix, cursor.entryId)) ?? cursor
}

/**
 * Разворот каретки на пересечении.
 * Если клетка принадлежит одному слову, возвращается тот же объект.
 */
export function toggleDirection(ix: PuzzleIndex, cursor: Cursor): Cursor {
  const cell = cursorCell(ix, cursor)
  if (cell === null) return cursor
  const other = entriesAtCell(ix, cell).find((m) => m.e !== cursor.entryId)
  if (other === undefined) return cursor
  return { entryId: other.e, pos: other.pos }
}

/**
 * Выбор слова из списка определений.
 * Каретка встаёт на первую пустую букву — дописывать начатое удобнее с дырки.
 */
export function selectEntry(ix: PuzzleIndex, state: PlayState, entryId: number): Cursor {
  const entry = ix.byId.get(entryId)
  if (entry === undefined) return state.cursor
  const pos = entry.cells.findIndex((cell) => state.letters[cell] === undefined)
  return { entryId, pos: pos === -1 ? 0 : pos }
}

/** Tab и Shift+Tab: следующее слово по кругу, каретка на первой пустой букве. */
export function stepEntry(ix: PuzzleIndex, state: PlayState, delta: number): Cursor {
  const count = ix.order.length
  if (count === 0) return state.cursor
  const current = ix.order.findIndex((entry) => entry.id === state.cursor.entryId)
  const from = current === -1 ? 0 : current
  const next = ix.order[(((from + delta) % count) + count) % count]
  if (next === undefined) return state.cursor
  return selectEntry(ix, state, next.id)
}

/** Куда шагает каретка стрелками. */
export type GridMove = 'up' | 'down' | 'left' | 'right'

/**
 * Стрелка по сетке.
 *
 * Шагаем по клеткам, блоки перешагиваем, за край сетки не выходим. На новой
 * клетке предпочитается слово вдоль движения: стрелка вниз переключает на
 * вертикальное слово, даже если активным было горизонтальное.
 */
export function moveGrid(ix: PuzzleIndex, cursor: Cursor, move: GridMove): Cursor {
  const cell = cursorCell(ix, cursor)
  if (cell === null) return cursor

  const dr = move === 'up' ? -1 : move === 'down' ? 1 : 0
  const dc = move === 'left' ? -1 : move === 'right' ? 1 : 0
  const wanted: Dir = dr === 0 ? 'H' : 'V'

  let r = Math.floor(cell / ix.cols) + dr
  let c = (cell % ix.cols) + dc
  while (r >= 0 && r < ix.rows && c >= 0 && c < ix.cols) {
    const next = focusCell(ix, r * ix.cols + c, wanted)
    if (next !== null) return next
    r += dr
    c += dc
  }
  return cursor
}

// ─────────────────────────────────────────────────────────────────────────────
// Ввод букв
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Символ с клавиатуры → буква кроссворда.
 *
 * Ё сводится к Е (традиция кроссвордов и целый класс багов заодно), регистр
 * поднимается, чужой алфавит отбрасывается: в русском кроссворде латиница —
 * это почти всегда забытая раскладка, а не попытка что-то ввести.
 */
export function normalizeInput(raw: string, lang: Lang): string | null {
  if (raw.length !== 1) return null
  const upper = raw.toUpperCase().replace('Ё', 'Е')
  if (upper.length !== 1) return null
  const alphabet = lang === 'ru' ? /^[А-Я]$/ : /^[A-Z]$/
  return alphabet.test(upper) ? upper : null
}

/** Копия состояния с новой буквой в клетке. `null` — стереть. */
function writeCell(state: PlayState, cell: number, letter: string | null): PlayState {
  const letters = { ...state.letters }
  if (letter === null) delete letters[cell]
  else letters[cell] = letter

  // Пометки проверки и подсказки относятся к прежней букве и снимаются вместе с ней.
  const revealed = dropFrom(state.revealed, cell)
  const wrong = dropFrom(state.wrong, cell)
  return { ...state, letters, revealed, wrong }
}

function dropFrom(set: ReadonlySet<number>, cell: number): ReadonlySet<number> {
  if (!set.has(cell)) return set
  const next = new Set(set)
  next.delete(cell)
  return next
}

/**
 * Следующая позиция каретки после ввода буквы.
 *
 * Сначала ищем пустую клетку правее (ниже) — заполненные перешагиваем, чтобы
 * пересечения не приходилось перебивать. Если до конца слова пусто не нашлось,
 * возвращаемся к пропущенной букве в начале. Если слово заполнено целиком,
 * каретка остаётся на месте: за границы слова ввод её не выносит.
 */
function advance(ix: PuzzleIndex, letters: Readonly<Record<number, string>>, cursor: Cursor): Cursor {
  const entry = ix.byId.get(cursor.entryId)
  if (entry === undefined) return cursor
  const empty = (pos: number): boolean => {
    const cell = entry.cells[pos]
    return cell !== undefined && letters[cell] === undefined
  }
  for (let pos = cursor.pos + 1; pos < entry.cells.length; pos++) {
    if (empty(pos)) return { entryId: cursor.entryId, pos }
  }
  for (let pos = 0; pos < cursor.pos; pos++) {
    if (empty(pos)) return { entryId: cursor.entryId, pos }
  }
  return cursor
}

/** Ввод буквы в клетку под кареткой. Чужой алфавит игнорируется молча. */
export function applyLetter(ix: PuzzleIndex, state: PlayState, raw: string): PlayState {
  const letter = normalizeInput(raw, ix.lang)
  if (letter === null) return state
  const cell = cursorCell(ix, state.cursor)
  if (cell === null) return state

  const written = writeCell(state, cell, letter)
  return { ...written, cursor: advance(ix, written.letters, state.cursor) }
}

/**
 * Backspace.
 *
 * Заполненная клетка стирается на месте, каретка отходит на шаг назад. Пустая
 * клетка стирает предыдущую и на неё же встаёт — так стирается только что
 * набранное. За начало слова каретка не уходит.
 */
export function backspace(ix: PuzzleIndex, state: PlayState): PlayState {
  const entry = ix.byId.get(state.cursor.entryId)
  if (entry === undefined) return state
  const cell = entry.cells[state.cursor.pos]
  if (cell === undefined) return state

  if (state.letters[cell] !== undefined) {
    const back = Math.max(0, state.cursor.pos - 1)
    return { ...writeCell(state, cell, null), cursor: { entryId: state.cursor.entryId, pos: back } }
  }

  const prevPos = state.cursor.pos - 1
  const prevCell = prevPos >= 0 ? entry.cells[prevPos] : undefined
  if (prevCell === undefined) return state
  return {
    ...writeCell(state, prevCell, null),
    cursor: { entryId: state.cursor.entryId, pos: prevPos },
  }
}

/** Delete: стирает букву под кареткой, каретку не двигает. */
export function deleteAtCursor(ix: PuzzleIndex, state: PlayState): PlayState {
  const cell = cursorCell(ix, state.cursor)
  if (cell === null || state.letters[cell] === undefined) return state
  return writeCell(state, cell, null)
}

// ─────────────────────────────────────────────────────────────────────────────
// Проверка и подсказки
// ─────────────────────────────────────────────────────────────────────────────

/** Что проверяем: букву под кареткой, активное слово или весь кроссворд. */
export type CheckScope = 'letter' | 'word' | 'all'

function scopeCells(ix: PuzzleIndex, state: PlayState, scope: CheckScope): readonly number[] {
  if (scope === 'all') return ix.letterCells
  const entry = ix.byId.get(state.cursor.entryId)
  if (entry === undefined) return []
  if (scope === 'word') return entry.cells
  const cell = entry.cells[state.cursor.pos]
  return cell === undefined ? [] : [cell]
}

/** Верная ли буква в клетке. `null` — клетка пуста или решения нет. */
function isCorrect(ix: PuzzleIndex, state: PlayState, solution: string, cell: number): boolean | null {
  const letter = state.letters[cell]
  if (letter === undefined) return null
  const at = ix.solutionAt.get(cell)
  if (at === undefined) return null
  return solution[at] === letter
}

/**
 * Проверка: помечает неверные буквы и снимает пометку с верных.
 *
 * Пустые клетки не помечаются — иначе первая же проверка покрасит полсетки.
 * Счётчик проверок растёт на каждый вызов: он входит в итог партии.
 */
export function check(
  ix: PuzzleIndex,
  state: PlayState,
  solution: string | null,
  scope: CheckScope,
): PlayState {
  if (!solutionFits(ix, solution)) return state
  const wrong = new Set(state.wrong)
  for (const cell of scopeCells(ix, state, scope)) {
    const correct = isCorrect(ix, state, solution, cell)
    if (correct === false) wrong.add(cell)
    else wrong.delete(cell)
  }
  return { ...state, wrong, checks: state.checks + 1 }
}

/** Что дала проверка. Нужно, чтобы игроку можно было сказать это словами. */
export interface CheckOutcome {
  /** Сколько клеток попало в область проверки. */
  cells: number
  /** Сколько из них заполнено. Ноль — проверять нечего. */
  filled: number
  /** Сколько неверных. */
  wrong: number
}

/**
 * Результат проверки, не меняя состояния.
 *
 * Без этого интерфейс не может отличить «проверил, всё верно» от «ничего не
 * произошло»: в обоих случаях помеченных клеток нет, а счётчик растёт — и игрок
 * не понимает, сработала кнопка или нет.
 */
export function checkOutcome(
  ix: PuzzleIndex,
  state: PlayState,
  solution: string | null,
  scope: CheckScope,
): CheckOutcome {
  const cells = scopeCells(ix, state, scope)
  if (!solutionFits(ix, solution)) return { cells: cells.length, filled: 0, wrong: 0 }

  let filled = 0
  let wrong = 0
  for (const cell of cells) {
    const correct = isCorrect(ix, state, solution, cell)
    if (correct === null) continue
    filled++
    if (!correct) wrong++
  }
  return { cells: cells.length, filled, wrong }
}

/**
 * Подсказка: открывает букву под кареткой.
 *
 * Одна клетка считается один раз, сколько бы раз её ни открывали: счётчик — это
 * «сколько букв игроку подсказали», а не «сколько раз он нажал кнопку».
 */
export function revealLetter(ix: PuzzleIndex, state: PlayState, solution: string | null): PlayState {
  if (!solutionFits(ix, solution)) return state
  const cell = cursorCell(ix, state.cursor)
  if (cell === null) return state
  const at = ix.solutionAt.get(cell)
  const letter = at === undefined ? undefined : solution[at]
  if (letter === undefined) return state

  const counted = state.revealed.has(cell)
  const written = writeCell(state, cell, letter)
  const revealed = new Set(written.revealed)
  revealed.add(cell)
  return {
    ...written,
    revealed,
    hints: counted ? state.hints : state.hints + 1,
    cursor: advance(ix, written.letters, state.cursor),
  }
}

/** Все ли буквенные клетки заполнены. */
export function isFilled(ix: PuzzleIndex, state: PlayState): boolean {
  return ix.letterCells.every((cell) => state.letters[cell] !== undefined)
}

/** Разгадан ли кроссворд: заполнен целиком и совпадает с решением. */
export function isSolved(ix: PuzzleIndex, state: PlayState, solution: string | null): boolean {
  if (!solutionFits(ix, solution)) return false
  return ix.letterCells.every((cell, i) => state.letters[cell] === solution[i])
}

// ─────────────────────────────────────────────────────────────────────────────
// Сохранение прогресса
// ─────────────────────────────────────────────────────────────────────────────

/** Версия формата сохранения. Прогресс чужой версии отбрасывается, а не чинится. */
const PROGRESS_VERSION = 1

/** Пустая клетка в сохранённой строке букв. */
const EMPTY_CELL = '.'

/** Прогресс в виде, пригодном для `JSON.stringify` и localStorage. */
export interface SavedProgress {
  v: number
  /** Хэш решения: чужой прогресс не подхватится под тем же id. */
  hash: string
  /** Буквы в порядке буквенных клеток, точка — пусто. */
  letters: string
  /** Плоские индексы клеток, открытых подсказкой. */
  revealed: number[]
  hints: number
  checks: number
  elapsedMs: number
  done: boolean
}

/** Разобранный прогресс. Пометки проверки не сохраняются: это действие сессии. */
export interface RestoredProgress {
  state: PlayState
  elapsedMs: number
  done: boolean
}

export function serializeProgress(
  ix: PuzzleIndex,
  state: PlayState,
  meta: { elapsedMs: number; done: boolean },
): SavedProgress {
  const letters = ix.letterCells.map((cell) => state.letters[cell] ?? EMPTY_CELL).join('')
  return {
    v: PROGRESS_VERSION,
    hash: ix.puzzle.solutionHash,
    letters,
    revealed: [...state.revealed].sort((a, b) => a - b),
    hints: state.hints,
    checks: state.checks,
    elapsedMs: meta.elapsedMs,
    done: meta.done,
  }
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

/**
 * Разбор сохранённого прогресса.
 *
 * Возвращает `null` на всё подозрительное: чужой хэш, чужую версию, битую длину,
 * не тот тип. Прогресс приходит из localStorage, то есть из места, куда мог
 * залезть кто угодно; чинить полуразобранное состояние дороже, чем начать партию.
 */
export function parseProgress(ix: PuzzleIndex, raw: unknown): RestoredProgress | null {
  if (typeof raw !== 'object' || raw === null) return null
  const saved = raw as Partial<SavedProgress>

  if (saved.v !== PROGRESS_VERSION) return null
  if (saved.hash !== ix.puzzle.solutionHash) return null
  if (typeof saved.letters !== 'string' || saved.letters.length !== ix.letterCells.length) return null
  if (!Array.isArray(saved.revealed)) return null
  if (!isFiniteNumber(saved.hints) || !isFiniteNumber(saved.checks)) return null
  if (!isFiniteNumber(saved.elapsedMs) || typeof saved.done !== 'boolean') return null

  const letters: Record<number, string> = {}
  for (let i = 0; i < ix.letterCells.length; i++) {
    const char = saved.letters[i] as string
    if (char === EMPTY_CELL) continue
    const letter = normalizeInput(char, ix.lang)
    if (letter === null) return null
    letters[ix.letterCells[i] as number] = letter
  }

  const revealed = new Set<number>()
  for (const cell of saved.revealed) {
    if (!isFiniteNumber(cell) || !ix.solutionAt.has(cell)) return null
    revealed.add(cell)
  }

  const state: PlayState = {
    letters,
    revealed,
    wrong: new Set<number>(),
    cursor: initialState(ix).cursor,
    hints: saved.hints,
    checks: saved.checks,
  }
  return { state, elapsedMs: saved.elapsedMs, done: saved.done }
}

/** Ключ localStorage. Хэш решения в ключе: переиздание кроссворда начинается с чистого листа. */
export function storageKey(puzzle: CompiledPuzzle): string {
  return `crossw:${puzzle.meta.id}:${puzzle.solutionHash}`
}

// ─────────────────────────────────────────────────────────────────────────────
// Тексты
// ─────────────────────────────────────────────────────────────────────────────

/** `мм:сс`, а после часа — `ч:мм:сс`. Отрицательное время бывает при рассинхроне часов. */
export function formatTime(elapsedMs: number): string {
  const total = elapsedMs > 0 ? Math.floor(elapsedMs / 1000) : 0
  const seconds = total % 60
  const minutes = Math.floor(total / 60) % 60
  const hours = Math.floor(total / 3600)
  const ss = String(seconds).padStart(2, '0')
  if (hours === 0) return `${minutes}:${ss}`
  return `${hours}:${String(minutes).padStart(2, '0')}:${ss}`
}

/**
 * aria-label клетки: что в ней стоит, где она внутри слова и что это за слово.
 *
 * Читается скринридером при каждом переходе, поэтому порядок такой: сначала
 * содержимое клетки, потом позиция, определение последним — его можно не дослушивать.
 */
export function cellLabel(ix: PuzzleIndex, state: PlayState, cell: number): string {
  const matches = entriesAtCell(ix, cell)
  if (matches.length === 0) return 'блок'

  const active = matches.find((m) => m.e === state.cursor.entryId) ?? matches[0]
  const entry = active === undefined ? undefined : ix.byId.get(active.e)
  const letter = state.letters[cell]
  const head = letter === undefined ? 'пустая клетка' : `буква ${letter}`
  if (entry === undefined || active === undefined) return head

  const dir = entry.dir === 'H' ? 'по горизонтали' : 'по вертикали'
  return `${head}, ${active.pos + 1} из ${entry.cells.length} ${dir}, №${entry.number}: ${entry.clue}`
}

/** Текст кнопки «поделиться»: название, время и счётчики, без спойлеров. */
export function shareText(
  puzzle: CompiledPuzzle,
  result: { elapsedMs: number; hints: number; checks: number },
): string {
  return (
    `CrossW — «${puzzle.meta.title}» за ${formatTime(result.elapsedMs)}, ` +
    `подсказок ${result.hints}, проверок ${result.checks}`
  )
}
