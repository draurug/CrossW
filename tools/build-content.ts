/**
 * `npm run content` — content/ → public/p/
 *
 * Собирает из человекочитаемых кроссвордов то, что уедет в браузер:
 * `<id>.json` без единой буквы ответа и `<id>.sol` с обфусцированным решением.
 * Входит в `npm run build`, поэтому public/p/ в git не хранится.
 */

import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { compile } from '../src/core/compile'
import type { PuzzleSource, Topic } from '../src/core/model'
import { validatePuzzle } from '../src/core/validate'
import { PUBLIC_PUZZLE_DIR, ROOT, readPuzzles, readTopics } from './content-io'

/**
 * Каталог для страниц сайта: темы и метаданные кроссвордов, без сеток и ответов.
 *
 * Страницам нужен список тем и кроссвордов, но `node:fs` в слое приложения
 * запрещён (см. docs/architecture.md §1). Поэтому каталог генерируется здесь
 * в обычный TS-модуль, а страницы просто импортируют его.
 */
function writeCatalog(topics: Topic[], puzzles: PuzzleSource[]): void {
  const cards = puzzles.map((puzzle) => ({
    id: puzzle.id,
    topicId: puzzle.topicId,
    title: puzzle.title,
    difficulty: puzzle.difficulty,
    rows: puzzle.grid.length,
    cols: puzzle.grid[0]?.length ?? 0,
    entries: Object.keys(puzzle.clues).length,
  }))

  const file = `// Файл собран командой \`npm run content\`. Руками не править.
import type { Difficulty, Topic } from '../core/model'

export interface PuzzleCard {
  id: string
  topicId: string
  title: string
  difficulty: Difficulty
  rows: number
  cols: number
  entries: number
}

export const topics: Topic[] = ${JSON.stringify(topics, null, 2)}

export const puzzles: PuzzleCard[] = ${JSON.stringify(cards, null, 2)}

export function topicBySlug(slug: string): Topic | undefined {
  return topics.find((topic) => topic.slug === slug)
}

export function puzzlesOfTopic(topicId: string): PuzzleCard[] {
  return puzzles.filter((puzzle) => puzzle.topicId === topicId)
}
`

  const dir = join(ROOT, 'src', 'generated')
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'catalog.ts'), file)
}

function main(): void {
  const puzzles = readPuzzles()
  const topics = readTopics()

  rmSync(PUBLIC_PUZZLE_DIR, { recursive: true, force: true })
  mkdirSync(PUBLIC_PUZZLE_DIR, { recursive: true })

  // Каталог пишется всегда, даже пустой: без него не соберутся страницы.
  writeCatalog(topics, puzzles)

  if (puzzles.length === 0) {
    console.log('Кроссвордов в content/puzzles ещё нет — собран пустой каталог')
    return
  }

  for (const source of puzzles) {
    // Сборка не должна публиковать заведомо испорченный кроссворд: пользователь
    // откроет его на сайте и не сможет разгадать.
    const { issues } = validatePuzzle(source)
    const errors = issues.filter((issue) => issue.severity === 'error')
    if (errors.length > 0) {
      for (const issue of errors) console.error(`  ${issue.where} — ${issue.message}`)
      throw new Error(`Кроссворд ${source.id} не проходит валидатор, сборка остановлена`)
    }

    const { puzzle, encodedSolution } = compile(source)
    writeFileSync(join(PUBLIC_PUZZLE_DIR, `${source.id}.json`), JSON.stringify(puzzle))
    writeFileSync(join(PUBLIC_PUZZLE_DIR, `${source.id}.sol`), encodedSolution)
    console.log(`  ${source.id} — ${puzzle.entries.length} слов`)
  }

  console.log(`Собрано кроссвордов: ${puzzles.length}`)
}

main()
