'use client'

/**
 * Итог партии. Появляется, когда кроссворд разгадан целиком.
 *
 * Текст для «поделиться» строит движок (`shareText`) — он же следит, чтобы в нём
 * не было ответов. Буфер обмена доступен не всегда: без https и в старых
 * браузерах `navigator.clipboard` просто нет, поэтому копирование обёрнуто и
 * молча ничего не делает вместо падения.
 */

import { useState } from 'react'
import type { CompiledPuzzle } from '@/core/model'
import { formatTime, shareText } from '@/engine/engine'
import { useElapsed, type TimerStore } from '@/hooks/usePuzzle'
import { ru } from '@/i18n/ru'

export interface ResultPanelProps {
  puzzle: CompiledPuzzle
  timer: TimerStore
  hints: number
  checks: number
}

export function ResultPanel({ puzzle, timer, hints, checks }: ResultPanelProps) {
  const elapsedMs = useElapsed(timer)
  const [share, setShare] = useState<'idle' | 'copied' | 'failed'>('idle')

  const onShare = async (): Promise<void> => {
    const text = shareText(puzzle, { elapsedMs: timer.read(), hints, checks })
    try {
      await navigator.clipboard.writeText(text)
      setShare('copied')
    } catch {
      // Небезопасный контекст или отказ пользователя. Молчать нельзя: игрок
      // нажал кнопку и должен понять, почему ничего не произошло.
      setShare('failed')
    }
  }

  return (
    <div
      className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded border border-cell-line bg-cell-hint px-4 py-3"
      onMouseDown={(event) => event.preventDefault()} // фокус остаётся на поле ввода
    >
      <strong className="text-lg">{ru.solved}</strong>
      <span>{ru.solvedIn(formatTime(elapsedMs))}</span>
      <span style={{ color: 'var(--muted)' }}>
        {ru.hints}: {hints} · {ru.checks}: {checks}
      </span>
      <button
        type="button"
        className="ml-auto rounded border border-cell-line px-3 py-1 text-sm"
        onClick={() => void onShare()}
      >
        {share === 'copied' ? ru.shareCopied : ru.share}
      </button>
      {share === 'failed' && (
        <p role="status" className="basis-full text-sm" style={{ color: 'var(--muted)' }}>
          {ru.shareFailed}
        </p>
      )}
    </div>
  )
}
