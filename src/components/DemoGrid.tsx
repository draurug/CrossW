import { ru } from '@/i18n/ru'

/**
 * Витрина на главной: два настоящих пересекающихся слова с настоящими
 * определениями. Не интерактивна и намеренно не использует движок — это
 * картинка, объясняющая идею, а не игра.
 */
export function DemoGrid() {
  const { across, down } = ru.homeDemo
  const cols = across.word.length
  const rows = down.word.length

  /** Буква в клетке или `null`, если клетки в этой позиции нет. */
  const letterAt = (row: number, col: number): string | null => {
    if (row === 0) return across.word[col] as string
    if (col === down.crossAt) return down.word[row] as string
    return null
  }

  return (
    <div className="flex flex-wrap items-start gap-x-10 gap-y-6">
      <div className="grid w-fit gap-px" style={{ gridTemplateColumns: `repeat(${cols}, 2.5rem)` }}>
        {Array.from({ length: rows * cols }, (_, index) => {
          const row = Math.floor(index / cols)
          const col = index % cols
          const letter = letterAt(row, col)

          if (letter === null) return <div key={index} className="h-10 w-10" />

          // Номер стоит только в клетке-начале слова, как в настоящей сетке.
          const number = row === 0 && col === 0 ? 1 : row === 0 && col === down.crossAt ? 2 : 0

          return (
            <div
              key={index}
              className="relative h-10 w-10 rounded-sm border border-cell-line bg-cell-bg text-center text-xl font-semibold leading-10"
            >
              {number > 0 && (
                <span className="absolute left-[3px] top-0 text-[10px] font-normal leading-tight opacity-70">
                  {number}
                </span>
              )}
              {letter}
            </div>
          )
        })}
      </div>

      <dl className="max-w-xs space-y-3 text-sm leading-relaxed">
        <div>
          <dt className="font-semibold">1 {ru.across.toLowerCase()}</dt>
          <dd style={{ color: 'var(--muted)' }}>{across.clue}</dd>
        </div>
        <div>
          <dt className="font-semibold">2 {ru.down.toLowerCase()}</dt>
          <dd style={{ color: 'var(--muted)' }}>{down.clue}</dd>
        </div>
      </dl>
    </div>
  )
}
