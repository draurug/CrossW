import { PuzzleCard } from '@/components/PuzzleCard'
import { RandomPuzzle } from '@/components/RandomPuzzle'
import { TopicCard } from '@/components/TopicCard'
import { puzzles, puzzlesOfTopic, topics } from '@/generated/catalog'
import { ru } from '@/i18n/ru'

/**
 * По одному лёгкому кроссворду с каждой темы: с главной можно сразу начать
 * решать, а не сначала выбирать тему, а потом сложность.
 */
const startHere = topics
  .map((topic) => puzzlesOfTopic(topic.id).find((puzzle) => puzzle.difficulty === 'easy'))
  .filter((puzzle): puzzle is NonNullable<typeof puzzle> => puzzle !== undefined)

export default function HomePage() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-16">
      <h1 className="max-w-2xl text-4xl font-bold leading-tight tracking-tight">{ru.homeTitle}</h1>

      <p className="mt-5 max-w-2xl text-lg leading-relaxed" style={{ color: 'var(--muted)' }}>
        {ru.homeLead}
      </p>

      <section className="mt-10">
        <h2 className="text-sm font-semibold uppercase tracking-widest" style={{ color: 'var(--muted)' }}>
          {ru.randomTitle}
        </h2>
        <div className="mt-4">
          <RandomPuzzle />
        </div>
      </section>

      {startHere.length > 0 && (
        <section className="mt-14">
          <h2 className="text-sm font-semibold uppercase tracking-widest" style={{ color: 'var(--muted)' }}>
            {ru.homeStart}
          </h2>
          <ul className="mt-4 space-y-3">
            {startHere.map((puzzle) => (
              <PuzzleCard key={puzzle.id} puzzle={puzzle} />
            ))}
          </ul>
        </section>
      )}

      <section className="mt-14">
        <h2 className="text-sm font-semibold uppercase tracking-widest" style={{ color: 'var(--muted)' }}>
          {ru.topics}
        </h2>

        {topics.length === 0 ? (
          <p className="mt-4" style={{ color: 'var(--muted)' }}>
            {ru.topicsEmpty}
          </p>
        ) : (
          <ul className="mt-4 grid gap-4 sm:grid-cols-2">
            {topics.map((topic) => (
              <TopicCard key={topic.id} topic={topic} puzzleCount={puzzlesOfTopic(topic.id).length} />
            ))}
          </ul>
        )}
      </section>

      <p className="mt-14 text-sm" style={{ color: 'var(--muted)' }}>
        {ru.puzzleCount(puzzles.length)} · {ru.wordCount(puzzles.reduce((sum, p) => sum + p.entries, 0))}
      </p>
    </main>
  )
}
