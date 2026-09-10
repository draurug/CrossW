import { DemoGrid } from '@/components/DemoGrid'
import { TopicCard } from '@/components/TopicCard'
import { puzzlesOfTopic, topics } from '@/generated/catalog'
import { ru } from '@/i18n/ru'

export default function HomePage() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-16">
      <h1 className="max-w-2xl text-4xl font-bold leading-tight tracking-tight">{ru.homeTitle}</h1>

      <p className="mt-5 max-w-2xl text-lg leading-relaxed" style={{ color: 'var(--muted)' }}>
        {ru.homeLead}
      </p>

      <section className="mt-12 border-t pt-10" style={{ borderColor: 'var(--cell-line)' }}>
        <DemoGrid />
        <p className="mt-8 max-w-xl text-sm leading-relaxed" style={{ color: 'var(--muted)' }}>
          {ru.homeDemoNote}
        </p>
      </section>

      <section className="mt-16 border-t pt-10" style={{ borderColor: 'var(--cell-line)' }}>
        <h2 className="text-2xl font-semibold tracking-tight">{ru.topics}</h2>

        {topics.length === 0 ? (
          <p className="mt-4" style={{ color: 'var(--muted)' }}>
            {ru.topicsEmpty}
          </p>
        ) : (
          <ul className="mt-6 grid gap-4 sm:grid-cols-2">
            {topics.map((topic) => (
              <TopicCard key={topic.id} topic={topic} puzzleCount={puzzlesOfTopic(topic.id).length} />
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}
