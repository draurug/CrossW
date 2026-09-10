import { beforeEach, describe, expect, it } from 'vitest'
import { decodeSolution } from '../core/solution'
import { DEV_PUZZLE, DEV_SOLUTION_ENCODED } from './devPuzzle'
import {
  type PlayState,
  applyLetter,
  backspace,
  buildIndex,
  cellLabel,
  check,
  checkOutcome,
  clickCell,
  cursorCell,
  deleteAtCursor,
  entriesAtCell,
  focusCell,
  formatTime,
  initialState,
  isFilled,
  isSolved,
  moveGrid,
  normalizeInput,
  parseProgress,
  revealLetter,
  selectEntry,
  serializeProgress,
  shareText,
  solutionFits,
  stepEntry,
  storageKey,
  toggleDirection,
} from './engine'

/*
 * Фикстура 9×9 (см. devPuzzle.ts):
 *      c0 c1 c2 c3 c4 c5 c6 c7 c8
 * r0:   #  Ш  А  Р  #  Г  О  Р  А
 * r1:   #  О  #  А  #  О  #  О  #
 * r2:   Ж  У  Р  Н  А  Л  #  Б  #
 * r3:   #  #  #  Е  #  #  #  О  #
 * r4:   О  Т  Е  Ц  #  Л  И  Т  Р
 * r5:   #  #  #  #  #  И  #  #  #
 * r6:   Т  У  Р  И  З  М  #  С  #
 * r7:   #  Х  #  В  #  О  #  Ы  #
 * r8:   #  О  С  А  #  Н  О  Р  А
 *
 * Слова в порядке чтения — их номер здесь и есть `entryId` движка:
 *   1 ШАР(H)   2 ШОУ(V)    3 РАНЕЦ(V)  4 ГОРА(H)
 *   5 ГОЛ(V)   6 РОБОТ(V)  7 ЖУРНАЛ(H) 8 ОТЕЦ(H)
 *   9 ЛИТР(H) 10 ЛИМОН(V) 11 ТУРИЗМ(H) 12 УХО(V)
 *  13 ИВА(V)  14 СЫР(V)   15 ОСА(H)    16 НОРА(H)
 *
 * Номер в сетке — не то же самое: №1 носят сразу ШАР и ШОУ (см. `IndexEntry`).
 */

const ix = buildIndex(DEV_PUZZLE)
const SOLUTION = decodeSolution(DEV_PUZZLE.meta.id, DEV_SOLUTION_ENCODED)

/** flat-индекс клетки по координатам. */
const at = (r: number, c: number) => r * DEV_PUZZLE.meta.cols + c

function typeAll(state: PlayState, text: string): PlayState {
  return [...text].reduce((s, ch) => applyLetter(ix, s, ch), state)
}

let s0: PlayState
beforeEach(() => {
  s0 = initialState(ix)
})

describe('buildIndex', () => {
  it('индексирует все слова и буквенные клетки', () => {
    expect(ix.order).toHaveLength(16)
    expect(ix.letterCells).toHaveLength(47)
    expect(SOLUTION).toHaveLength(47)
    expect(solutionFits(ix, SOLUTION)).toBe(true)
  })

  it('порядок чтения начинается с левого верхнего слова', () => {
    expect(ix.order[0]?.dir).toBe('H')
    expect(ix.order[0]?.cells[0]).toBe(at(0, 1))
    expect(ix.order[0]?.id).toBe(1)
    expect(ix.order.map((e) => e.id)).toContain(16)
  })

  it('клетка на пересечении принадлежит двум словам, обычная — одному', () => {
    expect(entriesAtCell(ix, at(0, 1)).map((m) => m.e)).toEqual([1, 2])
    expect(entriesAtCell(ix, at(0, 2)).map((m) => m.e)).toEqual([1])
    expect(entriesAtCell(ix, at(0, 0))).toHaveLength(0)
  })
})

describe('выбор слова', () => {
  it('по умолчанию предпочитается горизонтальное слово', () => {
    expect(focusCell(ix, at(0, 1))).toEqual({ entryId: 1, pos: 0 })
  })

  it('явное предпочтение направления выбирает вертикальное слово', () => {
    expect(focusCell(ix, at(0, 1), 'V')).toEqual({ entryId: 2, pos: 0 })
  })

  it('клик по не буквенной клетке возвращает null', () => {
    expect(focusCell(ix, at(0, 0))).toBeNull()
    expect(focusCell(ix, at(1, 2))).toBeNull()
  })

  it('повторный клик по активной клетке на пересечении меняет направление', () => {
    const first = clickCell(ix, at(0, 1), null)
    expect(first).toEqual({ entryId: 1, pos: 0 })
    const second = clickCell(ix, at(0, 1), first)
    expect(second).toEqual({ entryId: 2, pos: 0 })
    expect(clickCell(ix, at(0, 1), second)).toEqual({ entryId: 1, pos: 0 })
  })

  it('повторный клик по клетке с одним словом направление не меняет', () => {
    const cursor = { entryId: 1, pos: 1 }
    expect(clickCell(ix, at(0, 2), cursor)).toEqual(cursor)
    expect(toggleDirection(ix, cursor)).toEqual(cursor)
  })

  it('клик по другой клетке сохраняет направление активного слова', () => {
    const vertical = { entryId: 2, pos: 0 }
    expect(clickCell(ix, at(2, 1), vertical)).toEqual({ entryId: 2, pos: 2 })
    const horizontal = { entryId: 1, pos: 0 }
    expect(clickCell(ix, at(2, 1), horizontal)).toEqual({ entryId: 7, pos: 1 })
  })

  it('выбор слова по определению ставит каретку на первую пустую букву', () => {
    const filled = { ...s0, letters: { [at(2, 0)]: 'Ж', [at(2, 1)]: 'У' } }
    expect(selectEntry(ix, filled, 7)).toEqual({ entryId: 7, pos: 2 })
    expect(selectEntry(ix, s0, 7)).toEqual({ entryId: 7, pos: 0 })
  })
})

describe('ввод букв', () => {
  it('Ё превращается в Е', () => {
    const s = applyLetter(ix, { ...s0, cursor: { entryId: 3, pos: 3 } }, 'ё')
    expect(s.letters[at(3, 3)]).toBe('Е')
  })

  it('строчные буквы приводятся к заглавным', () => {
    const s = applyLetter(ix, s0, 'ш')
    expect(s.letters[at(0, 1)]).toBe('Ш')
  })

  it('латиница в русском кроссворде игнорируется', () => {
    const s = applyLetter(ix, s0, 'n')
    expect(s).toBe(s0)
    expect(normalizeInput('n', 'ru')).toBeNull()
    expect(normalizeInput('ф', 'en')).toBeNull()
    expect(normalizeInput('f', 'en')).toBe('F')
    expect(normalizeInput('ё', 'ru')).toBe('Е')
  })

  it('после буквы каретка идёт на следующую пустую клетку слова', () => {
    const s = typeAll(s0, 'ША')
    expect(s.cursor).toEqual({ entryId: 1, pos: 2 })
    expect(cursorCell(ix, s.cursor)).toBe(at(0, 3))
  })

  it('заполненные клетки перешагиваются', () => {
    // А уже стоит в середине слова ШАР, курсор в его начале
    const pre: PlayState = { ...s0, letters: { [at(0, 2)]: 'А' }, cursor: { entryId: 1, pos: 0 } }
    const s = applyLetter(ix, pre, 'Ш')
    expect(s.cursor).toEqual({ entryId: 1, pos: 2 })
  })

  it('в конце слова каретка не выходит за его границы', () => {
    const s = typeAll(s0, 'ШАРX')
    expect(s.cursor).toEqual({ entryId: 1, pos: 2 })
    const more = applyLetter(ix, s, 'К')
    expect(more.letters[at(0, 3)]).toBe('К')
    expect(more.cursor).toEqual({ entryId: 1, pos: 2 })
  })

  it('заполнив слово с конца, каретка возвращается к пропущенной букве', () => {
    const pre: PlayState = { ...s0, cursor: { entryId: 1, pos: 1 } }
    const s = applyLetter(ix, pre, 'А')
    expect(s.cursor).toEqual({ entryId: 1, pos: 2 })
    const s2 = applyLetter(ix, s, 'Р')
    expect(s2.cursor).toEqual({ entryId: 1, pos: 0 })
  })
})

describe('стирание', () => {
  it('Backspace на заполненной клетке стирает её и шагает назад', () => {
    const s = typeAll(s0, 'ША')
    const back = backspace(ix, { ...s, cursor: { entryId: 1, pos: 1 } })
    expect(back.letters[at(0, 2)]).toBeUndefined()
    expect(back.cursor).toEqual({ entryId: 1, pos: 0 })
  })

  it('Backspace на пустой клетке стирает предыдущую', () => {
    const s = typeAll(s0, 'ША')
    expect(s.cursor).toEqual({ entryId: 1, pos: 2 })
    const back = backspace(ix, s)
    expect(back.letters[at(0, 2)]).toBeUndefined()
    expect(back.letters[at(0, 1)]).toBe('Ш')
    expect(back.cursor).toEqual({ entryId: 1, pos: 1 })
  })

  it('Backspace в начале слова не выходит за его границу', () => {
    const s = typeAll(s0, 'Ш')
    const back = backspace(ix, { ...s, cursor: { entryId: 1, pos: 0 } })
    expect(back.cursor).toEqual({ entryId: 1, pos: 0 })
    expect(back.letters[at(0, 1)]).toBeUndefined()
  })

  it('Delete стирает букву под кареткой, не двигая её', () => {
    const s = typeAll(s0, 'Ш')
    const del = deleteAtCursor(ix, { ...s, cursor: { entryId: 1, pos: 0 } })
    expect(del.letters[at(0, 1)]).toBeUndefined()
    expect(del.cursor).toEqual({ entryId: 1, pos: 0 })
  })
})

describe('движение по сетке', () => {
  it('вправо — соседняя буквенная клетка того же слова', () => {
    expect(moveGrid(ix, { entryId: 1, pos: 0 }, 'right')).toEqual({ entryId: 1, pos: 1 })
  })

  it('блоки перешагиваются', () => {
    // (0,3) → (0,4) блок → (0,5) буква слова ГОРА
    expect(moveGrid(ix, { entryId: 1, pos: 2 }, 'right')).toEqual({ entryId: 4, pos: 0 })
    // (3,3) → (3,4), (3,5), (3,6) блоки → (3,7) буква слова РОБОТ
    expect(moveGrid(ix, { entryId: 3, pos: 3 }, 'right')).toEqual({ entryId: 6, pos: 3 })
  })

  it('вниз переключает активное слово на вертикальное', () => {
    expect(moveGrid(ix, { entryId: 1, pos: 0 }, 'down')).toEqual({ entryId: 2, pos: 1 })
  })

  it('у края сетки каретка остаётся на месте', () => {
    const cursor = { entryId: 1, pos: 0 }
    expect(moveGrid(ix, cursor, 'up')).toEqual(cursor)
    expect(moveGrid(ix, cursor, 'left')).toEqual(cursor)
  })
})

describe('переход между словами', () => {
  it('Tab и Shift+Tab идут по кругу', () => {
    const forward = stepEntry(ix, s0, 1)
    expect(forward.entryId).toBe(ix.order[1]?.id)
    const back = stepEntry(ix, { ...s0, cursor: forward }, -1)
    expect(back.entryId).toBe(ix.order[0]?.id)
    const wrap = stepEntry(ix, { ...s0, cursor: { entryId: ix.order[0]!.id, pos: 0 } }, -1)
    expect(wrap.entryId).toBe(ix.order[15]?.id)
  })
})

describe('проверка и подсказки', () => {
  it('проверка буквы помечает неверную и снимает пометку с верной', () => {
    const wrongTyped = applyLetter(ix, s0, 'К')
    const checked = check(ix, { ...wrongTyped, cursor: { entryId: 1, pos: 0 } }, SOLUTION, 'letter')
    expect(checked.wrong.has(at(0, 1))).toBe(true)
    expect(checked.checks).toBe(1)

    const fixed = applyLetter(ix, { ...checked, cursor: { entryId: 1, pos: 0 } }, 'Ш')
    expect(fixed.wrong.has(at(0, 1))).toBe(false)
    const rechecked = check(ix, { ...fixed, cursor: { entryId: 1, pos: 0 } }, SOLUTION, 'letter')
    expect(rechecked.wrong.size).toBe(0)
    expect(rechecked.checks).toBe(2)
  })

  it('проверка слова и всего кроссворда охватывают разные области', () => {
    const typed = typeAll(s0, 'КАТ')
    const word = check(ix, { ...typed, cursor: { entryId: 1, pos: 0 } }, SOLUTION, 'word')
    expect([...word.wrong].sort((a, b) => a - b)).toEqual([at(0, 1), at(0, 3)])
    const all = check(ix, typed, SOLUTION, 'all')
    expect(all.wrong.size).toBe(2)
  })

  it('открытая буква пишется, считается один раз и подсвечивается как подсказка', () => {
    const first = revealLetter(ix, s0, SOLUTION)
    expect(first.letters[at(0, 1)]).toBe('Ш')
    expect(first.revealed.has(at(0, 1))).toBe(true)
    expect(first.hints).toBe(1)
    const again = revealLetter(ix, { ...first, cursor: { entryId: 1, pos: 0 } }, SOLUTION)
    expect(again.hints).toBe(1)
  })

  it('ручной ввод снимает пометку подсказки', () => {
    const revealed = revealLetter(ix, s0, SOLUTION)
    const retyped = applyLetter(ix, { ...revealed, cursor: { entryId: 1, pos: 0 } }, 'К')
    expect(retyped.revealed.has(at(0, 1))).toBe(false)
  })
})

describe('финал', () => {
  it('полностью верная сетка считается разгаданной', () => {
    const letters: Record<number, string> = {}
    ix.letterCells.forEach((cell, i) => {
      letters[cell] = SOLUTION?.[i] as string
    })
    const solved: PlayState = { ...s0, letters }
    expect(isFilled(ix, solved)).toBe(true)
    expect(isSolved(ix, solved, SOLUTION)).toBe(true)
    expect(isSolved(ix, solved, null)).toBe(false)
    expect(isSolved(ix, s0, SOLUTION)).toBe(false)
  })

  it('заполненная, но неверная сетка разгаданной не считается', () => {
    const letters: Record<number, string> = {}
    ix.letterCells.forEach((cell) => {
      letters[cell] = 'А'
    })
    expect(isSolved(ix, { ...s0, letters }, SOLUTION)).toBe(false)
  })
})

describe('прогресс', () => {
  it('сериализация и разбор возвращают то же состояние', () => {
    const typed = typeAll(s0, 'ШАР')
    const withHint = revealLetter(ix, { ...typed, cursor: { entryId: 4, pos: 0 } }, SOLUTION)
    const saved = serializeProgress(ix, withHint, { elapsedMs: 61_500, done: false })
    expect(saved.letters).toHaveLength(47)

    const restored = parseProgress(ix, JSON.parse(JSON.stringify(saved)))
    expect(restored).not.toBeNull()
    expect(restored?.state.letters[at(0, 1)]).toBe('Ш')
    expect(restored?.state.letters[at(0, 5)]).toBe('Г')
    expect(restored?.state.revealed.has(at(0, 5))).toBe(true)
    expect(restored?.state.hints).toBe(1)
    expect(restored?.elapsedMs).toBe(61_500)
    expect(restored?.done).toBe(false)
  })

  it('чужой хэш, битая длина и мусор отбрасываются', () => {
    const saved = serializeProgress(ix, s0, { elapsedMs: 0, done: false })
    expect(parseProgress(ix, { ...saved, hash: 'deadbeef' })).toBeNull()
    expect(parseProgress(ix, { ...saved, letters: 'ША' })).toBeNull()
    expect(parseProgress(ix, { ...saved, v: 99 })).toBeNull()
    expect(parseProgress(ix, null)).toBeNull()
    expect(parseProgress(ix, 'нет')).toBeNull()
  })

  it('ключ хранения содержит id и хэш решения', () => {
    expect(storageKey(DEV_PUZZLE)).toBe(`crossw:dev-fixture-9x9:${DEV_PUZZLE.solutionHash}`)
  })
})

describe('тексты', () => {
  it('время форматируется как мм:сс и ч:мм:сс', () => {
    expect(formatTime(0)).toBe('0:00')
    expect(formatTime(9_000)).toBe('0:09')
    expect(formatTime(61_000)).toBe('1:01')
    expect(formatTime(3_723_000)).toBe('1:02:03')
    expect(formatTime(-5)).toBe('0:00')
  })

  it('aria-label клетки называет позицию, направление и определение', () => {
    const label = cellLabel(ix, s0, at(0, 1))
    expect(label).toContain('пустая клетка')
    expect(label).toContain('1 из 3 по горизонтали')
    expect(label).toContain('Воздушный, земной или бильярдный')

    const typed = applyLetter(ix, s0, 'Ш')
    expect(cellLabel(ix, typed, at(0, 1))).toContain('буква Ш')
  })

  it('текст «поделиться» содержит название, время и счётчики', () => {
    const text = shareText(DEV_PUZZLE, { elapsedMs: 125_000, hints: 2, checks: 3 })
    expect(text).toContain('Отладочный кроссворд 9×9')
    expect(text).toContain('2:05')
    expect(text).toContain('подсказок 2')
    expect(text).toContain('проверок 3')
  })
})

describe('вердикт проверки', () => {
  it('пустая область: проверять нечего', () => {
    const outcome = checkOutcome(ix, s0, SOLUTION, 'word')
    expect(outcome.filled).toBe(0)
    expect(outcome.wrong).toBe(0)
  })

  it('верная буква: заполнена одна, неверных нет', () => {
    const typed = applyLetter(ix, s0, (SOLUTION as string)[0] as string)
    const outcome = checkOutcome(ix, { ...typed, cursor: { entryId: 1, pos: 0 } }, SOLUTION, 'letter')
    expect(outcome.cells).toBe(1)
    expect(outcome.filled).toBe(1)
    expect(outcome.wrong).toBe(0)
  })

  it('неверная буква попадает в счёт', () => {
    const wrong = (SOLUTION as string)[0] === 'А' ? 'Б' : 'А'
    const typed = applyLetter(ix, s0, wrong)
    const outcome = checkOutcome(ix, { ...typed, cursor: { entryId: 1, pos: 0 } }, SOLUTION, 'letter')
    expect(outcome.wrong).toBe(1)
  })

  it('без решения вердикта нет, но область известна', () => {
    const outcome = checkOutcome(ix, s0, null, 'all')
    expect(outcome.cells).toBe(ix.letterCells.length)
    expect(outcome.filled).toBe(0)
  })

  it('состояние не меняется', () => {
    const before = JSON.stringify(s0.letters)
    checkOutcome(ix, s0, SOLUTION, 'all')
    expect(JSON.stringify(s0.letters)).toBe(before)
    expect(s0.checks).toBe(0)
  })
})

describe('подтверждение верных букв', () => {
  it('проверка помечает верную букву как подтверждённую', () => {
    const typed = applyLetter(ix, s0, (SOLUTION as string)[0] as string)
    const checked = check(ix, { ...typed, cursor: { entryId: 1, pos: 0 } }, SOLUTION, 'letter')
    const cell = cursorCell(ix, { entryId: 1, pos: 0 }) as number
    expect(checked.correct.has(cell)).toBe(true)
    expect(checked.wrong.has(cell)).toBe(false)
  })

  it('исправление буквы снимает подтверждение со старой', () => {
    const typed = applyLetter(ix, s0, (SOLUTION as string)[0] as string)
    const checked = check(ix, { ...typed, cursor: { entryId: 1, pos: 0 } }, SOLUTION, 'letter')
    const cell = cursorCell(ix, { entryId: 1, pos: 0 }) as number
    const other = (SOLUTION as string)[0] === 'А' ? 'Б' : 'А'
    const retyped = applyLetter(ix, { ...checked, cursor: { entryId: 1, pos: 0 } }, other)
    expect(retyped.correct.has(cell)).toBe(false)
  })

  it('неверная буква в подтверждённые не попадает', () => {
    const other = (SOLUTION as string)[0] === 'А' ? 'Б' : 'А'
    const typed = applyLetter(ix, s0, other)
    const checked = check(ix, { ...typed, cursor: { entryId: 1, pos: 0 } }, SOLUTION, 'letter')
    const cell = cursorCell(ix, { entryId: 1, pos: 0 }) as number
    expect(checked.correct.has(cell)).toBe(false)
    expect(checked.wrong.has(cell)).toBe(true)
  })

  it('восстановленный прогресс приходит без пометок проверки', () => {
    const typed = applyLetter(ix, s0, (SOLUTION as string)[0] as string)
    const checked = check(ix, { ...typed, cursor: { entryId: 1, pos: 0 } }, SOLUTION, 'letter')
    const saved = serializeProgress(ix, checked, { elapsedMs: 0, done: false })
    const restored = parseProgress(ix, JSON.parse(JSON.stringify(saved)))
    expect(restored?.state.correct.size).toBe(0)
  })
})
