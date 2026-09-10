'use client'

/**
 * Панель партии: часы, счётчики и кнопки помощи.
 *
 * Часы отдельным компонентом с подпиской на таймер — чтобы секунда меняла
 * четыре символа на экране, а не перерисовывала сетку (см. `usePuzzle`).
 * Проверка и подсказка заблокированы, пока не приехал файл решения: без него
 * движок всё равно ничего не сделает, и кнопка врала бы.
 */

import { formatTime, type CheckOutcome, type CheckScope } from '@/engine/engine'
import { useElapsed, type TimerStore } from '@/hooks/usePuzzle'
import { ru } from '@/i18n/ru'

const BUTTON =
  'rounded border border-cell-line px-3 py-1 text-sm disabled:cursor-not-allowed disabled:opacity-40'

export interface ToolbarProps {
  timer: TimerStore
  hints: number
  checks: number
  /** Решение загружено: до этого проверка и подсказка бессильны. */
  ready: boolean
  onCheck: (scope: CheckScope) => void
  /** Итог последней проверки. `null` — с тех пор игрок что-то менял. */
  lastCheck: CheckOutcome | null
  onHint: () => void
  onClear: () => void
}

export function Toolbar({
  timer,
  hints,
  checks,
  ready,
  onCheck,
  lastCheck,
  onHint,
  onClear,
}: ToolbarProps) {
  return (
    <div
      className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded border border-cell-line px-4 py-3"
      onMouseDown={(event) => event.preventDefault()} // фокус остаётся на поле ввода
    >
      <Counter label={ru.timer} value={<Clock timer={timer} />} />
      <Counter label={ru.hints} value={hints} />
      <Counter label={ru.checks} value={checks} />
      {lastCheck !== null && <CheckVerdict outcome={lastCheck} />}

      <div className="ml-auto flex items-center gap-2">
        <span className="text-sm" style={{ color: 'var(--muted)' }}>
          {ru.check}
        </span>
        <button type="button" className={BUTTON} disabled={!ready} onClick={() => onCheck('letter')}>
          {ru.checkLetter}
        </button>
        <button type="button" className={BUTTON} disabled={!ready} onClick={() => onCheck('word')}>
          {ru.checkWord}
        </button>
        <button type="button" className={BUTTON} disabled={!ready} onClick={() => onCheck('all')}>
          {ru.checkAll}
        </button>
      </div>

      <button type="button" className={BUTTON} disabled={!ready} onClick={onHint}>
        {ru.hint}
      </button>
      <button
        type="button"
        className={BUTTON}
        onClick={() => {
          // Единственное подтверждение в плеере: стереть партию нечем откатить.
          if (window.confirm(ru.clearConfirm)) onClear()
        }}
      >
        {ru.clear}
      </button>
    </div>
  )
}

/**
 * Вердикт проверки словами.
 *
 * Неверные буквы и так покрашены в сетке, но если всё верно — красить нечего, и
 * без этой строчки игрок видит только выросший счётчик и не понимает, что
 * произошло. `role="status"` заодно проговаривает вердикт скринридеру.
 */
function CheckVerdict({ outcome }: { outcome: CheckOutcome }) {
  const single = outcome.cells === 1

  const [text, tone] =
    outcome.filled === 0
      ? [ru.checkEmpty, 'muted']
      : outcome.wrong === 0
        ? [single ? ru.checkLetterOk : ru.checkOk, 'ok']
        : [single ? ru.checkLetterBad : ru.checkBad(outcome.wrong), 'bad']

  const colour =
    tone === 'ok' ? 'var(--verdict-ok)' : tone === 'bad' ? 'var(--verdict-bad)' : 'var(--muted)'

  return (
    <span role="status" className="text-sm font-medium" style={{ color: colour }}>
      {text}
    </span>
  )
}

/** Часы. Подписаны на таймер напрямую, поэтому тик не трогает остальное дерево. */
function Clock({ timer }: { timer: TimerStore }) {
  const elapsedMs = useElapsed(timer)
  return <span className="tabular-nums">{formatTime(elapsedMs)}</span>
}

function Counter({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <span className="text-sm">
      <span style={{ color: 'var(--muted)' }}>{label}: </span>
      <span className="font-semibold">{value}</span>
    </span>
  )
}
