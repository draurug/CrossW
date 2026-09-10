import Link from 'next/link'
import { ru } from '@/i18n/ru'

export default function NotFoundPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-24">
      <h1 className="text-3xl font-bold tracking-tight">{ru.pageNotFound}</h1>
      <p className="mt-6">
        <Link href="/" className="hover:underline" style={{ color: 'var(--accent)' }}>
          ← {ru.toMain}
        </Link>
      </p>
    </main>
  )
}
