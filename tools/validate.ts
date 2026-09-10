/**
 * `npm run validate` — проверка всего контента.
 *
 * Ошибка означает, что кроссворд или пак нельзя публиковать. Предупреждение —
 * что стоит посмотреть глазами, но публикации не мешает.
 */

import { parseGrid } from '../src/core/grid'
import type { Pack, PuzzleSource } from '../src/core/model'
import { validatePack, validatePuzzle, type Issue } from '../src/core/validate'
import { readPacks, readPuzzles, readTopics } from './content-io'

/**
 * Слова для знатоков не должны попадать в лёгкие кроссворды.
 *
 * Правило живёт здесь, а не в `core/validate.ts`: проверить его по одному
 * кроссворду нельзя, нужен ещё и пак его темы. Это единственное место, где
 * видно и то, и другое.
 */
function checkEasyDifficulty(puzzle: PuzzleSource, packs: readonly Pack[]): Issue[] {
  if (puzzle.difficulty !== 'easy') return []

  const hard = new Set(
    packs
      .filter((pack) => pack.topicId === puzzle.topicId)
      .flatMap((pack) => pack.entries.filter((entry) => entry.hard).map((entry) => entry.answer)),
  )
  if (hard.size === 0) return []

  const found = [...new Set(parseGrid(puzzle.grid).entries.map((e) => e.answer))].filter((w) =>
    hard.has(w),
  )
  if (found.length === 0) return []

  return [
    {
      severity: 'error',
      where: puzzle.id,
      message: `В лёгком кроссворде слова для знатоков: ${found.join(', ')}`,
    },
  ]
}

const RED = '[31m'
const YELLOW = '[33m'
const GREEN = '[32m'
const DIM = '[2m'
const OFF = '[0m'

function print(issues: Issue[]): void {
  for (const issue of issues) {
    const colour = issue.severity === 'error' ? RED : YELLOW
    const label = issue.severity === 'error' ? 'ошибка' : 'внимание'
    console.log(`  ${colour}${label}${OFF} ${DIM}${issue.where}${OFF} — ${issue.message}`)
  }
}

function main(): void {
  const topics = readTopics()
  const packs = readPacks()
  const puzzles = readPuzzles()
  const all: Issue[] = []

  console.log(`Тем: ${topics.length}, паков: ${packs.length}, кроссвордов: ${puzzles.length}\n`)

  const topicIds = new Set(topics.map((topic) => topic.id))

  for (const pack of packs) {
    console.log(`Пак ${pack.id} — ${pack.entries.length} слов`)
    const issues = validatePack(pack)
    if (!topicIds.has(pack.topicId)) {
      issues.push({
        severity: 'error',
        where: pack.id,
        message: `Тема ${pack.topicId} не описана в content/topics.json`,
      })
    }
    print(issues)
    all.push(...issues)
  }

  for (const puzzle of puzzles) {
    const { issues, stats } = validatePuzzle(puzzle)
    const summary = stats
      ? `${stats.entries} слов, тематических ${Math.round(stats.topicShare * 100)}%, пересечений ${Math.round(stats.crossShare * 100)}%`
      : 'не разобран'
    console.log(`Кроссворд ${puzzle.id} — ${summary}`)
    if (!topicIds.has(puzzle.topicId)) {
      issues.push({
        severity: 'error',
        where: puzzle.id,
        message: `Тема ${puzzle.topicId} не описана в content/topics.json`,
      })
    }
    issues.push(...checkEasyDifficulty(puzzle, packs))
    print(issues)
    all.push(...issues)
  }

  const errors = all.filter((issue) => issue.severity === 'error').length
  const warnings = all.length - errors

  console.log()
  if (errors > 0) {
    console.log(`${RED}Ошибок: ${errors}${OFF}, предупреждений: ${warnings}`)
    process.exit(1)
  }
  console.log(`${GREEN}Ошибок нет${OFF}, предупреждений: ${warnings}`)
}

main()
