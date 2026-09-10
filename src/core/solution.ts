/**
 * Решение кроссворда: хэш и запутывание.
 *
 * Решение уезжает в браузер отдельным файлом `<id>.sol`. Строка ответов там не
 * лежит открытым текстом: каждый символ смешан с ключом, выведенным из id
 * кроссворда, и файл выглядит как `4f2a8b1c…` вместо `НОСГОРАЖУРНАЛ`.
 *
 * Это защита от «посмотреть исходник», а не шифрование: кто откроет devtools и
 * позовёт `decodeSolution`, ответы получит. Так и задумано — игра идёт на
 * клиенте, прятать от него ответы всерьёз бессмысленно.
 */

import type { EncodedSolution } from './model'

/** FNV-1a. Быстрый, детерминированный, одинаковый в Node и браузере. */
function fnv1a(input: string, seed = 0x811c9dc5): number {
  let h = seed
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/**
 * Хэш решения — 8 hex-символов.
 *
 * Входит в ключ localStorage: если кроссворд переиздали с другими ответами,
 * ключ меняется и старый прогресс не подхватится вместо нового.
 */
export function solutionHash(letters: string): string {
  return fnv1a(letters).toString(16).padStart(8, '0')
}

/** Поток ключа, детерминированно выведенный из id кроссворда. */
function keyStream(id: string, length: number): number[] {
  const out: number[] = new Array(length)
  let h = fnv1a(id)
  for (let i = 0; i < length; i++) {
    // xorshift32 — ключ зависит от id и позиции, повторов на длине сетки нет
    h ^= h << 13
    h ^= h >>> 17
    h ^= h << 5
    h >>>= 0
    out[i] = h & 0xffff
  }
  return out
}

/**
 * Строка ответов в порядке буквенных клеток → обфусцированная строка.
 * Каждая буква превращается в 4 hex-символа, поэтому русские буквы не ломают формат.
 */
export function encodeSolution(id: string, letters: string): EncodedSolution {
  const key = keyStream(id, letters.length)
  let out = ''
  for (let i = 0; i < letters.length; i++) {
    const code = letters.charCodeAt(i) ^ (key[i] as number)
    out += (code & 0xffff).toString(16).padStart(4, '0')
  }
  return out
}

/** Обратная операция. Возвращает `null`, если строка испорчена. */
export function decodeSolution(id: string, encoded: EncodedSolution): string | null {
  if (encoded.length % 4 !== 0 || !/^[0-9a-f]*$/.test(encoded)) return null
  const length = encoded.length / 4
  const key = keyStream(id, length)
  let out = ''
  for (let i = 0; i < length; i++) {
    const chunk = Number.parseInt(encoded.slice(i * 4, i * 4 + 4), 16)
    if (Number.isNaN(chunk)) return null
    out += String.fromCharCode(chunk ^ (key[i] as number))
  }
  return out
}
