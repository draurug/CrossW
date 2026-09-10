/**
 * Чтение контента с диска. Единственное место, где `core` встречается с файловой
 * системой: сам `core` про fs не знает и знать не должен.
 */

import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Pack, PuzzleSource, Topic } from '../src/core/model'

export const ROOT = fileURLToPath(new URL('..', import.meta.url))
export const CONTENT_DIR = join(ROOT, 'content')
export const PUBLIC_PUZZLE_DIR = join(ROOT, 'public', 'p')

function readJson<T>(path: string): T {
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as T
  } catch (error) {
    throw new Error(`Не удалось прочитать ${path}: ${(error as Error).message}`)
  }
}

function listJson(dir: string): string[] {
  try {
    return readdirSync(dir)
      .filter((name) => name.endsWith('.json'))
      .sort()
      .map((name) => join(dir, name))
  } catch {
    return [] // каталога ещё нет — это нормально на раннем этапе
  }
}

export function readTopics(): Topic[] {
  const path = join(CONTENT_DIR, 'topics.json')
  try {
    return readJson<Topic[]>(path)
  } catch {
    return []
  }
}

export function readPacks(): Pack[] {
  return listJson(join(CONTENT_DIR, 'packs')).map((path) => readJson<Pack>(path))
}

export function readPuzzles(): PuzzleSource[] {
  return listJson(join(CONTENT_DIR, 'puzzles')).map((path) => readJson<PuzzleSource>(path))
}
