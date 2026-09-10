'use client'

/**
 * Мост React ↔ движок. Единственное место, где они встречаются.
 *
 * Правило docs/architecture.md §2.1: игровой логики здесь нет — есть вызовы
 * функций движка в ответ на события и три вещи, которых у движка нет и быть не
 * может, потому что они про браузер: таймер, localStorage и клавиатура.
 *
 * Таймер намеренно живёт вне `useState`. Если бы секунды хранились в состоянии
 * компонента, сетка 13×13 перерисовывалась бы раз в секунду просто из-за часов.
 * Вместо этого таймер — крошечное внешнее хранилище: подписывается на него
 * только тот, кто показывает время (`useElapsed`), а сетка о нём не знает.
 */

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import type { CompiledPuzzle } from '@/core/model'
import {
  applyLetter,
  backspace,
  buildIndex,
  check,
  checkOutcome,
  clickCell,
  cursorCell,
  deleteAtCursor,
  initialState,
  isSolved,
  moveGrid,
  parseProgress,
  revealLetter,
  selectEntry,
  serializeProgress,
  solutionFits,
  stepEntry,
  storageKey,
  toggleDirection,
  type CheckOutcome,
  type CheckScope,
  type Cursor,
  type GridMove,
  type PlayState,
  type PuzzleIndex,
} from '@/engine/engine'

// ─────────────────────────────────────────────────────────────────────────────
// Таймер
// ─────────────────────────────────────────────────────────────────────────────

/** Внешнее хранилище времени: подписка для показа, точное чтение для сохранения. */
export interface TimerStore {
  subscribe: (listener: () => void) => () => void
  /** Снимок для `useSyncExternalStore`: меняется только на тике, не на каждый вызов. */
  getSnapshot: () => number
  /** Точное время прямо сейчас. Для сохранения прогресса и итоговой панели. */
  read: () => number
  /** Поставить время: восстановление прогресса и сброс партии. */
  set: (elapsedMs: number) => void
}

/**
 * Таймер партии. Идёт, пока вкладка активна и кроссворд не разгадан.
 *
 * Накопленное время лежит в ref, а не в состоянии: тик обновляет снимок и зовёт
 * подписчиков, поэтому перерисовывается только компонент с часами.
 */
function useTimer(stopped: boolean): TimerStore {
  const accumulated = useRef(0)
  const startedAt = useRef<number | null>(null)
  const snapshot = useRef(0)
  const listeners = useRef<Set<() => void>>(new Set())

  const read = useCallback((): number => {
    const running = startedAt.current === null ? 0 : Date.now() - startedAt.current
    return accumulated.current + running
  }, [])

  const publish = useCallback((): void => {
    snapshot.current = read()
    for (const listener of listeners.current) listener()
  }, [read])

  const store = useMemo<TimerStore>(
    () => ({
      subscribe: (listener) => {
        listeners.current.add(listener)
        return () => {
          listeners.current.delete(listener)
        }
      },
      getSnapshot: () => snapshot.current,
      read,
      set: (elapsedMs) => {
        accumulated.current = elapsedMs > 0 ? elapsedMs : 0
        if (startedAt.current !== null) startedAt.current = Date.now()
        publish()
      },
    }),
    [publish, read],
  )

  useEffect(() => {
    const start = (): void => {
      if (startedAt.current === null) startedAt.current = Date.now()
    }
    const stop = (): void => {
      if (startedAt.current === null) return
      accumulated.current += Date.now() - startedAt.current
      startedAt.current = null
      publish()
    }

    // Разгадано — часы стоят навсегда: итог партии не должен ползти.
    if (stopped) {
      stop()
      return
    }

    const onVisibility = (): void => {
      if (document.visibilityState === 'visible') start()
      else stop()
    }

    if (document.visibilityState === 'visible') start()
    const tick = window.setInterval(() => {
      if (startedAt.current !== null) publish()
    }, 1000)
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      window.clearInterval(tick)
      document.removeEventListener('visibilitychange', onVisibility)
      stop()
    }
  }, [stopped, publish])

  return store
}

/** Секунды для показа. Подписан только тот компонент, что рисует время. */
export function useElapsed(timer: TimerStore): number {
  return useSyncExternalStore(timer.subscribe, timer.getSnapshot, () => 0)
}

// ─────────────────────────────────────────────────────────────────────────────
// Прогресс в localStorage
// ─────────────────────────────────────────────────────────────────────────────

/** Пауза перед записью: буквы летят быстрее, чем имеет смысл писать в хранилище. */
const SAVE_DELAY_MS = 500

/** Начало партии: либо сохранённый прогресс, либо чистая сетка. */
interface Restored {
  state: PlayState
  elapsedMs: number
  /** Хранилище недоступно — прогресс не сохранится, но играть это не мешает. */
  blocked: boolean
}

/**
 * Чтение прогресса при первом рендере, а не в эффекте.
 *
 * Так буквы приезжают до того, как что-нибудь успеет сохраниться поверх них:
 * `StrictMode` в разработке монтирует компонент дважды, и запись при размонтаже
 * первого прохода затёрла бы прогресс, который эффект ещё не успел применить.
 */
function restore(ix: PuzzleIndex, puzzle: CompiledPuzzle): Restored {
  const fresh: Restored = { state: initialState(ix), elapsedMs: 0, blocked: false }
  if (typeof window === 'undefined') return fresh

  let raw: string | null = null
  try {
    raw = window.localStorage.getItem(storageKey(puzzle))
  } catch {
    // Приватный режим или запрет хранилища: играем без сохранения.
    return { ...fresh, blocked: true }
  }
  if (raw === null) return fresh

  let parsed: unknown = null
  try {
    parsed = JSON.parse(raw)
  } catch {
    return fresh // Битый JSON: чинить нечего, начинаем партию заново.
  }

  const saved = parseProgress(ix, parsed)
  if (saved === null) return fresh
  return { state: saved.state, elapsedMs: saved.elapsedMs, blocked: false }
}

// ─────────────────────────────────────────────────────────────────────────────
// Хук
// ─────────────────────────────────────────────────────────────────────────────

/** Стрелки клавиатуры в шаги движка. */
const ARROWS: Partial<Record<string, GridMove>> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
}

/** Всё, что нужно компонентам плеера. Ничего, что они могли бы вычислить сами. */
export interface PuzzleApi {
  ix: PuzzleIndex
  state: PlayState
  /** Клетка под кареткой. */
  cursor: number | null
  /** Клетки активного слова — подсветка сетки. */
  wordCells: ReadonlySet<number>
  /** Слова, заполненные целиком — приглушение в списке определений. */
  filledEntries: ReadonlySet<number>
  /** Решение загружено и подходит кроссворду: до этого проверка и подсказка мертвы. */
  ready: boolean
  solved: boolean
  /** Хранилище недоступно (приватный режим): прогресс не сохранится. */
  storageBlocked: boolean
  timer: TimerStore
  /** Скрытый input, который держит фокус и ловит клавиатуру. */
  inputRef: React.RefObject<HTMLInputElement | null>
  focusInput: () => void
  onKeyDown: (event: React.KeyboardEvent) => void
  onCellClick: (cell: number) => void
  onSelectEntry: (entryId: number) => void
  onCheck: (scope: CheckScope) => void
  /** Чем закончилась последняя проверка. `null` — с тех пор игрок что-то менял. */
  lastCheck: CheckOutcome | null
  onHint: () => void
  onClear: () => void
}

/**
 * Партия одного кроссворда.
 *
 * `puzzle` считается неизменным за время жизни хука: индекс строится один раз.
 * Смена кроссворда — это новый компонент (`key` по id), а не новый пропс.
 */
export function usePuzzle(puzzle: CompiledPuzzle, solution: string | null): PuzzleApi {
  const ix = useMemo(() => buildIndex(puzzle), [puzzle])
  const [restored] = useState<Restored>(() => restore(ix, puzzle))
  const [state, setState] = useState<PlayState>(restored.state)
  const [storageBlocked, setStorageBlocked] = useState(restored.blocked)

  const ready = solutionFits(ix, solution)
  const solved = useMemo(() => isSolved(ix, state, solution), [ix, state, solution])
  const timer = useTimer(solved)

  const inputRef = useRef<HTMLInputElement | null>(null)
  const focusInput = useCallback((): void => {
    inputRef.current?.focus({ preventScroll: true })
  }, [])

  // Свежие значения для обработчиков вне рендера: сохранение зовут таймеры и события.
  const stateRef = useRef(state)
  stateRef.current = state
  const solvedRef = useRef(solved)
  solvedRef.current = solved
  const blockedRef = useRef(storageBlocked)
  blockedRef.current = storageBlocked

  // Буквы восстановлены ещё в первом рендере, часам время нужно поставить руками.
  useEffect(() => {
    if (restored.elapsedMs > 0) timer.set(restored.elapsedMs)
  }, [restored, timer])

  // ── Сохранение прогресса ───────────────────────────────────────────────────
  const save = useCallback((): void => {
    if (blockedRef.current) return
    const saved = serializeProgress(ix, stateRef.current, {
      elapsedMs: timer.read(),
      done: solvedRef.current,
    })
    try {
      window.localStorage.setItem(storageKey(puzzle), JSON.stringify(saved))
    } catch {
      setStorageBlocked(true)
    }
  }, [ix, puzzle, timer])

  useEffect(() => {
    const id = window.setTimeout(save, SAVE_DELAY_MS)
    return () => window.clearTimeout(id)
  }, [state, solved, save])

  // Уход со страницы: дебаунс досюда не доживёт, пишем сразу.
  useEffect(() => {
    const onHide = (): void => {
      if (document.visibilityState === 'hidden') save()
    }
    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('pagehide', save)
    return () => {
      document.removeEventListener('visibilitychange', onHide)
      window.removeEventListener('pagehide', save)
      save()
    }
  }, [save])

  // ── Переходы состояния ─────────────────────────────────────────────────────
  const move = useCallback((next: (state: PlayState) => Cursor): void => {
    setState((prev) => withCursor(prev, next(prev)))
  }, [])

  const onCellClick = useCallback(
    (cell: number): void => {
      move((prev) => clickCell(ix, cell, prev.cursor) ?? prev.cursor)
      focusInput()
    },
    [ix, move, focusInput],
  )

  const onSelectEntry = useCallback(
    (entryId: number): void => {
      move((prev) => selectEntry(ix, prev, entryId))
      focusInput()
    },
    [ix, move, focusInput],
  )

  /**
   * Чем закончилась последняя проверка. Живёт отдельно от `PlayState`: это
   * сообщение сессии, а не часть партии, и в сохранённый прогресс не идёт.
   */
  const [lastCheck, setLastCheck] = useState<CheckOutcome | null>(null)

  const onCheck = useCallback(
    (scope: CheckScope): void => {
      setState((prev) => {
        const outcome = checkOutcome(ix, prev, solution, scope)
        setLastCheck(outcome)
        // Проверять пустые клетки незачем, а счётчик проверок за это расти не
        // должен: игрок ничего не узнал.
        return outcome.filled === 0 ? prev : check(ix, prev, solution, scope)
      })
      focusInput()
    },
    [ix, solution, focusInput],
  )

  const onHint = useCallback((): void => {
    setState((prev) => revealLetter(ix, prev, solution))
    focusInput()
  }, [ix, solution, focusInput])

  const onClear = useCallback((): void => {
    setLastCheck(null)
    setState(initialState(ix))
    timer.set(0)
    focusInput()
  }, [ix, timer, focusInput])

  // ── Клавиатура ─────────────────────────────────────────────────────────────
  const onKeyDown = useCallback(
    (event: React.KeyboardEvent): void => {
      // Ctrl+R, Cmd+L и прочие браузерные сочетания — не наше дело.
      if (event.ctrlKey || event.metaKey || event.altKey) return
      const key = event.key
      const direction = ARROWS[key]
      if (direction !== undefined) {
        event.preventDefault() // иначе страница уедет вместе с кареткой
        move((prev) => moveGrid(ix, prev.cursor, direction))
        return
      }

      switch (key) {
        case 'Backspace':
          event.preventDefault()
          setState((prev) => backspace(ix, prev))
          return
        case 'Delete':
          event.preventDefault()
          setState((prev) => deleteAtCursor(ix, prev))
          return
        case 'Tab': {
          event.preventDefault()
          const delta = event.shiftKey ? -1 : 1
          move((prev) => stepEntry(ix, prev, delta))
          return
        }
        case ' ':
          event.preventDefault()
          move((prev) => toggleDirection(ix, prev.cursor))
          return
        case 'Escape':
          // Tab внутри кроссворда переключает слова, поэтому уйти с поля иначе
          // нечем: Escape отпускает фокус и возвращает Tab браузеру.
          inputRef.current?.blur()
          return
        case 'Home':
          event.preventDefault()
          move((prev) => ({ entryId: prev.cursor.entryId, pos: 0 }))
          return
        case 'End':
          event.preventDefault()
          move((prev) => {
            const entry = ix.byId.get(prev.cursor.entryId)
            if (entry === undefined) return prev.cursor
            return { entryId: prev.cursor.entryId, pos: entry.cells.length - 1 }
          })
          return
        default:
          break
      }

      // Всё остальное однобуквенное отдаём движку: чужой алфавит он отсеет сам.
      if (key.length === 1) {
        event.preventDefault()
        setLastCheck(null)
        setState((prev) => applyLetter(ix, prev, key))
      }
    },
    [ix, move],
  )

  // ── Производные для рендера ────────────────────────────────────────────────
  const cursor = useMemo(() => cursorCell(ix, state.cursor), [ix, state.cursor])

  const wordCells = useMemo<ReadonlySet<number>>(
    () => new Set(ix.byId.get(state.cursor.entryId)?.cells ?? []),
    [ix, state.cursor.entryId],
  )

  // Заполненность — не проверка ответа, а признак «здесь уже нечего вписывать».
  const filledEntries = useMemo<ReadonlySet<number>>(() => {
    const filled = new Set<number>()
    for (const entry of ix.order) {
      if (entry.cells.every((cell) => state.letters[cell] !== undefined)) filled.add(entry.id)
    }
    return filled
  }, [ix, state.letters])

  return {
    ix,
    state,
    cursor,
    wordCells,
    filledEntries,
    ready,
    solved,
    storageBlocked,
    timer,
    inputRef,
    focusInput,
    onKeyDown,
    onCellClick,
    onSelectEntry,
    onCheck,
    lastCheck,
    onHint,
    onClear,
  }
}

/** Состояние с другой кареткой. Каретка та же — тот же объект, лишней перерисовки нет. */
function withCursor(state: PlayState, cursor: Cursor): PlayState {
  if (cursor.entryId === state.cursor.entryId && cursor.pos === state.cursor.pos) return state
  return { ...state, cursor }
}
